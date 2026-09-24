// ===== État =====

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// offsetX/offsetY = décalage du pan (en pixels écran), zoom = niveau de zoom (1 = échelle réelle).
let offsetX = 0;
let offsetY = 0;
let zoom = 1;

// Rempli par main.js une fois loadAllElements() résolu (voir api.js). Chaque
// élément a des champs communs (id, type, x, y, width, height, visible) et
// des champs propres à son type (image / contenu pour texte).
let loadedElements = [];

const GRID_SIZE = 50; // espacement de la grille, en unités du monde
let gridVisible = true; // piloté par le panneau du canevas

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

// Renvoie l'élément (loadedElements) dont le rectangle contient ce point monde, ou null si aucun.
// Parcours en ordre inverse : le dernier du tableau est dessiné en dernier
// (voir drawElements), donc affiché au-dessus — c'est lui qu'on doit trouver
// en premier en cas de chevauchement.
function getElementAt(worldX, worldY) {
    for (let i = loadedElements.length - 1; i >= 0; i--) {
        const element = loadedElements[i];
        if (!element.visible) continue; // un élément "supprimé" ne doit plus être cliquable

        const inside =
            worldX >= element.x && worldX <= element.x + element.width &&
            worldY >= element.y && worldY <= element.y + element.height;
        if (inside) return element;
    }
    return null;
}

const HANDLE_HIT_RADIUS = 8; // rayon de détection autour du centre d'une poignée, en pixels écran

// Renvoie { element, handle } si (screenX, screenY) tombe sur une poignée de
// redimensionnement de l'élément sélectionné, ou null. Poignées aux 4 coins
// seulement (pas de bords) : les proportions sont bloquées, étirer un seul
// côté n'aurait pas de sens.
function getResizeHandleAt(screenX, screenY) {
    if (selectedElements.size !== 1) return null;
    const element = [...selectedElements][0];

    const topLeft = worldToScreen(element.x, element.y);
    const bottomRight = worldToScreen(element.x + element.width, element.y + element.height);
    const corners = {
        nw: topLeft,
        ne: { x: bottomRight.x, y: topLeft.y },
        sw: { x: topLeft.x, y: bottomRight.y },
        se: bottomRight,
    };

    for (const handle in corners) {
        const corner = corners[handle];
        if (Math.hypot(screenX - corner.x, screenY - corner.y) <= HANDLE_HIT_RADIUS) {
            return { element, handle };
        }
    }
    return null;
}

// Bounding box (coordonnées monde) de toute la sélection multiple actuelle.
function getGroupBoundingBox() {
    const elements = [...selectedElements];
    return {
        minX: Math.min(...elements.map((element) => element.x)),
        minY: Math.min(...elements.map((element) => element.y)),
        maxX: Math.max(...elements.map((element) => element.x + element.width)),
        maxY: Math.max(...elements.map((element) => element.y + element.height)),
    };
}

// Comme getResizeHandleAt, mais pour le cadre englobant la sélection
// multiple (voir drawGroupSelectionFrame) - la marge PADDING fait partie du
// rectangle cliquable, comme dessiné.
function getGroupResizeHandleAt(screenX, screenY) {
    if (selectedElements.size < 2) return null;

    const { minX, minY, maxX, maxY } = getGroupBoundingBox();
    const topLeft = worldToScreen(minX, minY);
    const bottomRight = worldToScreen(maxX, maxY);

    const corners = {
        nw: { x: topLeft.x - GROUP_FRAME_PADDING, y: topLeft.y - GROUP_FRAME_PADDING },
        ne: { x: bottomRight.x + GROUP_FRAME_PADDING, y: topLeft.y - GROUP_FRAME_PADDING },
        sw: { x: topLeft.x - GROUP_FRAME_PADDING, y: bottomRight.y + GROUP_FRAME_PADDING },
        se: { x: bottomRight.x + GROUP_FRAME_PADDING, y: bottomRight.y + GROUP_FRAME_PADDING },
    };

    for (const handle in corners) {
        const corner = corners[handle];
        if (Math.hypot(screenX - corner.x, screenY - corner.y) <= HANDLE_HIT_RADIUS) {
            return handle;
        }
    }
    return null;
}

// Renvoie tous les éléments (loadedElements) dont le rectangle touche le rectangle donné (coordonnées monde, x1/y1 et x2/y2 dans n'importe quel ordre).
function getElementsInRect(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    return loadedElements.filter((element) => {
        if (!element.visible) return false;
        return (
            element.x < right &&
            element.x + element.width > left &&
            element.y < bottom &&
            element.y + element.height > top
        );
    });
}

// ===== Dessin =====

function drawGrid() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height); // à faire dans tous les cas : c'est aussi l'effacement de la frame précédente
    if (!gridVisible) return;

    const step = GRID_SIZE * zoom;
    // Modulo par step : les lignes restent alignées sur la grille du monde quand on pan, au lieu de repartir du coin de l'écran à chaque fois.
    const startX = offsetX % step;
    const startY = offsetY % step;

    ctx.strokeStyle = "#474141";
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

// Texte : lignes découpées à la largeur du cadre (voir text-layout.js), et
// bloc entier centré dans le cadre - pas chaque ligne indépendamment, sinon
// un texte de 3 lignes serait décentré verticalement.
function drawText(element, screen, width, height) {
    const fontSize = element.font_size * zoom;

    ctx.fillStyle = "white";
    ctx.font = textFont(fontSize);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = wrapText(ctx, element.contenu, width);
    const lineHeight = textLineHeight(fontSize);
    const centerX = screen.x + width / 2;
    // Départ du bloc : on remonte d'une demi-hauteur totale depuis le centre.
    const firstLineY = screen.y + height / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, index) => {
        ctx.fillText(line, centerX, firstLineY + index * lineHeight);
    });

    // textAlign/textBaseline sont des états persistants du contexte : sans
    // remise à zéro, ils s'appliqueraient à tout ce qui est dessiné ensuite.
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
}

function drawElements() {
    for (const element of loadedElements) {
        if (!element.visible) continue; // "supprimé" (voir menu contextuel) : ne s'affiche plus

        const screen = worldToScreen(element.x, element.y);
        // width/height * zoom : sinon les éléments gardent toujours la même taille à l'écran, peu importe le niveau de zoom.
        const width = element.width * zoom;
        const height = element.height * zoom;

        if (element.type === "image") {
            if (element.flip_horizontal || element.flip_vertical) {
                // Retourne autour du CENTRE de l'image (pas d'un coin) : x/y/width/height
                // ne bougent pas, donc hit-testing/redimensionnement restent inchangés.
                const centerX = screen.x + width / 2;
                const centerY = screen.y + height / 2;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.scale(element.flip_horizontal ? -1 : 1, element.flip_vertical ? -1 : 1);
                ctx.drawImage(element.image, -width / 2, -height / 2, width, height);
                ctx.restore();
            } else {
                ctx.drawImage(element.image, screen.x, screen.y, width, height);
            }
        } else if (element.type === "texte") {
            drawText(element, screen, width, height);
        }

        // selectedElements vient de main.js (mis à jour au clic) : même partage de globales entre scripts que loadedElements.
        if (selectedElements.has(element)) {
            ctx.strokeStyle = "#b6e2f0";
            ctx.lineWidth = 2;
            ctx.strokeRect(screen.x, screen.y, width, height);
        }
    }
}


const GROUP_FRAME_PADDING = 12; // marge en pixels écran autour de la bounding box du groupe

// Cadre englobant TOUTE la sélection multiple, en plus du contour individuel
// de chaque élément (voir drawElements). Purement visuel pour l'instant :
// les poignées de redimensionnement de groupe viendront dans une étape suivante.
function drawGroupSelectionFrame() {
    if (selectedElements.size < 2) return;

    const { minX, minY, maxX, maxY } = getGroupBoundingBox();
    const topLeft = worldToScreen(minX, minY);
    const bottomRight = worldToScreen(maxX, maxY);

    const x = topLeft.x - GROUP_FRAME_PADDING;
    const y = topLeft.y - GROUP_FRAME_PADDING;
    const width = bottomRight.x - topLeft.x + GROUP_FRAME_PADDING * 2;
    const height = bottomRight.y - topLeft.y + GROUP_FRAME_PADDING * 2;

    ctx.strokeStyle = "#2684ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.stroke();
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
    drawElements();
    drawGroupSelectionFrame();
    drawSelectionBox();
    updateStatusBar(); // défini dans status-bar.js, chargé avant le premier render()
    updateSelectionToolbar(); // idem, selection-toolbar.js
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
    loadedElements = await loadAllElements();
    render();
});

window.addEventListener("paste", async (event) => {
    for (const item of event.clipboardData.items) {
        if (!item.type.startsWith("image/")) continue;

        const file = item.getAsFile();
        await uploadFile(file);
        loadedElements = await loadAllElements();
        render();
    }
});
