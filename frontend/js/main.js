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

let isPanning = false;
let lastX = 0;
let lastY = 0;
let draggedImage = null;
let dragStartX = 0;
let dragStartY = 0;

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

canvas.addEventListener("mousedown", (event) => {
    lastX = event.clientX;
    lastY = event.clientY;

    if (event.button === 1){
        isPanning = true;
    } else if (event.button === 0) {
        const worldPos = screenToWorld(event.clientX, event.clientY);
        draggedImage = getImageAt(worldPos.x, worldPos.y);

        if (draggedImage) {
            dragStartX = draggedImage.x;
            dragStartY = draggedImage.y;

            // Auto-avant-plan : l'image cliquée passe en dernière position du
            // tableau (= dessinée en dernier = affichée au-dessus).
            loadedImages.splice(loadedImages.indexOf(draggedImage), 1);
            loadedImages.push(draggedImage);
            render();
        }
    }
});

// Écoutés sur window (pas canvas) pour continuer le pan même si le curseur sort de la zone du canvas pendant le glisser-déposer.
window.addEventListener("mousemove", (event) => {
    if (isPanning) {
        offsetX += event.clientX - lastX;
        offsetY += event.clientY - lastY;
    } else if (draggedImage) {
        draggedImage.x += (event.clientX - lastX) / zoom;
        draggedImage.y += (event.clientY - lastY) / zoom;
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
        const moved = draggedImage.x !== dragStartX || draggedImage.y !== dragStartY;
        if (moved) {
            pushUndo(draggedImage, { x: dragStartX, y: dragStartY });
            patchImage(draggedImage.id, { x: draggedImage.x, y: draggedImage.y })
                .catch((error) => console.error(error));
        }
    }

    draggedImage = null;
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

// Capture (pas bubble) : se déclenche avant le "click" éventuel sur un item
// du menu, mais ferme quand même le menu si on clique n'importe où ailleurs.
window.addEventListener("mousedown", (event) => {
    if (!contextMenu.contains(event.target)) hideContextMenu();
}, { capture: true });

contextMenu.addEventListener("click", async (event) => {
    const action = event.target.dataset.action;
    hideContextMenu();

    if (action === "upload") {
        document.getElementById("upload-input").click();
    } else if (action === "delete" && contextMenuTarget) {
        pushUndo(contextMenuTarget, { visible: true });
        contextMenuTarget.visible = false;
        await patchImage(contextMenuTarget.id, { visible: false });
        render();
    }
});

// ===== Annuler (Ctrl+Z) =====

window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
    }
});
