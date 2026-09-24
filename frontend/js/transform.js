// ===== Transformations géométriques =====
//
// Le calcul pur : redimensionnement d'un élément ou d'un groupe, mise à
// l'échelle, symétrie. Aucun gestionnaire d'événement ici, uniquement des
// fonctions appelées par pointer.js et les menus.

const MIN_ELEMENT_SIZE = 20; // en unités du monde ; empêche de réduire à 0 ou en négatif

// Champs décrivant la géométrie d'un élément, utilisés à la fois pour l'undo
// (état d'avant) et pour le PATCH (état d'après). Pour un texte, la taille de
// police en fait partie : elle doit suivre le cadre à l'échelle, sinon
// agrandir la boîte laisserait le texte à sa taille d'origine.
function geometryOf(element) {
    const geometry = { x: element.x, y: element.y, width: element.width, height: element.height };
    if (element.type === "texte") geometry.font_size = element.font_size;
    return geometry;
}

// Applique le facteur d'échelle à la taille de police, si l'élément en a une.
function scaleFontSize(element, start, scale) {
    if (start.font_size !== undefined) element.font_size = start.font_size * scale;
}

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
    scaleFontSize(element, start, scale);
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
        scaleFontSize(element, start, scale);
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
        [...selectedElements].map((element) => [element, geometryOf(element)])
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
        scaleFontSize(element, start, scale);
    }

    pushUndo([...startPositions].map(([element, start]) => ({ image: element, previous: start })));
    for (const [element] of startPositions) {
        patchElement(element.id, geometryOf(element)).catch((error) => console.error(error));
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
