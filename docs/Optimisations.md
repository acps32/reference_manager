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

### Plafond mémoire chiffré (26 sept)

Une image décodée coûte `largeur x hauteur x 4 octets` en RAM, **quelle que soit la compression du fichier sur le disque** : une 4K (3840x2160) pèse 33 Mo décodée, que le JPEG fasse 2 Mo ou 500 Ko. Corollaire important : la compression (WebP/AVIF) optimise le réseau et le disque, jamais la RAM — le LOD est le seul levier sur le coût décodé. (Les navigateurs gardant parfois une copie CPU et une texture GPU, ces chiffres sont un plancher.)

En raisonnant à l'envers depuis ~2 Go utilisables dans un onglet :

| | Sans LOD | Avec LOD (vignette 256px) |
|---|---|---|
| Images 4K | ~60 | 1000+ |
| Images 1080p | ~240 | 1000+ |
| Images « référence » typiques (1500x1000) | ~300 | 1000+ |

Le LOD est donc précisément la frontière entre 60 et 1000 images : pas un polish, mais la décision d'architecture qui fixe la capacité du produit. Coût estimé à une demi-journée : le gros est facile (génération Pillow à l'upload, choix du palier côté client via `element.width * scale`), le pénible est l'échange sans clignotement (charger dans un second objet `Image` et ne remplacer la référence que dans son `onload`) et l'hystérésis sur le seuil, sans quoi ça bascule en boucle.

**Piège pour la démo** : les images du script de seed font 200x200 px, soit 160 Ko en RAM. Une démo à 1000 images générées prouve le point réseau/SQL et le point CPU, **pas** le point mémoire. Pour celui-là il faut quelques vraies images 4K et le calcul ci-dessus — deux démos pour deux arguments.

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

- **N+1 sur l'héritage à tables jointes — TROUVÉ ET CORRIGÉ (26 sept).** `db.query(Element)` ne lit que la table `elements` ; quand `element_to_dict()` accède ensuite à `chemin_fichier` ou `contenu`, SQLAlchemy repart chercher chaque ligne fille une par une. Mesuré sur 1000 éléments : **1001 requêtes SQL, 634 ms**. Corrigé par `with_polymorphic(Element, "*")`, qui demande la jointure des sous-classes dès le départ : **1 requête, 31 ms** — soit 20x sur la base, ~10x de bout en bout en HTTP (630 ms → 65 ms). Le volume transféré ne bouge pas (242 Ko) : c'était un problème de temps serveur, pas de réseau, et le filtrage par viewport reste donc entier. N'apparaissait dans aucune des listes ci-dessus : trouvé en mesurant, pas en relisant le code.
- **PATCH groupé** — déplacer N éléments sélectionnés déclenche actuellement N requêtes `PATCH` séparées (une boucle sur `dragGroup`, voir `main.js`). Un endpoint de mise à jour en masse ramènerait ça à une seule requête/transaction.
- **Index sur `canvas_id` et `visible`.**
- **Verrouillage SQLite en écriture concurrente** ("database is locked") — probable dès les premiers tests de charge avec des `PATCH` rapprochés (SQLite n'autorise qu'un seul writer à la fois).

## 6. Problèmes découverts pendant l'analyse (pas anticipés avant)

- **Les images "supprimées" sont quand même téléchargées.** `GET /elements` (`routers/elements.py`) fait `db.query(Element).all()` sans filtrer sur `visible`, et le frontend télécharge et décode le fichier de *tous* les éléments renvoyés, y compris ceux à `visible: false`. Une image "supprimée" continue donc de coûter son poids réseau + ses ~33 Mo de RAM décodée à chaque chargement de page, indéfiniment. Correction simple : filtrer `visible = true` côté requête.
- **`z_index` n'est jamais réellement utilisé.** La colonne existe sur `Element`, mais l'ordre d'affichage ne vient que de la position dans le tableau `loadedElements` côté frontend, jamais persisté. Remettre une image au premier plan puis recharger la page fait perdre ce changement.
- **Aucun retour visuel en cas d'échec réseau.** Les appels `patchElement`/`uploadFile` échoués sont juste passés à `console.error` — invisibles pour l'utilisateur, ce qui va compliquer le diagnostic pendant un test de charge (des `PATCH` peuvent échouer silencieusement).

## 7. Le point bloquant pour tout le reste

**Fait (26 sept)** : `backend/seed.py`, symétrique de `reset.py` — génère N images numérotées en grille régulière, par écriture directe en base (et non N requêtes HTTP) : 1000 images en 3,6 s. La régularité de la grille est le point important : avec `SPACING = 260`, une vue de 1000x1000 placée à l'origine doit contenir exactement 16 images. C'est ce qui rend le filtrage par viewport *vérifiable* plutôt que seulement plausible.

## Priorisation retenue (2 jours avant l'échéance)

**Fait (26 sept)**, dans cet ordre, chaque étape rendant la suivante mesurable :
1. Script de seed (`seed.py`) — sans jeu de test à la demande, tout le reste serait resté conjectural.
2. Mesure de référence : `GET /elements` à 1000 éléments = 242 Ko, ~630 ms, 1001 requêtes SQL.
3. Correction du N+1 (`with_polymorphic`) : ~630 ms → ~65 ms, à volume transféré inchangé.
4. Filtrage par viewport côté backend (`WHERE` sur x/y/width/height) : 1000 éléments / 242 Ko -> 16 / 3,8 Ko pour une vue de 1000x1000.
5. Le frontend envoie sa vue réelle (`frontend/js/viewport.js`), avec une marge de 50 % pour que les éléments soient chargés avant d'entrer à l'écran.
6. Limitation de fréquence à 150 ms : 300 `mousemove` d'affilée ne déclenchent qu'une requête, contre 300 sans elle.
7. Déchargement des éléments qui s'éloignent, avec `img.src = ""` pour libérer le bitmap décodé sans attendre le ramasse-miettes.

Deux points de conception valent d'être défendus :

- **La fusion n'écrase jamais un élément déjà chargé, elle ajoute seulement les manquants.** `selectedElements`, `dragGroup` et `editedText` contiennent les objets eux-mêmes : les remplacer par des objets neufs casserait silencieusement la sélection et les gestes en cours, et forcerait à redécoder des images déjà en mémoire.
- **La marge de déchargement (2) est bien plus large que celle de chargement (0,5).** Avec un seuil unique, un élément posé sur la limite serait déchargé puis rechargé en boucle à chaque petit mouvement. L'écart entre les deux seuils est ce qui évite ce battement.

8. Rendu coalescé sur la frame, pour le seul `mousemove` (`requestRender`, `canvas.js`) : 100 appels d'affilée ne produisent qu'un rendu. Gain réel surtout sur les souris à haute fréquence d'interrogation, les navigateurs regroupant déjà les `mousemove` par frame dans la plupart des cas. Les 19 autres appels à `render()` restent synchrones — les toucher tous aurait été un risque disproportionné à deux jours de la soutenance.
9. `GET /elements/summary` (agrégat SQL : total et bounding box). Il corrige une régression introduite par le chargement par vue : `zoomToFit()` cadrait sur `loadedElements`, donc sur les seuls éléments proches de la vue, et ne cadrait plus le board. Il alimente aussi le compteur « chargés / total » de la barre d'état, qui rend l'optimisation visible à l'écran pendant la démo.

**Écarté après mesure : le culling côté client.** Il devait éviter le `drawImage` des éléments hors écran, mais `loadedElements` ne contient plus que ce qui est près de la vue : il n'y a presque plus rien à écarter. Le chargement par vue a réglé le problème à la racine, donc l'implémenter n'aurait fait qu'ajouter du code sans gain mesurable.

**Identifié mais volontairement non implémenté, faute de temps :** thumbnails/LOD (chiffré en section 2), index R-Tree, déduplication par hash, PATCH groupé, canvas en couches, dirty rect, verrouillage SQLite concurrent. Objectif pour la soutenance : présenter ces axes comme mesurés et chiffrés, avec la raison du choix de priorisation — préférable à une implémentation à moitié terminée.
