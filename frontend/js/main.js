// ===== Variable d'états =====

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

resizeCanvas();
render();

// Le chargement est asynchrone (fetch + Image.onload pour les images, voir
// api.js) : le premier render() ci-dessus dessine juste la grille, celui-ci
// rajoute les éléments une fois qu'ils sont réellement prêts.
loadAllElements()
    .then((elements) => {
        loadedElements = elements;
        render();
    })
    .catch((error) => {
        console.error(error);
    });

window.addEventListener("resize", () => {
    resizeCanvas();
    render();
});

// Pile d'annulation (Ctrl+Z) et de rétablissement (Ctrl+Y) : chaque entrée
// est une ACTION complète (un tableau de { image: element, previous }), pas
// un élément individuel - sinon annuler une suppression de 10 éléments
// demanderait 10 Ctrl+Z.
let undoStack = [];
let redoStack = [];

function pushUndo(changes) {
    undoStack.push(changes);
    redoStack = []; // une nouvelle action invalide l'historique de rétablissement
}

// Applique `changes` (venant de fromStack) et pousse l'inverse dans
// toStack - undo() et redo() sont exactement la même opération, juste
// dans des directions opposées.
async function applyChanges(fromStack, toStack) {
    if (fromStack.length === 0) return;

    const changes = fromStack.pop();
    const inverse = changes.map(({ image, previous }) => {
        const current = {};
        for (const key in previous) current[key] = image[key];
        return { image, previous: current };
    });
    toStack.push(inverse);

    for (const { image, previous } of changes) {
        Object.assign(image, previous);
    }
    render();

    await Promise.all(
        changes.map(({ image, previous }) =>
            patchElement(image.id, previous).catch((error) => console.error(error))
        )
    );
}

function undo() {
    return applyChanges(undoStack, redoStack);
}

function redo() {
    return applyChanges(redoStack, undoStack);
}

async function deleteElements(elements) {
    const targets = [...elements]; // copie : on va modifier selectedElements pendant la boucle
    if (targets.length === 0) return;

    pushUndo(targets.map((element) => ({ image: element, previous: { visible: true } })));
    for (const element of targets) {
        element.visible = false;
        selectedElements.delete(element);
    }

    render();

    await Promise.all(
        targets.map((element) =>
            patchElement(element.id, { visible: false }).catch((error) => console.error(error))
        )
    );
}

async function copyElementToClipboard(element) {
    if (element.type === "texte") {
        await navigator.clipboard.writeText(element.contenu);
        return;
    }

    // Image : passe par un canvas hors-écran pour forcer du PNG - c'est le
    // seul format que l'API Clipboard garantit de savoir écrire, peu importe
    // le format d'origine du fichier (jpg, gif...). element.image est déjà
    // chargé (voir loadImage() dans api.js), pas besoin de re-fetch.
    const offscreen = document.createElement("canvas");
    offscreen.width = element.image.naturalWidth;
    offscreen.height = element.image.naturalHeight;
    offscreen.getContext("2d").drawImage(element.image, 0, 0);

    const blob = await new Promise((resolve) => offscreen.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

const MIN_ELEMENT_SIZE = 20; // en unités du monde ; empêche de réduire à 0 ou en négatif

// Redimensionne `element` en tirant `handle`, proportions bloquées (un seul
// facteur d'échelle pour width ET height). Le coin OPPOSÉ à la poignée tirée
// reste fixe pendant toute l'opération - c'est l'ancre du calcul.
function resizeElement(element, handle, start, worldPos) {
    const anchorX = handle.includes("w") ? start.x + start.width : start.x;
    const anchorY = handle.includes("n") ? start.y + start.height : start.y;

    // Vecteur ancre -> poignée tirée, à l'état d'origine (la diagonale de référence).
    const originalDX = (handle.includes("w") ? -1 : 1) * start.width;
    const originalDY = (handle.includes("n") ? -1 : 1) * start.height;

    // Vecteur ancre -> souris actuelle, projeté sur la diagonale d'origine :
    // donne le facteur d'échelle qui garde le ratio, peu importe où exactement
    // la souris se trouve par rapport à cette diagonale.
    const currentDX = worldPos.x - anchorX;
    const currentDY = worldPos.y - anchorY;
    const lengthSquared = originalDX * originalDX + originalDY * originalDY;
    let scale = (currentDX * originalDX + currentDY * originalDY) / lengthSquared;
    scale = Math.max(scale, MIN_ELEMENT_SIZE / Math.min(start.width, start.height));

    element.width = start.width * scale;
    element.height = start.height * scale;
    element.x = handle.includes("w") ? anchorX - element.width : anchorX;
    element.y = handle.includes("n") ? anchorY - element.height : anchorY;
}

// Redimensionne tout le groupe autour de son CENTRE (pas d'un coin opposé,
// contrairement à resizeElement) : chaque élément grandit/rétrécit ET
// s'éloigne/se rapproche du centre, ensemble, en gardant leurs positions
// relatives - comme un zoom appliqué à toute la sélection.
function resizeGroup(handle, startBounds, startPositions, worldPos) {
    const centerX = (startBounds.minX + startBounds.maxX) / 2;
    const centerY = (startBounds.minY + startBounds.maxY) / 2;
    const halfWidth = (startBounds.maxX - startBounds.minX) / 2;
    const halfHeight = (startBounds.maxY - startBounds.minY) / 2;

    // Vecteur centre -> coin tiré, à l'état d'origine (la diagonale de référence).
    const originalDX = (handle.includes("w") ? -1 : 1) * halfWidth;
    const originalDY = (handle.includes("n") ? -1 : 1) * halfHeight;

    // Même principe de projection que resizeElement, mais depuis le centre.
    const currentDX = worldPos.x - centerX;
    const currentDY = worldPos.y - centerY;
    const lengthSquared = originalDX * originalDX + originalDY * originalDY;
    let scale = (currentDX * originalDX + currentDY * originalDY) / lengthSquared;

    // Aucun élément du groupe ne doit descendre sous MIN_ELEMENT_SIZE.
    const smallestDimension = Math.min(...[...startPositions.values()].flatMap((start) => [start.width, start.height]));
    scale = Math.max(scale, MIN_ELEMENT_SIZE / smallestDimension);

    for (const [element, start] of startPositions) {
        element.x = centerX + (start.x - centerX) * scale;
        element.y = centerY + (start.y - centerY) * scale;
        element.width = start.width * scale;
        element.height = start.height * scale;
    }
}

// Applique directement un facteur d'échelle à toute la sélection actuelle
// (1 ou plusieurs éléments), depuis le centre de sa bounding box - même
// calcul que resizeGroup, mais déclenché par les boutons +/- du panneau
// plutôt que par un glisser de souris.
function scaleSelection(factor) {
    if (selectedElements.size === 0) return;

    const { minX, minY, maxX, maxY } = getGroupBoundingBox();
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const startPositions = new Map(
        [...selectedElements].map((element) => [element, { x: element.x, y: element.y, width: element.width, height: element.height }])
    );

    let scale = factor;
    if (factor < 1) {
        const smallestDimension = Math.min(...[...startPositions.values()].flatMap((start) => [start.width, start.height]));
        scale = Math.max(factor, MIN_ELEMENT_SIZE / smallestDimension);
    }

    for (const [element, start] of startPositions) {
        element.x = centerX + (start.x - centerX) * scale;
        element.y = centerY + (start.y - centerY) * scale;
        element.width = start.width * scale;
        element.height = start.height * scale;
    }

    pushUndo([...startPositions].map(([element, start]) => ({ image: element, previous: start })));
    for (const [element] of startPositions) {
        patchElement(element.id, { x: element.x, y: element.y, width: element.width, height: element.height }).catch((error) => console.error(error));
    }
    render();
}

// axis: "flip_horizontal" ou "flip_vertical". Ne touche qu'aux images de la
// sélection (les textes n'ont pas de symétrie) - x/y/width/height ne
// changent pas, seul le booléen bascule (voir drawElements, canvas.js).
function flipSelection(axis) {
    const images = [...selectedElements].filter((element) => element.type === "image");
    if (images.length === 0) return;

    pushUndo(images.map((element) => ({ image: element, previous: { [axis]: element[axis] } })));
    for (const element of images) {
        element[axis] = !element[axis];
        patchElement(element.id, { [axis]: element[axis] }).catch((error) => console.error(error));
    }
    render();
}

// Principe : mousedown ne fait jamais que PRÉVISUALISER un glisser (quel
// groupe bouge, à quelle position de départ). La sélection elle-même n'est
// tranchée qu'au mouseup, une fois qu'on sait si un vrai glisser a eu lieu
// ou si ce n'était qu'un clic - une seule décision, à un seul endroit.
const CLICK_MOVE_THRESHOLD = 4; // pixels écran ; en-dessous, un tremblement de main compte comme un clic, pas un glisser

canvas.addEventListener("mousedown", (event) => {
    lastX = event.clientX;
    lastY = event.clientY;
    dragOriginX = event.clientX;
    dragOriginY = event.clientY;

    if (event.button === 1) { // clic molette : déplace la caméra
        isPanning = true;
        return;
    }
    if (event.button === 2) { // clic droit : ouvre le menu en pie (voir plus bas)
        const worldPos = screenToWorld(event.clientX, event.clientY);
        contextMenuWorldPos = worldPos;
        contextMenuTarget = getElementAt(worldPos.x, worldPos.y);
        openPieMenu(event.clientX, event.clientY);
        return;
    }
    if (event.button !== 0) return;

    const groupHandle = getGroupResizeHandleAt(event.clientX, event.clientY);
    if (groupHandle) {
        resizingGroup = true;
        groupResizeHandle = groupHandle;
        groupResizeStartBounds = getGroupBoundingBox();
        groupResizeStartPositions = new Map(
            [...selectedElements].map((element) => [element, { x: element.x, y: element.y, width: element.width, height: element.height }])
        );
        return;
    }

    const handleHit = getResizeHandleAt(event.clientX, event.clientY);
    if (handleHit) {
        resizingElement = handleHit.element;
        resizeHandle = handleHit.handle;
        resizeStartBounds = {
            x: resizingElement.x,
            y: resizingElement.y,
            width: resizingElement.width,
            height: resizingElement.height,
        };
        return;
    }

    const worldPos = screenToWorld(event.clientX, event.clientY);
    draggedElement = getElementAt(worldPos.x, worldPos.y);

    if (draggedElement) {
        // Déjà sélectionné -> tout le groupe bouge ; sinon, lui seul.
        dragGroup = selectedElements.has(draggedElement) ? [...selectedElements] : [draggedElement];
        dragStartPositions = new Map(dragGroup.map((element) => [element, { x: element.x, y: element.y }]));

        // Auto-avant-plan : tout le groupe passe en fin de tableau (dessiné
        // en dernier = affiché au-dessus), en gardant son ordre relatif.
        loadedElements = loadedElements.filter((element) => !dragGroup.includes(element)).concat(dragGroup);
    } else {
        if (!event.shiftKey) selectedElements.clear(); // clic sur le vide : remplace la sélection (Maj = additif)
        isSelecting = true;
        selectStartX = event.clientX;
        selectStartY = event.clientY;
    }

    render();
});

// Écoutés sur window (pas canvas) pour continuer le pan/glisser même si le curseur sort du canvas.
window.addEventListener("mousemove", (event) => {
    if (pieMenuOpen) updatePieHover(event.clientX, event.clientY);

    if (isPanning) {
        offsetX += event.clientX - lastX;
        offsetY += event.clientY - lastY;
    } else if (resizingGroup) {
        const worldPos = screenToWorld(event.clientX, event.clientY);
        resizeGroup(groupResizeHandle, groupResizeStartBounds, groupResizeStartPositions, worldPos);
    } else if (resizingElement) {
        const worldPos = screenToWorld(event.clientX, event.clientY);
        resizeElement(resizingElement, resizeHandle, resizeStartBounds, worldPos);
    } else if (draggedElement) {
        const dx = (event.clientX - lastX) / zoom;
        const dy = (event.clientY - lastY) / zoom;
        for (const element of dragGroup) {
            element.x += dx;
            element.y += dy;
        }

        if (snapEnabled && !event.altKey) {
            // Aligne l'élément cliqué sur la grille, et applique le même
            // ajustement au reste du groupe pour garder leurs espacements relatifs.
            const adjustX = Math.round(draggedElement.x / GRID_SIZE) * GRID_SIZE - draggedElement.x;
            const adjustY = Math.round(draggedElement.y / GRID_SIZE) * GRID_SIZE - draggedElement.y;
            for (const element of dragGroup) {
                element.x += adjustX;
                element.y += adjustY;
            }
        }
    } else if (isSelecting) {
        // rien à faire ici : lastX/lastY (mis à jour plus bas) et render() suffisent, drawSelectionBox() lit directement lastX/Y
    } else {
        // Rien en cours : juste indiquer via le curseur qu'une poignée (groupe ou seule) est survolable.
        const handle = getGroupResizeHandleAt(event.clientX, event.clientY) || getResizeHandleAt(event.clientX, event.clientY)?.handle;
        canvas.style.cursor = handle ? (handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize") : "";
        return;
    }

    lastX = event.clientX;
    lastY = event.clientY;
    render();
});

window.addEventListener("mouseup", (event) => {
    isPanning = false;

    if (event.button === 2 && pieMenuOpen) {
        const distance = Math.hypot(event.clientX - pieCenterX, event.clientY - pieCenterY);
        // Entre la zone morte et la distance max : geste presser-glisser-relâcher,
        // on valide directement l'item survolé. En dessous : simple appui bref, le
        // menu reste ouvert pour un clic explicite (voir listener "click"). Au-delà
        // de PIE_MAX_RADIUS : trop loin, pieHoveredItem est déjà null (voir updatePieHover).
        if (distance > PIE_DEADZONE && distance <= PIE_MAX_RADIUS && pieHoveredItem) {
            selectPieAction(pieHoveredItem.dataset.action);
            closePieMenu();
        }
        return;
    }

    if (resizingGroup) {
        const changed = [...groupResizeStartPositions].some(
            ([element, start]) => element.x !== start.x || element.y !== start.y || element.width !== start.width || element.height !== start.height
        );
        if (changed) {
            pushUndo([...groupResizeStartPositions].map(([element, start]) => ({ image: element, previous: start })));
            for (const [element] of groupResizeStartPositions) {
                patchElement(element.id, { x: element.x, y: element.y, width: element.width, height: element.height }).catch((error) => console.error(error));
            }
        }
        resizingGroup = false;
        groupResizeHandle = null;
        render();
        return;
    }

    if (resizingElement) {
        const changed = resizingElement.width !== resizeStartBounds.width || resizingElement.height !== resizeStartBounds.height;
        if (changed) {
            pushUndo([{ image: resizingElement, previous: resizeStartBounds }]);
            patchElement(resizingElement.id, {
                x: resizingElement.x,
                y: resizingElement.y,
                width: resizingElement.width,
                height: resizingElement.height,
            }).catch((error) => console.error(error));
        }
        resizingElement = null;
        resizeHandle = null;
        render();
        return;
    }

    if (draggedElement) {
        const distance = Math.hypot(event.clientX - dragOriginX, event.clientY - dragOriginY);
        const moved = distance > CLICK_MOVE_THRESHOLD;

        if (moved) {
            // Vrai glisser : si l'élément n'était pas déjà sélectionné, il
            // devient la seule sélection (il a bougé seul).
            if (!selectedElements.has(draggedElement)) selectedElements = new Set([draggedElement]);

            pushUndo(dragGroup.map((element) => ({ image: element, previous: dragStartPositions.get(element) })));
            for (const element of dragGroup) {
                patchElement(element.id, { x: element.x, y: element.y }).catch((error) => console.error(error));
            }
        } else {
            // Sous le seuil : un tremblement, pas un glisser - on annule le
            // micro-déplacement visuel (sinon la position dérive un peu à
            // chaque clic) et on traite comme un clic simple.
            for (const element of dragGroup) Object.assign(element, dragStartPositions.get(element));

            if (event.shiftKey) {
                // Clic simple, Maj : bascule cet élément dans/hors la sélection.
                selectedElements.has(draggedElement) ? selectedElements.delete(draggedElement) : selectedElements.add(draggedElement);
            } else {
                // Clic simple, sans Maj : ne garde que cet élément.
                selectedElements = new Set([draggedElement]);
            }
        }
    } else if (isSelecting) {
        const start = screenToWorld(selectStartX, selectStartY);
        const end = screenToWorld(event.clientX, event.clientY);
        for (const element of getElementsInRect(start.x, start.y, end.x, end.y)) {
            selectedElements.add(element);
        }
        isSelecting = false;
    }

    draggedElement = null;
    dragGroup = [];
    render();
});

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// Cadre le zoom/pan pour que tous les éléments visibles tiennent à l'écran.
function zoomToFit() {
    const visibleElements = loadedElements.filter((element) => element.visible);
    if (visibleElements.length === 0) return;

    const minX = Math.min(...visibleElements.map((element) => element.x));
    const minY = Math.min(...visibleElements.map((element) => element.y));
    const maxX = Math.max(...visibleElements.map((element) => element.x + element.width));
    const maxY = Math.max(...visibleElements.map((element) => element.y + element.height));

    const PADDING = 40; // marge en pixels écran autour du contenu
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    zoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Math.min(
            (window.innerWidth - PADDING * 2) / contentWidth,
            (window.innerHeight - PADDING * 2) / contentHeight
        ))
    );

    offsetX = window.innerWidth / 2 - (minX + contentWidth / 2) * zoom;
    offsetY = window.innerHeight / 2 - (minY + contentHeight / 2) * zoom;

    render();
}

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor));

    // Garde le point du monde sous le curseur immobile à l'écran pendant le zoom, sinon l'image "dérive" vers le coin de l'écran au lieu de rester sous la souris.
    const worldBeforeZoom = screenToWorld(event.clientX, event.clientY);
    zoom = newZoom;
    offsetX = event.clientX - worldBeforeZoom.x * zoom;
    offsetY = event.clientY - worldBeforeZoom.y * zoom;

    render();
}, { passive: false });

document.getElementById("upload-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return; // l'utilisateur a annulé le sélecteur

    await uploadFile(file);

    // Réaffiche tout, y compris le nouvel élément (pas de mise à jour incrémentale pour l'instant, on recharge la liste complète).
    loadedElements = await loadAllElements();
    render();
});

// ===== Menu en pie (clic droit) =====
//
// Deux façons de choisir une option, comme le menu Maj+A/Alt+S de Blender :
// - Appui bref (relâché avant d'avoir bougé au-delà de PIE_DEADZONE) : le
//   menu reste ouvert, un clic explicite sur un item le sélectionne.
// - Presser-glisser-relâcher : relâcher le clic droit alors qu'un item est
//   survolé (par direction, pas besoin d'être pile dessus) le sélectionne
//   directement, sans clic supplémentaire.

canvas.addEventListener("contextmenu", (event) => event.preventDefault()); // le menu natif ne doit jamais s'afficher : on gère nous-mêmes le clic droit dès le mousedown

const pieMenu = document.getElementById("pie-menu");
const pieItems = [...pieMenu.querySelectorAll(".pie-item")];
const pieDeleteItem = pieMenu.querySelector('[data-action="delete"]');

const PIE_RADIUS = 90; // distance du centre à chaque item, en pixels écran
const PIE_DEADZONE = 25; // rayon en dessous duquel relâcher ne sélectionne rien (juste un appui bref)
const PIE_MAX_RADIUS = PIE_RADIUS * 2; // au-delà, on s'est trop éloigné : plus rien n'est survolé/sélectionnable

let pieMenuOpen = false;
let pieCenterX = 0;
let pieCenterY = 0;
let pieHoveredItem = null;
let contextMenuTarget = null; // l'élément sous le clic droit, ou null si le vide
let contextMenuWorldPos = { x: 0, y: 0 }; // position monde du clic droit, pour créer un élément là où on a cliqué

// Répartit les items visibles en cercle, à parts égales, en partant du haut.
function layoutPieItems(items) {
    const angleStep = (2 * Math.PI) / items.length;
    items.forEach((item, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const x = Math.cos(angle) * PIE_RADIUS;
        const y = Math.sin(angle) * PIE_RADIUS;
        item.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    });
}

function openPieMenu(x, y) {
    pieCenterX = x;
    pieCenterY = y;
    pieMenuOpen = true;

    // "Supprimer" n'a de sens que si on a cliqué sur un élément.
    pieDeleteItem.classList.toggle("hidden", !contextMenuTarget);
    layoutPieItems(pieItems.filter((item) => !item.classList.contains("hidden")));

    pieMenu.style.left = `${x}px`;
    pieMenu.style.top = `${y}px`;
    pieMenu.classList.remove("hidden");
}

function closePieMenu() {
    pieMenuOpen = false;
    pieMenu.classList.add("hidden");
    if (pieHoveredItem) pieHoveredItem.classList.remove("pie-item-hover");
    pieHoveredItem = null;
}

// Détermine l'item survolé par DIRECTION depuis le centre (pas besoin d'être
// pile sur le bouton, juste dans la bonne direction) - comme dans Blender.
function updatePieHover(x, y) {
    if (pieHoveredItem) pieHoveredItem.classList.remove("pie-item-hover");
    pieHoveredItem = null;

    const dx = x - pieCenterX;
    const dy = y - pieCenterY;
    const distance = Math.hypot(dx, dy);
    if (distance < PIE_DEADZONE || distance > PIE_MAX_RADIUS) return; // trop près du centre ou trop loin : rien de survolé

    const visibleItems = pieItems.filter((item) => !item.classList.contains("hidden"));
    const angle = Math.atan2(dy, dx);
    const angleStep = (2 * Math.PI) / visibleItems.length;

    let bestItem = null;
    let bestDiff = Infinity;
    visibleItems.forEach((item, i) => {
        const itemAngle = -Math.PI / 2 + i * angleStep;
        const diff = Math.min(Math.abs(angle - itemAngle), 2 * Math.PI - Math.abs(angle - itemAngle));
        if (diff < bestDiff) {
            bestDiff = diff;
            bestItem = item;
        }
    });

    pieHoveredItem = bestItem;
    pieHoveredItem.classList.add("pie-item-hover");
}

async function selectPieAction(action) {
    if (action === "upload") {
        document.getElementById("upload-input").click();
    } else if (action === "text") {
        await createText("New text", contextMenuWorldPos.x, contextMenuWorldPos.y);
        loadedElements = await loadAllElements();
        render();
    } else if (action === "delete" && contextMenuTarget) {
        // Si l'élément cliqué fait partie de la sélection en cours, on
        // supprime tout le groupe (cohérent avec la touche Suppr) ; sinon,
        // seulement l'élément cliqué.
        const targets = selectedElements.has(contextMenuTarget) ? selectedElements : [contextMenuTarget];
        await deleteElements(targets);
    }
}

// Sélection par clic explicite (cas de l'appui bref, menu resté ouvert).
pieMenu.addEventListener("click", (event) => {
    const action = event.target.closest(".pie-item")?.dataset.action;
    if (!action) return;
    selectPieAction(action);
    closePieMenu();
});

// Capture (pas bubble) : se déclenche avant le "click" éventuel sur un item du menu, mais ferme quand même le menu si on clique n'importe où ailleurs.
window.addEventListener("mousedown", (event) => {
    if (!pieMenu.contains(event.target)) closePieMenu();

    // settingsButton exclu : sinon ce mousedown fermerait le panneau juste
    // avant que le "click" du bouton ne le rouvre (le clic ne le fermerait jamais).
    if (!settingsPanel.contains(event.target) && event.target !== settingsButton) {
        settingsPanel.classList.add("hidden");
    }
}, { capture: true });

// ===== Panneau de paramètres avancés (touche N ou bouton "...") =====

const settingsButton = document.getElementById("settings-button");
const settingsPanel = document.getElementById("settings-panel");

function toggleSettingsPanel() {
    settingsPanel.classList.toggle("hidden");
}

settingsButton.addEventListener("click", toggleSettingsPanel);

let snapEnabled = false; // réglage permanent (voir le panneau), désactivé par défaut ; Alt reste une dérogation ponctuelle par-dessus

document.getElementById("snap-toggle").addEventListener("change", (event) => {
    snapEnabled = event.target.checked;
});

const SCALE_STEP = 1.1; // +10% / -10% (l'inverse exact, 1/1.1) par clic

document.getElementById("scale-up").addEventListener("click", () => scaleSelection(SCALE_STEP));
document.getElementById("scale-down").addEventListener("click", () => scaleSelection(1 / SCALE_STEP));

document.getElementById("flip-horizontal").addEventListener("click", () => flipSelection("flip_horizontal"));
document.getElementById("flip-vertical").addEventListener("click", () => flipSelection("flip_vertical"));

// ===== Raccourcis clavier =====

// Ctrl sous Windows/Linux, Cmd sous Mac - même rôle, touche différente.
// Idem pour "Delete" (clavier étendu) vs "Backspace" (touche "delete" du Mac).
window.addEventListener("keydown", (event) => {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isCtrlOrCmd && event.shiftKey && key === "z") {
        event.preventDefault();
        redo();
    } else if (isCtrlOrCmd && key === "z") {
        event.preventDefault();
        undo();
    } else if (isCtrlOrCmd && key === "y") {
        event.preventDefault();
        redo();
    } else if (event.key === "Delete" || event.key === "Backspace") {
        deleteElements(selectedElements);
    } else if (isCtrlOrCmd && key === "c") {
        if (selectedElements.size === 1) {
            copyElementToClipboard([...selectedElements][0]).catch((error) => console.error(error));
        }
    } else if (isCtrlOrCmd && key === "x") {
        if (selectedElements.size === 1) {
            const element = [...selectedElements][0];
            copyElementToClipboard(element)
                .then(() => deleteElements([element]))
                .catch((error) => console.error(error));
        }
    } else if (isCtrlOrCmd && key === "a") {
        event.preventDefault();
        const visibleElements = loadedElements.filter((element) => element.visible);
        const allSelected = visibleElements.every((element) => selectedElements.has(element));
        // Toggle : tout désélectionner si tout était déjà sélectionné, sinon tout sélectionner.
        selectedElements = allSelected ? new Set() : new Set(visibleElements);
        render();
    } else if (!isCtrlOrCmd && key === "n") {
        toggleSettingsPanel();
    } else if (event.shiftKey && event.code === "Digit1") {
        // event.code (position physique de la touche) plutôt que event.key :
        // Shift+1 produit "!" sur un clavier US, pas "1", selon la disposition.
        event.preventDefault();
        zoomToFit();
    }
});
