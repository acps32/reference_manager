// ===== État =====

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// offsetX/offsetY = décalage du pan (en pixels écran), zoom = niveau de zoom (1 = échelle réelle).
let offsetX = 0;
let offsetY = 0;
let zoom = 1;

// Rempli par main.js une fois loadAllImages() résolu (voir api.js).
let loadedImages = [];

const GRID_SIZE = 50; // espacement de la grille, en unités du monde

function resizeCanvas() {
    // canvas.width/height en pixels physiques + setTransform à l'échelle du devicePixelRatio : évite une grille floue sur les écrans haute densité
    // (le reste du code dessine ensuite en pixels CSS, comme si de rien n'était).
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ===== Calculs géométriques (conversions écran <-> monde) =====

// Position écran (ex: la souris) -> position monde. Utile pour savoir "sur quel point du monde je clique", peu importe le pan/zoom actuels.
function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - offsetX) / zoom,
        y: (screenY - offsetY) / zoom,
    };
}

// L'inverse : position monde (ex: la position stockée d'une image) -> position écran. Utile pour savoir où la dessiner.
function worldToScreen(worldX, worldY) {
    return {
        x: worldX * zoom + offsetX,
        y: worldY * zoom + offsetY,
    };
}

// Renvoie l'image (loadedImages) dont le rectangle contient ce point monde, ou null si aucune.
// Parcours en ordre inverse : la dernière du tableau est dessinée en dernier
// (voir drawImages), donc affichée au-dessus — c'est elle qu'on doit trouver
// en premier en cas de chevauchement.
function getImageAt(worldX, worldY) {
    for (let i = loadedImages.length - 1; i >= 0; i--) {
        const image = loadedImages[i];
        if (!image.visible) continue; // une image "supprimée" ne doit plus être cliquable

        const inside =
            worldX >= image.x && worldX <= image.x + image.width &&
            worldY >= image.y && worldY <= image.y + image.height;
        if (inside) return image;
    }
    return null;
}

// Renvoie toutes les images (loadedImages) dont le rectangle touche le rectangle donné (coordonnées monde, x1/y1 et x2/y2 dans n'importe quel ordre).
function getImagesInRect(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    return loadedImages.filter((image) => {
        if (!image.visible) return false;
        return (
            image.x < right &&
            image.x + image.width > left &&
            image.y < bottom &&
            image.y + image.height > top
        );
    });
}

// ===== Dessin =====

function drawGrid() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height);

    const step = GRID_SIZE * zoom;
    // Modulo par step : les lignes restent alignées sur la grille du monde quand on pan, au lieu de repartir du coin de l'écran à chaque fois.
    const startX = offsetX % step;
    const startY = offsetY % step;

    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = startX; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }
    for (let y = startY; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.stroke();
}

function drawImages() {
    // width/height * zoom : sinon les images gardent toujours la même taille à l'écran, peu importe le niveau de zoom.
    for (const image of loadedImages) {
        if (!image.visible) continue; // "supprimée" (voir menu contextuel) : ne s'affiche plus

        const screen = worldToScreen(image.x, image.y);
        const width = image.width * zoom;
        const height = image.height * zoom;

        ctx.drawImage(image.element, screen.x, screen.y, width, height);

        // selectedImages vient de main.js (mis à jour au clic) : même partage de globales entre scripts que loadedImages.
        if (selectedImages.has(image)) {
            ctx.strokeStyle = "#86817e";
            ctx.lineWidth = 2;
            ctx.strokeRect(screen.x, screen.y, width, height);
        }
    }
}

function drawSelectionBox() {
    if (!isSelecting) return;

    // Coordonnées écran directes (comme le menu contextuel) : pas de
    // worldToScreen nécessaire. width/height négatifs si on glisse vers la
    // gauche/le haut : strokeRect/fillRect gèrent ça très bien tout seuls.
    const x = selectStartX;
    const y = selectStartY;
    const width = lastX - selectStartX;
    const height = lastY - selectStartY;

    ctx.fillStyle = "rgba(38, 132, 255, 0.15)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#2684ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
}

function render() {
    drawGrid();
    drawImages();
    drawSelectionBox();
}

// ===== Import de fichiers (glisser-déposer, coller) =====

canvas.addEventListener("dragover", (event) => {
    event.preventDefault(); // sinon le navigateur refuse le drop
});

canvas.addEventListener("drop", async (event) => {
    event.preventDefault(); // sinon le navigateur ouvre le fichier comme une page
    const file = event.dataTransfer.files[0];
    if (!file) return;

    await uploadFile(file);
    loadedImages = await loadAllImages();
    render();
});

window.addEventListener("paste", async (event) => {
    for (const item of event.clipboardData.items) {
        if (!item.type.startsWith("image/")) continue;

        const file = item.getAsFile();
        await uploadFile(file);
        loadedImages = await loadAllImages();
        render();
    }
});
