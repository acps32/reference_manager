// ===== État partagé de l'interaction =====
//
// Regroupé ici parce que ces variables sont lues et écrites par plusieurs
// modules (pointer.js, transform.js, context-menu.js...). Les scripts étant
// chargés en <script> classiques, elles forment un état global commun : ce
// fichier doit donc être chargé AVANT tout code qui s'exécute et les lit.

let isPanning = false; // true pendant un glisser au bouton du milieu (déplacement de la caméra, pas d'un élément)
let lastX = 0; // dernière position souris (écran) connue, pour calculer le delta au prochain mousemove
let lastY = 0;
let draggedElement = null; // élément sous le curseur au début du glisser au bouton gauche, ou null si aucun
let dragGroup = []; // tous les éléments qui bougent ensemble pendant ce glisser (draggedElement + le reste de la sélection si elle en fait partie, sinon juste draggedElement)
let dragStartPositions = new Map(); // position d'origine de chaque élément de dragGroup avant le glisser, pour savoir si ça a bougé et pour l'undo
let selectedElements = new Set(); // éléments actuellement sélectionnés (outline dans drawElements, voir canvas.js)
let isSelecting = false; // true quand on est en train de faire une sélection
let selectStartX = 0;
let selectStartY = 0;
let dragOriginX = 0; // position souris au mousedown, jamais mise à jour ensuite (contrairement à lastX/Y) - sert à mesurer la distance parcourue depuis le début du geste
let dragOriginY = 0;
let resizingElement = null; // élément en cours de redimensionnement, ou null
let resizeHandle = null; // "nw"/"ne"/"sw"/"se" : quel coin on tire
let resizeStartBounds = null; // { x, y, width, height } avant le redimensionnement, pour l'undo
let resizingGroup = false; // true pendant un redimensionnement de groupe (cadre de sélection multiple)
let groupResizeHandle = null;
let groupResizeStartBounds = null; // bounding box du groupe avant le redimensionnement (voir getGroupBoundingBox)
let groupResizeStartPositions = new Map(); // position/taille d'origine de chaque élément du groupe, pour recalculer proportionnellement
