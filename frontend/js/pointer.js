// ===== Souris : début et suivi du geste =====
//
// mousedown décide de la nature du geste (pan, redimensionnement, glisser,
// rectangle de sélection, menu contextuel) et prépare l'état ; mousemove le
// fait vivre. La validation, elle, est dans pointer-commit.js.

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
    if (event.button === 2) { // clic droit : menu contextuel (voir context-menu.js)
        const worldPos = screenToWorld(event.clientX, event.clientY);
        contextMenuWorldPos = worldPos;
        contextMenuTarget = getElementAt(worldPos.x, worldPos.y);

        // Clic droit sur un élément hors sélection : il devient la sélection,
        // sinon les actions du menu porteraient sur autre chose que ce qu'on vise.
        if (contextMenuTarget && !selectedElements.has(contextMenuTarget)) {
            selectedElements = new Set([contextMenuTarget]);
            render();
        }

        openContextMenu(event.clientX, event.clientY);
        return;
    }
    if (event.button !== 0) return;

    const groupHandle = getGroupResizeHandleAt(event.clientX, event.clientY);
    if (groupHandle) {
        resizingGroup = true;
        groupResizeHandle = groupHandle;
        groupResizeStartBounds = getGroupBoundingBox();
        groupResizeStartPositions = new Map(
            [...selectedElements].map((element) => [element, geometryOf(element)])
        );
        return;
    }

    const handleHit = getResizeHandleAt(event.clientX, event.clientY);
    if (handleHit) {
        resizingElement = handleHit.element;
        resizeHandle = handleHit.handle;
        resizeStartBounds = geometryOf(resizingElement);
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
