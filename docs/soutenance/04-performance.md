# 04 — Performance : la chaîne complète

C'est ton meilleur atout. Pas parce que l'outil est rapide, mais parce que tu peux raconter une **démarche** : mesurer, corriger, remesurer, et arbitrer ce qu'on ne fait pas.

## Le principe, en une phrase

> Aujourd'hui tout coûte proportionnellement au nombre total d'éléments du board. Or tout devrait coûter proportionnellement à ce qui est visible à l'écran.

Tout le reste en découle. Le tableau à savoir refaire :

| Ressource | Qui paie | Coût de départ | Coût visé |
|---|---|---|---|
| Réseau (JSON) | back → front | tous les éléments | ceux dans la vue |
| Réseau (fichiers images) | back → front | toutes les images | celles dans la vue |
| RAM navigateur | le navigateur | tout ce qui a été survolé depuis l'ouverture | ce qui est dans la vue |
| CPU (`drawImage` par frame) | le navigateur | tous les éléments | ceux dans la vue |

**Ce sont quatre problèmes distincts.** Corriger le premier ne corrige pas le troisième. C'est le point contre-intuitif à faire passer.

## L'ordre de grandeur qui justifie tout

Une image décodée occupe `largeur × hauteur × 4 octets` en RAM (RGBA), **quelle que soit la compression du fichier**.

```
Une image 4K :  3840 × 2160 × 4  =  33 Mo en mémoire
```

33 Mo que le JPEG pèse 2 Mo ou 500 Ko sur le disque. La compression n'existe plus une fois l'image décodée.

**Le corollaire, à savoir dire :** convertir en WebP optimise le réseau et le disque, **jamais** la RAM. Seul le LOD agit sur le coût décodé.

## L'outil qui a tout rendu possible

`backend/seed.py` : génère N images numérotées, disposées en grille régulière, par écriture directe en base. **1000 images en 3,6 secondes.**

Quatre décisions dedans, toutes défendables :

**Écriture directe en base, pas via HTTP.** Passer par `POST /upload` 1000 fois, c'est 1000 requêtes et 1000 transactions, donc des minutes — et ça teste la route d'écriture alors qu'on veut charger la route de lecture.

**Un seul `commit()` après la boucle.** `db.add()` ne parle pas encore à la base. Un commit par ligne, c'est 1000 transactions et 1000 synchronisations disque : l'essentiel du temps d'exécution.

**De vrais fichiers PNG sur le disque.** Sinon le frontend fait 1000 requêtes qui répondent 404 et la mesure ne mesure plus rien de réel.

**Des positions en grille, pas aléatoires.** C'est le point le moins évident et le plus important : avec un espacement régulier, on peut **prédire** combien d'éléments tombent dans un rectangle donné.

> Avec `SPACING = 260`, une vue de 1000 × 1000 contient les colonnes 0, 260, 520 et 780 : quatre colonnes, quatre lignes, donc **16 éléments attendus**.

C'est ce qui permet de dire « j'en attends 16, j'en reçois 16 » au lieu de « ça a l'air de marcher ». Avec des positions aléatoires, aucun nombre attendu, donc aucune vérification possible.

## La mesure de départ

```
GET /elements   ->   1000 éléments   |   242 Ko   |   ~630 ms   |   1001 requêtes SQL
```

Et ce que le navigateur paie en plus du JSON :

```
Fichiers PNG   2,7 Mo     les 1000 images téléchargées
RAM décodée    160 Mo     200 × 200 × 4 octets × 1000
```

## Correction 1 — le N+1

Détail complet en fiche 02. Le résumé :

```
1001 requêtes / 634 ms   ->   1 requête / 31 ms      (with_polymorphic)
~630 ms HTTP             ->   ~65 ms
242 Ko                   ->   242 Ko   (inchangé)
```

**Le point à souligner :** le volume transféré n'a pas bougé. C'était un problème de temps serveur, pas de réseau.

## Correction 2 — le filtrage par viewport (backend)

`GET /elements` accepte un rectangle optionnel et applique le test de chevauchement en SQL.

```
sans paramètres                      1000 éléments   242 510 octets
vue de 1000 × 1000 à l'origine         16 éléments     3 822 octets
```

**La preuve, et c'est ce qu'il faut raconter :** les 16 fichiers renvoyés sont `seed_0000` à `0003`, `0032` à `0035`, `0064` à `0067`, `0096` à `0099`. Quatre blocs de quatre, espacés de 32. C'est exactement le carré 4 × 4 en haut à gauche d'une grille de 32 colonnes.

Pas « 16, ça semble plausible » : **les bons 16**.

Les paramètres sont facultatifs — les quatre ou aucun — pour que la route reste utilisable par un appelant qui n'a pas de notion de vue, et pour pouvoir livrer la moitié backend sans casser le frontend.

## Correction 3 — le frontend envoie sa vue

Le backend savait filtrer, personne ne le lui demandait. `frontend/js/viewport.js` :

```
Chargés au 1er appel        84      et non 1000
```

Deux décisions à défendre.

### La marge de chargement

On demande 50 % d'écran de plus de chaque côté. Les éléments sont donc chargés **avant** d'entrer à l'écran, et un petit déplacement ne redemande rien.

### La fusion n'écrase jamais, elle ajoute

```js
const knownIds = new Set(loadedElements.map((element) => element.id));
const missing = rawElements.filter((element) => !knownIds.has(element.id));
loadedElements = loadedElements.concat(await Promise.all(missing.map(hydrateElement)));
```

**Pourquoi c'est obligatoire.** `selectedElements`, `dragGroup` et `editedText` contiennent **les objets eux-mêmes**, pas leurs identifiants. Remplacer le tableau créerait des objets neufs : la sélection pointerait vers des orphelins, elle disparaîtrait à l'écran et un glisser en cours se casserait.

Deuxième raison : une image déjà décodée doit être réutilisée, pas retéléchargée en revenant sur une zone déjà visitée.

## Correction 4 — la limitation de fréquence

Sans elle, brancher le chargement sur `mousemove` produirait des centaines de requêtes par seconde.

```js
function scheduleViewportLoad() {
    clearTimeout(viewportLoadTimer);
    viewportLoadTimer = setTimeout(() => loadViewport(), VIEWPORT_DEBOUNCE_MS);  // 150 ms
}
```

Chaque appel annule le précédent : seul le dernier mouvement déclenche réellement le chargement.

```
300 mousemove d'affilée   ->   0 requête immédiate, puis 1 seule
```

## Correction 5 — le déchargement

**Le point le plus contre-intuitif du projet, et le meilleur à raconter.**

> Sans déchargement, le filtrage par viewport ne fait que **retarder** le mur mémoire, il ne l'évite pas.

Tout ce qui a été survolé depuis l'ouverture de la page reste décodé en RAM. On charge moins d'un coup, mais on accumule quand même.

```js
if (!keptIds.has(element.id) && element.image) element.image.src = "";
```

**Pourquoi couper la source.** Retirer l'objet du tableau le rend seulement *éligible* au ramasse-miettes, à un moment qu'on ne choisit pas. Couper `src` libère le bitmap décodé tout de suite.

### Les deux marges, et l'hystérésis

```
marge de chargement    0,5 écran
marge de déchargement  2 écrans
```

**Ce n'est pas une valeur au hasard.** Avec un seuil unique, un élément posé pile sur la limite serait déchargé puis rechargé à chaque micro-mouvement. L'écart entre les deux seuils est ce qui empêche ce battement.

C'est le même principe qu'un thermostat : on ne chauffe pas et on n'arrête pas à la même température.

### Les protégés

Un élément sélectionné, glissé, redimensionné ou en cours d'édition n'est **jamais** déchargé, même très loin de la vue. Sinon : tu sélectionnes une image, tu pars ailleurs, et ta sélection pointe vers un objet libéré.

### La vérification

```
Retour à l'origine                   135
Après un saut de 20 000 px             1      et non 135 + les nouveaux
L'élément sélectionné survit ?       oui
Un élément non protégé est libéré ?  oui
Son image est-elle libérée ?         oui
```

## Correction 6 — le rendu coalescé

`render()` était appelé de façon synchrone à chaque `mousemove`, ce qui peut redessiner plusieurs fois entre deux rafraîchissements d'écran réels.

```js
function requestRender() {
    if (renderRequested) return;
    renderRequested = true;
    requestAnimationFrame(() => { renderRequested = false; render(); });
}
```

Le drapeau est tout le mécanisme : si un rendu est déjà programmé pour la prochaine frame, les appels suivants ne font rien.

```
100 requestRender() d'affilée   ->   1 rendu
```

**Sois honnête sur le gain :** les navigateurs regroupent déjà les `mousemove` par frame dans la plupart des cas. Le gain devient réel sur une souris à haute fréquence d'interrogation (500 ou 1000 Hz), courante chez les gens qui dessinent.

**Et sur la portée :** un seul des 20 appels à `render()` passe par là, celui du `mousemove`. Les 19 autres se déclenchent une fois par clic et restent synchrones. Toucher les 20 la veille de la démo aurait été un risque disproportionné pour aucun gain supplémentaire.

## La régression trouvée en relisant

Le chargement par vue a cassé `zoomToFit()`, qui calculait ses limites à partir de `loadedElements` — devenu un sous-ensemble. « Cadrer sur le contenu » cadrait sur les quelques dizaines d'éléments chargés au lieu du board.

**La correction :** une route `GET /elements/summary` qui renvoie le total et la bounding box en un agrégat SQL.

Et elle a servi deux fois : la barre d'état affiche désormais **« 84 / 1000 éléments »**. Le premier nombre suit la vue, le second ne bouge pas. C'est ton optimisation rendue visible à l'écran pendant la démo.

**Ce que ça dit de la méthode :** une optimisation qui change ce qui est chargé change aussi tout ce qui raisonnait sur « tout ». Il a fallu relire les autres consommateurs de `loadedElements` pour la trouver.

## Ce qui a été écarté après mesure

**Le culling côté client.** Il devait éviter le `drawImage` des éléments hors écran. Mais `loadedElements` ne contient plus que ce qui est près de la vue : il n'y a presque plus rien à écarter.

Le chargement par vue a réglé le problème à la racine. L'implémenter aurait ajouté du code sans gain mesurable. C'est noté « abandonné » dans le backlog, pas « à faire ».

**La phrase à retenir :** *« choisir de ne pas faire, après mesure, vaut mieux que faire pour cocher. »*

## Ce qui est identifié, chiffré, et volontairement non fait

### Le LOD — le plus gros levier

Une image 4K affichée dans un cadre de 200 × 200 px n'a aucune raison d'être en 4K en mémoire.

| | RAM par image | 1000 images |
|---|---|---|
| 4K brut | 33 Mo | 33 Go |
| Vignette 256 px | 262 Ko | 262 Mo |

**Le rapport est de ~125×.** En raisonnant à l'envers depuis ~2 Go utilisables dans un onglet :

| | Sans LOD | Avec LOD |
|---|---|---|
| Images 4K | ~60 | 1000+ |
| Images 1080p | ~240 | 1000+ |

> Le LOD est précisément la frontière entre 60 et 1000 images. Ce n'est pas du polish, c'est la décision d'architecture qui fixe la capacité du produit.

**Pourquoi il n'est pas fait, et la réponse à donner :**

> « La génération des vignettes à l'upload, c'est une demi-heure avec Pillow et zéro risque. C'est l'affichage qui coûte : choisir le palier selon la taille à l'écran, échanger l'image sans clignotement, et poser une hystérésis sur le seuil. Ça touche le rendu et le zoom, soit exactement ce que vous allez manipuler. J'ai préféré livrer le chargement par vue, mesuré et stable, plutôt que deux optimisations à moitié fiables. »

### Les autres

Index R-Tree (SQLite en a un nativement, pour les recherches 2D), déduplication par hash à l'upload, PATCH groupé (déplacer N éléments fait aujourd'hui N requêtes), canvas en couches séparées, dirty rect, verrouillage SQLite en écriture concurrente.

Tous listés dans `docs/Optimisations.md` avec leur raison.

## Le piège à ne pas tendre au jury

Les images du script de seed font 200 × 200 px, soit 160 Ko en RAM chacune.

**Une démo à 1000 images générées prouve le point réseau/SQL et le point CPU, pas le point mémoire.** Ne laisse pas croire l'inverse : c'est exactement ce qu'un examinateur attentif relèvera.

Le propre, c'est **deux démos pour deux arguments** : les 1000 images générées pour le viewport et les requêtes, puis quelques vraies images 4K pour parler du plafond mémoire, calcul à l'appui.
