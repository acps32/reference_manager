// ===== Chargement par vue =====
//
// Ne demande au backend que les éléments touchant la zone visible, et décharge ceux qui s'en
// éloignent. Voir docs/Optimisations.md : à 1000 éléments, 242 Ko et 1000 images -> 3,8 Ko et 16.

// Marge de chargement, en proportion de la taille de l'écran : 0.5 = moitié d'écran de chaque côté.
// Les éléments sont donc chargés avant d'entrer à l'écran, et un petit déplacement ne redemande rien.
const VIEWPORT_MARGIN = 0.5;

// Marge de déchargement, volontairement plus large que celle de chargement : avec un seuil unique,
// un élément posé sur la limite serait déchargé puis rechargé en boucle à chaque petit mouvement.
const EVICTION_MARGIN = 2;

// Rectangle visible en coordonnées monde, élargi de `margin` de chaque côté.
function inflatedViewport(margin) {
    const topLeft = screenToWorld(0, 0);
    const width = window.innerWidth / zoom;
    const height = window.innerHeight / zoom;

    return {
        x: topLeft.x - width * margin,
        y: topLeft.y - height * margin,
        width: width * (1 + 2 * margin),
        height: height * (1 + 2 * margin),
    };
}

function getViewportRect() {
    return inflatedViewport(VIEWPORT_MARGIN);
}

// Même test de chevauchement que getElementsInRect (canvas.js) et que le WHERE SQL du backend.
function overlapsRect(element, rect) {
    return (
        element.x < rect.x + rect.width &&
        element.x + element.width > rect.x &&
        element.y < rect.y + rect.height &&
        element.y + element.height > rect.y
    );
}

// Jamais déchargés, même loin de la vue : les retirer casserait la sélection ou le geste en cours,
// puisque selectedElements, dragGroup et editedText contiennent les objets eux-mêmes.
function isProtected(element) {
    return (
        selectedElements.has(element) ||
        dragGroup.includes(element) ||
        element === resizingElement ||
        element === editedText
    );
}

// Ajoute les éléments manquants sans toucher à ceux déjà chargés : ça préserve les références
// d'objets ci-dessus, et réutilise une image déjà décodée au lieu de la retélécharger.
async function mergeElements(rawElements) {
    const knownIds = new Set(loadedElements.map((element) => element.id));
    const missing = rawElements.filter((element) => !knownIds.has(element.id));

    // Promise.all : les images du lot se téléchargent en parallèle, pas l'une après l'autre.
    loadedElements = loadedElements.concat(await Promise.all(missing.map(hydrateElement)));
}

// Sans ça, le filtrage par vue ne fait que retarder le mur mémoire : tout ce qui a été survolé
// depuis l'ouverture de la page resterait décodé en RAM (33 Mo pour une seule image 4K).
function evictOutsideViewport() {
    const rect = inflatedViewport(EVICTION_MARGIN);
    const kept = loadedElements.filter((element) => isProtected(element) || overlapsRect(element, rect));
    const keptIds = new Set(kept.map((element) => element.id));

    for (const element of loadedElements) {
        // Couper la source libère le bitmap décodé tout de suite ; retirer l'objet du tableau ne
        // ferait que le rendre éligible au ramasse-miettes, à un moment qu'on ne choisit pas.
        if (!keptIds.has(element.id) && element.image) element.image.src = "";
    }

    loadedElements = kept;
}

// Dernier agrégat connu du board entier : lu par zoomToFit() (view.js) et par la barre d'état,
// qui ont besoin du total alors que loadedElements n'en contient qu'une partie.
let boardSummary = { count: 0, min_x: null, min_y: null, max_x: null, max_y: null };

async function loadViewport() {
    // En parallèle : l'agrégat est une requête SQL unique et une réponse de quelques octets.
    const [rawElements, summary] = await Promise.all([fetchElements(getViewportRect()), fetchSummary()]);
    boardSummary = summary;

    await mergeElements(rawElements);
    evictOutsideViewport();
    render();
}

// Pendant un pan ou un zoom continu, mousemove se déclenche des centaines de fois par seconde :
// on ne charge que 150 ms après le dernier mouvement, soit une requête par geste au lieu de N.
const VIEWPORT_DEBOUNCE_MS = 150;
let viewportLoadTimer = null;

function scheduleViewportLoad() {
    clearTimeout(viewportLoadTimer);
    viewportLoadTimer = setTimeout(() => {
        loadViewport().catch((error) => console.error(error));
    }, VIEWPORT_DEBOUNCE_MS);
}
