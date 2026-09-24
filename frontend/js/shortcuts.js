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
    } else if (isCtrlOrCmd && (key === "+" || key === "=")) {
        event.preventDefault(); // sinon le navigateur zoome
        scaleSelection(SCALE_STEP);
    } else if (isCtrlOrCmd && key === "-") {
        event.preventDefault();
        scaleSelection(1 / SCALE_STEP);
    } else if (!isCtrlOrCmd && key === "n") {
        toggleSettingsPanel();
    } else if (event.shiftKey && event.code === "Digit0") {
        event.preventDefault();
        zoomReset();
    } else if (event.shiftKey && event.code === "Digit1") {
        // event.code (position physique de la touche) plutôt que event.key :
        // Shift+1 produit "!" sur un clavier US, pas "1", selon la disposition.
        event.preventDefault();
        zoomToFit();
    }
});
