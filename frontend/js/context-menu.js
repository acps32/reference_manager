// ===== Menu contextuel (clic droit) =====
//
// Convention universelle : clic droit sur un objet = actions sur cet objet.
// Le menu radial, lui, est passé sur un raccourci clavier (voir main.js) : il
// sert de couche rapide pour les actions fréquentes, pas de porte d'entrée.
//
// Rangement par portée (voir docs/Backlog.md) : ce menu ne contient que des
// actions portant sur la sélection ou sur le canevas. Les préférences
// globales restent dans le panneau ⋮.

// Le menu natif du navigateur ne doit jamais s'afficher : on gère le clic
// droit nous-mêmes (l'ouverture se fait au mousedown, voir pointer.js).
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

const contextMenu = document.getElementById("context-menu");
const contextMenuItems = [...contextMenu.querySelectorAll("li")];

// Un item n'est affiché que si sa portée correspond à ce qui est sous le
// clic : "canvas" pour le vide, le reste pour un élément.
function contextMenuItemApplies(scope, selection) {
    if (scope === "canvas") return selection.length === 0;
    if (scope === "selection") return selection.length > 0;
    if (scope === "image") return selection.some((element) => element.type === "image");
    if (scope === "texte") return selection.length === 1 && selection[0].type === "texte";
    return false;
}

function openContextMenu(x, y) {
    const selection = contextMenuTarget ? [...selectedElements] : [];
    for (const item of contextMenuItems) {
        item.classList.toggle("hidden", !contextMenuItemApplies(item.dataset.scope, selection));
    }

    contextMenu.classList.remove("hidden");

    // Repositionne si le menu dépasserait du bord (sa taille n'est connue
    // qu'une fois affiché, d'où la lecture après remove("hidden")).
    const { width, height } = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${Math.min(x, window.innerWidth - width - 4)}px`;
    contextMenu.style.top = `${Math.min(y, window.innerHeight - height - 4)}px`;
}

function closeContextMenu() {
    contextMenu.classList.add("hidden");
}

async function runContextAction(action) {
    if (action === "edit-text") {
        startTextEdit([...selectedElements][0]);
    } else if (action === "flip-horizontal") {
        flipSelection("flip_horizontal");
    } else if (action === "flip-vertical") {
        flipSelection("flip_vertical");
    } else if (action === "scale-up") {
        scaleSelection(SCALE_STEP);
    } else if (action === "scale-down") {
        scaleSelection(1 / SCALE_STEP);
    } else if (action === "delete") {
        await deleteElements(selectedElements);
    } else if (action === "upload") {
        document.getElementById("upload-input").click();
    } else if (action === "text") {
        await createText("Nouveau texte", contextMenuWorldPos.x, contextMenuWorldPos.y);
        loadedElements = await loadAllElements();
        render();
    } else if (action === "select-all") {
        selectedElements = new Set(loadedElements.filter((element) => element.visible));
        render();
    }
}

contextMenu.addEventListener("click", (event) => {
    const action = event.target.closest("li")?.dataset.action;
    closeContextMenu();

    if (action) runContextAction(action).catch((error) => console.error(error));
});

// Capture : se déclenche avant les autres gestionnaires de mousedown, donc le
// menu se ferme même si le clic déclenche par ailleurs une sélection.
window.addEventListener("mousedown", (event) => {
    if (!contextMenu.contains(event.target)) closeContextMenu();
}, { capture: true });
