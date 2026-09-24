// ===== Barre flottante de sélection =====
//
// Petite barre d'icônes qui suit la sélection, pour les gestes fréquents sans
// passer par le clic droit. Elle double volontairement des entrées du menu
// contextuel : c'est le rôle d'un raccourci visuel.
//
// Icônes en SVG inline plutôt qu'une police d'icônes : la page s'ouvre en
// file://, une ressource distante serait bloquée.

const TOOLBAR_ICONS = {
    "edit-text": '<path d="M11 3l2 2-7 7-2.5.5.5-2.5z"/>',
    "flip-horizontal": '<path d="M8 2v12" stroke-dasharray="2 2"/><path d="M6 5L2.5 8 6 11z"/><path d="M10 5l3.5 3L10 11z"/>',
    "flip-vertical": '<path d="M2 8h12" stroke-dasharray="2 2"/><path d="M5 6L8 2.5 11 6z"/><path d="M5 10l3 3.5 3-3.5z"/>',
    "delete": '<path d="M3 5h10M6.5 5V3.5h3V5M5 5l.7 8h4.6L11 5"/>',
};

const TOOLBAR_LABELS = {
    "edit-text": "Éditer le texte",
    "flip-horizontal": "Symétrie horizontale",
    "flip-vertical": "Symétrie verticale",
    "delete": "Supprimer",
};

const selectionToolbar = document.getElementById("selection-toolbar");

selectionToolbar.innerHTML = Object.keys(TOOLBAR_ICONS).map((action) => `
    <button class="toolbar-button" data-action="${action}" title="${TOOLBAR_LABELS[action]}">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">${TOOLBAR_ICONS[action]}</svg>
    </button>
`).join("");

const toolbarButtons = [...selectionToolbar.querySelectorAll(".toolbar-button")];

const TOOLBAR_GAP = 12; // écart en pixels écran entre le haut de la sélection et la barre

// Appelée depuis render() : la barre doit suivre la sélection pendant un pan,
// un zoom ou un glisser, donc se repositionner à chaque frame.
function updateSelectionToolbar() {
    if (selectedElements.size === 0 || isSelecting) {
        selectionToolbar.classList.add("hidden");
        return;
    }

    const selection = [...selectedElements];
    for (const button of toolbarButtons) {
        const action = button.dataset.action;
        const applies =
            action === "edit-text" ? selection.length === 1 && selection[0].type === "texte"
            : action.startsWith("flip") ? selection.some((element) => element.type === "image")
            : true;
        button.classList.toggle("hidden", !applies);
    }

    selectionToolbar.classList.remove("hidden");

    // Centrée au-dessus de la bounding box ; sa largeur n'est connue qu'une
    // fois affichée, d'où la mesure après remove("hidden").
    const { minX, minY, maxX } = getGroupBoundingBox();
    const topLeft = worldToScreen(minX, minY);
    const topRight = worldToScreen(maxX, minY);
    const { width, height } = selectionToolbar.getBoundingClientRect();

    const x = (topLeft.x + topRight.x) / 2 - width / 2;
    const y = topLeft.y - height - TOOLBAR_GAP;

    selectionToolbar.style.left = `${Math.max(4, Math.min(x, window.innerWidth - width - 4))}px`;
    // Sous la sélection si elle est trop haute pour laisser la place au-dessus.
    selectionToolbar.style.top = `${y < 4 ? worldToScreen(minX, minY).y + TOOLBAR_GAP : y}px`;
}

selectionToolbar.addEventListener("click", (event) => {
    const action = event.target.closest(".toolbar-button")?.dataset.action;
    if (!action) return;

    if (action === "edit-text") startTextEdit([...selectedElements][0]);
    else if (action === "flip-horizontal") flipSelection("flip_horizontal");
    else if (action === "flip-vertical") flipSelection("flip_vertical");
    else if (action === "delete") deleteElements(selectedElements).catch((error) => console.error(error));
});
