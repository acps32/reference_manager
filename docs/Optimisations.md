# Axes d'optimisation identifiés

Analyse du 22 septembre, suite à la question "qu'est-ce qui se passe si je continue à importer des images 4K en masse ?". Objectif : lister tous les leviers connus, mesurer/prioriser plutôt que tout implémenter, et garder une trace pour la soutenance de ce qui a été identifié mais volontairement pas fait faute de temps.

## 1. Transfert de données (backend → frontend)

- **Filtrage par viewport** — déjà identifié comme le point critique du projet (voir `Decisions.md`). Requête SQL `WHERE` sur x/y/width/height côté backend.
- **Index spatial** — une fois le `WHERE` en place, sans index SQLite scanne toute la table à chaque requête. Un index B-tree classique optimise mal une recherche 2D. La bonne réponse est un **index R-Tree**, natif à SQLite (`CREATE VIRTUAL TABLE ... USING rtree`), conçu spécifiquement pour "quels rectangles chevauchent ce rectangle".
- **Chargement incrémental** — ne pas redemander ce qui est déjà chargé quand le viewport bouge légèrement.
- **Debounce des requêtes** — `mousemove` peut se déclencher ~1000 fois/seconde ; sans throttling, brancher le viewport dessus veut dire potentiellement 1000 requêtes HTTP par seconde de pan.

## 2. Mémoire navigateur

- **Décharger les images hors viewport** — point crucial et contre-intuitif : sans ça, le filtrage par viewport ne fait que *retarder* le problème mémoire, pas le résoudre. Sans libération explicite (`img.src = ""`, retrait du tableau), tout ce qui a été survolé depuis le chargement de la page reste en mémoire.
- **`createImageBitmap()` au lieu de `<img>`** — décodage hors du thread principal (pas de freeze au chargement), et surtout un `.close()` explicite pour libérer la mémoire de façon déterministe plutôt que d'attendre le passage du garbage collector.
- **Thumbnails / LOD** — le plus gros levier : c'est le seul qui règle le cas "image 4K visible mais affichée en 50×50 px à l'écran". Générer 2-3 tailles à l'upload (Pillow, déjà une dépendance) et servir celle qui correspond au niveau de zoom courant.

## 3. Rendu canvas

- **Culling côté client** — sauter le `drawImage` des éléments hors écran dans `drawElements()` (`canvas.js`). Test de rectangle peu coûteux, gain immédiat dès que le nombre d'éléments grandit.
- **`requestAnimationFrame`** — `render()` est actuellement appelé de façon synchrone à chaque `mousemove`, ce qui peut redessiner plusieurs fois entre deux rafraîchissements d'écran réels, pour rien. Coalescer en un rendu par frame.
- **Canvas en couches séparées** — la grille sur son propre `<canvas>`, redessinée seulement au zoom/pan, pas à chaque déplacement d'un élément.
- **Dirty rect** — ne réeffacer/redessiner que la zone qui a réellement changé, au lieu d'un `clearRect` plein écran à chaque frame.

## 4. Upload / stockage

- **Compression/redimensionnement à l'upload** — aucun pour l'instant ; le fichier est copié tel quel (juste renommé en UUID).
- **Déduplication par hash** — dans un outil de références, la même image est probablement importée plusieurs fois par erreur. Hasher le contenu à l'upload et réutiliser le fichier existant si déjà présent.
- **Upload groupé** — actuellement un `POST` par fichier, chacun avec son propre `db.commit()`. Déposer 200 images = 200 requêtes + 200 transactions séparées.

## 5. Backend / base

- **PATCH groupé** — déplacer N éléments sélectionnés déclenche actuellement N requêtes `PATCH` séparées (une boucle sur `dragGroup`, voir `main.js`). Un endpoint de mise à jour en masse ramènerait ça à une seule requête/transaction.
- **Index sur `canvas_id` et `visible`.**
- **Verrouillage SQLite en écriture concurrente** ("database is locked") — probable dès les premiers tests de charge avec des `PATCH` rapprochés (SQLite n'autorise qu'un seul writer à la fois).

## 6. Problèmes découverts pendant l'analyse (pas anticipés avant)

- **Les images "supprimées" sont quand même téléchargées.** `GET /elements` (`routers/elements.py`) fait `db.query(Element).all()` sans filtrer sur `visible`, et le frontend télécharge et décode le fichier de *tous* les éléments renvoyés, y compris ceux à `visible: false`. Une image "supprimée" continue donc de coûter son poids réseau + ses ~33 Mo de RAM décodée à chaque chargement de page, indéfiniment. Correction simple : filtrer `visible = true` côté requête.
- **`z_index` n'est jamais réellement utilisé.** La colonne existe sur `Element`, mais l'ordre d'affichage ne vient que de la position dans le tableau `loadedElements` côté frontend, jamais persisté. Remettre une image au premier plan puis recharger la page fait perdre ce changement.
- **Aucun retour visuel en cas d'échec réseau.** Les appels `patchElement`/`uploadFile` échoués sont juste passés à `console.error` — invisibles pour l'utilisateur, ce qui va compliquer le diagnostic pendant un test de charge (des `PATCH` peuvent échouer silencieusement).

## 7. Le point bloquant pour tout le reste

**Fait (25 sept)** : `backend/seed.py`, symétrique de `reset.py` — génère N images de test en grille (couleur + numéro visible), écriture directe en base (pas de N requêtes HTTP). 1000 images générées en 3,5s. C'est ce qui a permis de mesurer le point 1 ci-dessus au lieu de le laisser à l'état de conjecture.

## Priorisation retenue (3 jours avant l'échéance)

**Fait (25 sept)** : script de seed, filtrage viewport + `visible = true` côté backend, mesurés (640ms/268 Ko sans filtre → 15ms/4 Ko avec, à 1000 éléments).

**Reste, dans cet ordre :**
1. Le frontend envoie son viewport réel à `GET /elements` (aujourd'hui il demande toujours tout).
2. Debounce des requêtes + déchargement des images hors viewport — sans ces deux-là, la démo viewport s'effondre au premier test réel avec beaucoup d'images.
3. Culling client + `requestAnimationFrame` — peu de code à écrire, effet visible immédiatement.

**Identifié mais volontairement non implémenté, faute de temps :** thumbnails/LOD, index R-Tree, déduplication par hash, PATCH groupé, canvas en couches, dirty rect, verrouillage SQLite concurrent. Objectif pour la soutenance : présenter ces axes comme mesurés et chiffrés, avec la raison du choix de priorisation — préférable à une implémentation à moitié terminée.
