// ===== Variable d'états =====

let isPanning = false; // true pendant un glisser au bouton du milieu (déplacement de la caméra, pas d'une image)
let lastX = 0; // dernière position souris (écran) connue, pour calculer le delta au prochain mousemove
let lastY = 0;
let draggedImage = null; // image sous le curseur au début du glisser au bouton gauche, ou null si aucune
let dragGroup = []; // toutes les images qui bougent ensemble pendant ce glisser (draggedImage + le reste de la sélection si elle en fait partie, sinon juste draggedImage)
let dragStartPositions = new Map(); // position d'origine de chaque image de dragGroup avant le glisser, pour savoir si ça a bougé et pour l'undo
let selectedImages = new Set(); // image actuellement sélectionnée (outline dans drawImages, voir canvas.js)
let isSelecting = false; // true quand on est en train de faire une sélection
let selectStartX = 0;
let selectStartY = 0;

resizeCanvas();
render();

// Le chargement est asynchrone (fetch + Image.onload, voir api.js) : le premier render() ci-dessus dessine juste la grille, 
// celui-ci rajoute les images une fois qu'elles sont réellement prêtes.
loadAllImages()
    .then((images) => {
        loadedImages = images;
        render();
    })
    .catch((error) => {
        console.error(error);
    });

window.addEventListener("resize", () => {
    resizeCanvas();
    render();
});

// Pile d'annulation (Ctrl+Z) : chaque entrée dit "cette image avait ces
// valeurs avant l'action" (voir undo() plus bas).
let undoStack = [];

function pushUndo(image, previous) {
    undoStack.push({ image, previous });
}

async function undo() {
    if (undoStack.length === 0) return;

    const { image, previous } = undoStack.pop();
    Object.assign(image, previous);
    await patchImage(image.id, previous);
    render();
}

async function deleteImages(images) {
    const targets = [...images]; // copie : on va modifier selectedImages pendant la boucle
    if (targets.length === 0) return;

    for (const image of targets) {
        pushUndo(image, { visible: true }); // pour Ctrl+Z
        image.visible = false;
        selectedImages.delete(image);
    }

    render();

    await Promise.all(
        targets.map((image) =>
            patchImage(image.id, { visible: false }).catch((error) => console.error(error))
        )
    );
}

async function copyImageToClipboard(image) {
    // Passe par un canvas hors-écran pour forcer du PNG : c'est le seul
    // format que l'API Clipboard garantit de savoir écrire, peu importe le
    // format d'origine du fichier (jpg, gif...). image.element est déjà
    // chargé (voir loadImage() dans api.js), pas besoin de re-fetch.
    const offscreen = document.createElement("canvas");
    offscreen.width = image.element.naturalWidth;
    offscreen.height = image.element.naturalHeight;
    offscreen.getContext("2d").drawImage(image.element, 0, 0);

    const blob = await new Promise((resolve) => offscreen.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

canvas.addEventListener("mousedown", (event) => {
    // lastX et Y enregistre les dernière position de la souris
    lastX = event.clientX;
    lastY = event.clientY;

    if (event.button === 1){ // clic molette === déplacer le canvas
        isPanning = true;
    } else if (event.button === 0) { // clic gauche 
        const worldPos = screenToWorld(event.clientX, event.clientY);
        draggedImage = getImageAt(worldPos.x, worldPos.y);
        if (!event.shiftKey) {
            if (draggedImage && selectedImages.has(draggedImage)) {
                // Déjà dans la sélection : on ne touche à rien, pour pouvoir
                // déplacer tout le groupe sans le réduire à cette seule image.
            } else {
                selectedImages.clear();
                if (draggedImage) {
                    selectedImages.add(draggedImage);
                } else { // clic sur le vide : démarre un rectangle de sélection (remplace la sélection)
                    isSelecting = true;
                    selectStartX = event.clientX;
                    selectStartY = event.clientY;
                }
            }
        } else if (draggedImage) {
            if (selectedImages.has(draggedImage)) {
                selectedImages.delete(draggedImage);
            } else {
                selectedImages.add(draggedImage);
            }
        } else { // Maj + clic sur le vide : démarre un rectangle de sélection additif (ne vide pas la sélection existante)
            isSelecting = true;
            selectStartX = event.clientX;
            selectStartY = event.clientY;
        }

        if (draggedImage) {
            // Si l'image cliquée fait partie de la sélection, tout le groupe
            // bouge ensemble ; sinon, seule cette image est déplacée.
            dragGroup = selectedImages.has(draggedImage) ? [...selectedImages] : [draggedImage];
            dragStartPositions = new Map(dragGroup.map((image) => [image, { x: image.x, y: image.y }]));

            // Auto-avant-plan : l'image cliquée passe en dernière position du
            // tableau (= dessinée en dernier = affichée au-dessus).
            loadedImages.splice(loadedImages.indexOf(draggedImage), 1);
            loadedImages.push(draggedImage);
        }

        render(); // aussi hors du if : un clic dans le vide doit effacer l'outline de l'ancienne sélection
    }
});

// Écoutés sur window (pas canvas) pour continuer le pan même si le curseur sort de la zone du canvas pendant le glisser-déposer.
window.addEventListener("mousemove", (event) => {
    if (isPanning) {
        offsetX += event.clientX - lastX;
        offsetY += event.clientY - lastY;
    } else if (draggedImage) {
        const dx = (event.clientX - lastX) / zoom;
        const dy = (event.clientY - lastY) / zoom;
        for (const image of dragGroup) {
            image.x += dx;
            image.y += dy;
        }
    } else if (isSelecting) {
        // rien à faire ici : lastX/lastY (mis à jour plus bas) et render()
        // suffisent, drawSelectionBox() (canvas.js) les lit directement
    } else {
        return;
    }

    lastX = event.clientX;
    lastY = event.clientY;
    render();
});

window.addEventListener("mouseup", () => {
    isPanning = false;

    // Une seule requête ici, une fois le glisser terminé - pas à chaque
    // mousemove (voir la discussion sur le sujet).
    if (draggedImage) {
        for (const image of dragGroup) {
            const start = dragStartPositions.get(image);
            const moved = image.x !== start.x || image.y !== start.y;
            if (moved) {
                pushUndo(image, { x: start.x, y: start.y });
                patchImage(image.id, { x: image.x, y: image.y })
                    .catch((error) => console.error(error));
            }
        }
    } else if (isSelecting) {
        const start = screenToWorld(selectStartX, selectStartY);
        const end = screenToWorld(lastX, lastY);
        for (const image of getImagesInRect(start.x, start.y, end.x, end.y)) {
            selectedImages.add(image);
        }

        isSelecting = false;
        render();
    }


    draggedImage = null;
    dragGroup = [];
});

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

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

    // Réaffiche tout, y compris la nouvelle image (pas de mise à jour incrémentale pour l'instant, on recharge la liste complète).
    loadedImages = await loadAllImages();
    render();
});

// ===== Menu contextuel (clic droit) =====

const contextMenu = document.getElementById("context-menu");
const deleteMenuItem = contextMenu.querySelector('[data-action="delete"]');
let contextMenuTarget = null; // l'image sous le clic droit, ou null si le vide

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault(); // sinon le menu natif du navigateur s'affiche aussi

    const worldPos = screenToWorld(event.clientX, event.clientY);
    contextMenuTarget = getImageAt(worldPos.x, worldPos.y);

    // "Supprimer" n'a de sens que si on a cliqué sur une image.
    deleteMenuItem.hidden = !contextMenuTarget;

    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.classList.remove("hidden");
});

function hideContextMenu() {
    contextMenu.classList.add("hidden");
}

// Capture (pas bubble) : se déclenche avant le "click" éventuel sur un item du menu, mais ferme quand même le menu si on clique n'importe où ailleurs.
window.addEventListener("mousedown", (event) => {
    if (!contextMenu.contains(event.target)) hideContextMenu();
}, { capture: true });

contextMenu.addEventListener("click", async (event) => {
    const action = event.target.dataset.action;

    hideContextMenu();

    if (action === "upload") {
        document.getElementById("upload-input").click();

    } else if (action === "delete" && contextMenuTarget) {
        await deleteImages([contextMenuTarget]);
    }
});

// ===== Annuler (Ctrl+Z) =====

window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
    } else if (event.key === "Delete") {
        deleteImages(selectedImages);
    } else if (event.ctrlKey && event.key.toLowerCase() === "c") {
        if (selectedImages.size === 1) {
            copyImageToClipboard([...selectedImages][0]).catch((error) => console.error(error));
        }
    } else if (event.ctrlKey && event.key.toLowerCase() === "x") {
        if (selectedImages.size === 1) {
            const image = [...selectedImages][0];
            copyImageToClipboard(image)
                .then(() => deleteImages([image]))
                .catch((error) => console.error(error));
        }
    }
});
