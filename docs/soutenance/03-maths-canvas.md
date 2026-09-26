# 03 — Les maths du canevas

C'est la fiche sur laquelle on va te pousser le plus, parce que c'est là qu'on voit si tu as écrit le code ou copié une recette. Tout découle de **deux formules**.

## 1. Les deux repères

Il y a deux systèmes de coordonnées, et tout le projet consiste à passer de l'un à l'autre.

**Le monde** : le plan infini où vivent les éléments. Une image stockée à `x = 1500` y reste, quels que soient le zoom et le déplacement. C'est ce qui est en base.

**L'écran** : les pixels de la fenêtre. Dépend entièrement de la caméra.

La caméra tient en trois nombres, dans `canvas.js` :

```js
let offsetX = 0;   // décalage du pan, en pixels ÉCRAN
let offsetY = 0;
let zoom = 1;      // 1 = échelle réelle
```

**Attention au piège :** `offsetX` est en pixels **écran**, pas en unités monde. C'est une question possible.

### Les deux formules

```js
function screenToWorld(screenX, screenY) {
    return { x: (screenX - offsetX) / zoom,
             y: (screenY - offsetY) / zoom };
}

function worldToScreen(worldX, worldY) {
    return { x: worldX * zoom + offsetX,
             y: worldY * zoom + offsetY };
}
```

Elles sont exactement inverses l'une de l'autre. Tu dois savoir le montrer au tableau :

```
worldToScreen(screenToWorld(S))  =  ((S - o) / z) * z + o  =  S - o + o  =  S
```

### Qui utilise quoi

- **`screenToWorld`** : à chaque fois qu'on part d'un événement souris. « Sur quel point du monde je clique ? » Utilisée au clic, au dépôt d'un fichier, au collage, à l'édition de texte.
- **`worldToScreen`** : au dessin. « Où dois-je peindre cet élément ? »

### Pourquoi stocker en coordonnées monde

Parce que les positions ne doivent pas dépendre de la caméra. Si on stockait en pixels écran, zoomer changerait les données en base. C'est la même raison qu'en cartographie : la carte a des coordonnées, la vue en a d'autres.

## 2. Le pan

```js
offsetX += event.clientX - lastX;
offsetY += event.clientY - lastY;
```

On ajoute le déplacement de la souris à l'offset. Pas de division par `zoom` : les deux sont en pixels écran.

`lastX`/`lastY` sont mis à jour à chaque `mousemove`, d'où un déplacement **relatif** à chaque frame.

## 3. Le zoom centré sur le curseur — à savoir démontrer

Le plus intéressant du projet. Zoomer naïvement (changer `zoom` et rien d'autre) fait dériver l'image vers le coin de l'écran. Ce qu'on veut, c'est que **le point du monde sous le curseur ne bouge pas**.

### La démonstration

Soit `S` la position écran du curseur, `z₀`/`o₀` l'état avant, `z₁`/`o₁` l'état après.

**1. Le point du monde actuellement sous le curseur :**
```
W = (S − o₀) / z₀
```

**2. La condition qu'on impose :** après le zoom, ce même `W` doit retomber sur `S`.
```
S = W × z₁ + o₁
```

**3. On isole le nouvel offset :**
```
o₁ = S − W × z₁
```

### Et c'est exactement le code

```js
const worldBeforeZoom = screenToWorld(event.clientX, event.clientY);   // W
zoom = newZoom;                                                        // z₁
offsetX = event.clientX - worldBeforeZoom.x * zoom;                    // o₁
offsetY = event.clientY - worldBeforeZoom.y * zoom;
```

**L'ordre est critique :** il faut calculer `W` **avant** de modifier `zoom`, sinon on mesure avec le mauvais facteur.

Le facteur est multiplicatif (`× 1.1` ou `÷ 1.1` par cran) et non additif, pour que le zoom paraisse régulier à toutes les échelles. Il est borné entre 0,1 et 5.

## 4. La grille

```js
const step = GRID_SIZE * zoom;      // espacement à l'écran entre deux lignes
const startX = offsetX % step;      // le décalage de phase
```

### Pourquoi le modulo

Les lignes de la grille sont à `x = k × GRID_SIZE` dans le monde, pour tout entier `k`. À l'écran, elles tombent donc à :

```
k × GRID_SIZE × zoom + offsetX   =   k × step + offsetX
```

Toutes ces positions sont **congrues à `offsetX` modulo `step`**. Donc partir de `offsetX % step` et avancer de `step` en `step` tombe exactement sur les bonnes lignes.

**Ce que ça règle concrètement :** sans le modulo, la grille repartirait du bord de l'écran à chaque frame et semblerait glisser sous les images au lieu d'être accrochée au monde.

**Détail à connaître :** en JavaScript, `%` garde le signe du dividende. Si `offsetX` est négatif, `startX` l'est aussi, la boucle démarre légèrement hors écran à gauche et dessine une ligne de plus. Le résultat reste juste.

### Les lignes sont dessinées en un seul tracé

```js
ctx.beginPath();
for (...) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
for (...) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
ctx.stroke();
```

Un seul `beginPath()` / `stroke()` pour toutes les lignes. `moveTo` lève le crayon, `lineTo` trace. Faire un `stroke()` par ligne coûterait bien plus cher.

`lineWidth = 0.5` : à 1, le trait faisait un pixel écran plein, trop épais pour le contraste voulu.

## 5. Le devicePixelRatio

```js
const dpr = window.devicePixelRatio || 1;
canvas.width = window.innerWidth * dpr;      // pixels PHYSIQUES
canvas.height = window.innerHeight * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);      // puis on dessine en pixels CSS
```

Un `<canvas>` a deux tailles : son nombre de pixels (`width`/`height`) et sa taille d'affichage (CSS). Sur un écran haute densité, un pixel CSS vaut 2 ou 3 pixels physiques.

Sans ça, le navigateur étire un canevas de 1920 pixels sur 3840 pixels physiques : la grille et le texte sont flous.

La solution : allouer en pixels physiques, puis appliquer une matrice d'échelle `dpr` **une fois pour toutes**. Tout le reste du code continue de raisonner en pixels CSS sans le savoir.

Les six arguments de `setTransform(a, b, c, d, e, f)` sont une matrice affine 2D : `a`/`d` l'échelle, `b`/`c` le cisaillement, `e`/`f` la translation.

## 6. Le test de chevauchement — utilisé à trois endroits

La même formule sert au rectangle de sélection, au filtrage par viewport côté frontend, et au `WHERE` SQL côté backend.

```js
element.x < rect.x + rect.width &&
element.x + element.width > rect.x &&
element.y < rect.y + rect.height &&
element.y + element.height > rect.y
```

### La démonstration

C'est plus simple à l'envers : **quand deux rectangles ne se touchent-ils pas ?**

Dans exactement quatre cas : l'un est entièrement à gauche, entièrement à droite, entièrement au-dessus, ou entièrement en dessous de l'autre.

Ils se chevauchent donc quand **aucun** des quatre n'est vrai. En niant chacun, on obtient les quatre conditions ci-dessus, qui doivent être vraies simultanément.

Lis la première : « le bord gauche de l'élément est avant le bord droit de la zone ». Si c'était faux, l'élément commencerait après la fin de la zone — donc entièrement à droite.

**Le point fort à mentionner :** cette formule est écrite trois fois dans trois langages (JS pour la sélection, JS pour le viewport, SQL pour le backend) et c'est exactement la même. Ce n'est pas de la duplication accidentelle, c'est la même question posée à trois endroits.

## 7. Le clic : quel élément est dessous

```js
for (let i = loadedElements.length - 1; i >= 0; i--) { ... }
```

**Parcours à l'envers**, et c'est volontaire. `drawElements()` dessine du premier au dernier, donc le **dernier du tableau est affiché au-dessus**. En cas de superposition, c'est lui qu'il faut trouver en premier.

Le test lui-même est un simple « le point est-il dans le rectangle », en coordonnées monde.

## 8. Le redimensionnement à proportions bloquées

Le plus mathématique du frontend. Poignées aux quatre coins seulement : les proportions étant bloquées, étirer un seul côté n'aurait pas de sens.

### L'ancre

```js
const anchorX = handle.includes("w") ? start.x + start.width : start.x;
const anchorY = handle.includes("n") ? start.y + start.height : start.y;
```

Le coin **opposé** à celui qu'on tire reste fixe. Tirer le coin nord-ouest ancre le coin sud-est.

### La projection

Le problème : la souris ne suit jamais exactement la diagonale. Il faut en déduire un facteur d'échelle unique.

```js
const originalDX = (handle.includes("w") ? -1 : 1) * start.width;   // vecteur d
const originalDY = (handle.includes("n") ? -1 : 1) * start.height;
const currentDX = worldPos.x - anchorX;                             // vecteur c
const currentDY = worldPos.y - anchorY;

const lengthSquared = originalDX ** 2 + originalDY ** 2;            // |d|²
let scale = (currentDX * originalDX + currentDY * originalDY) / lengthSquared;
```

`currentDX × originalDX + currentDY × originalDY` est le **produit scalaire** `c · d`. Divisé par `|d|²`, il donne le coefficient de la **projection orthogonale** de `c` sur `d`.

Autrement dit : « si je projette la position de ma souris sur la diagonale d'origine, à quelle fraction de cette diagonale suis-je ? » C'est exactement le facteur d'échelle qui conserve le ratio.

Ensuite : `width = start.width × scale`, `height = start.height × scale`, et pour un texte la police suit aussi, sinon agrandir le cadre laisserait le texte à sa taille.

Un plancher (`MIN_ELEMENT_SIZE = 20`) empêche de réduire à zéro ou de passer en négatif.

## 9. La symétrie

```js
ctx.save();
ctx.translate(centerX, centerY);
ctx.scale(flip_horizontal ? -1 : 1, flip_vertical ? -1 : 1);
ctx.drawImage(element.image, -width / 2, -height / 2, width, height);
ctx.restore();
```

Une échelle négative retourne, mais **autour de l'origine du repère**. On déplace donc l'origine au centre de l'image (`translate`), on retourne, et on dessine centré sur cette nouvelle origine (`-width/2`).

**Pourquoi autour du centre :** `x`, `y`, `width`, `height` ne changent pas. Le clic, la sélection et le redimensionnement continuent de fonctionner sans rien savoir de la symétrie. Elle est purement visuelle.

`save()`/`restore()` empilent et dépilent l'état du contexte. Sans eux, la transformation resterait active pour tout ce qui est dessiné ensuite.

## 10. Le texte

Le canevas **ne sait pas revenir à la ligne**. Il faut le faire soi-même, dans `text-layout.js`.

```js
for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else { lines.push(current); current = word; }
}
```

On ajoute les mots un par un et on mesure. Dès que ça dépasse, on ferme la ligne. `contenu.split("\n")` d'abord, pour respecter les retours à la ligne saisis.

Un mot plus long que le cadre déborde : on ne le coupe pas au milieu.

**Le bloc entier est centré verticalement**, pas chaque ligne indépendamment — sinon un texte de trois lignes serait décentré.

**Piège du contexte 2D :** `textAlign` et `textBaseline` sont des états **persistants**. Après avoir dessiné un texte centré, il faut les remettre à `"left"` / `"alphabetic"`, sinon tout ce qui est dessiné ensuite hérite du réglage.

## 11. Le piège de l'ordre de chargement

Les 17 scripts sont chargés en `<script defer>` classiques, donc ils partagent **un seul espace global**. `canvas.js` peut appeler `updateStatusBar()` sans rien déclarer, parce que `status-bar.js` l'a déposée dans le global.

**Conséquence : l'ordre des balises dans `index.html` est significatif.** Une variable `let` lue avant l'exécution de sa déclaration lève une `ReferenceError` — c'est la *zone morte temporelle* (TDZ).

C'est arrivé deux fois : `isSelecting is not defined` (un `render()` s'exécutait avant les déclarations d'état) et `Identifier 'THEME' has already been declared` (deux fichiers déclaraient la même constante).

**La réponse à donner si on te pousse :** *« la vraie correction, ce sont les modules ES avec `import`/`export`, où chaque fichier a sa portée et où l'ordre cesse de compter. Je ne l'ai pas fait parce que ça demande une chaîne de build et que ce n'était pas le moment. »* Voir fiche 06.
