// ===== Souris : validation du geste =====
//
// Au relâchement, on décide ce qui compte comme une vraie modification, on
// l'enregistre dans l'historique et on l'envoie au backend. Séparé de
// pointer.js parce que c'est une responsabilité distincte : persister plutôt
// que suivre le curseur - et une seule requête par geste, pas par mousemove.

window.addEventListener("mouseup", (event) => {
    isPanning = false;

    if (resizingGroup) {
        const changed = [...groupResizeStartPositions].some(
            ([element, start]) => element.x !== start.x || element.y !== start.y || element.width !== start.width || element.height !== start.height
        );
        if (changed) {
            pushUndo([...groupResizeStartPositions].map(([element, start]) => ({ image: element, previous: start })));
            for (const [element] of groupResizeStartPositions) {
                patchElement(element.id, geometryOf(element)).catch((error) => console.error(error));
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
            patchElement(resizingElement.id, geometryOf(resizingElement)).catch((error) => console.error(error));
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
