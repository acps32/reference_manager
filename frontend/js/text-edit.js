// ===== Édition du contenu d'un texte =====
//
// Un <canvas> ne sait pas recevoir de frappe clavier : on superpose un
// <textarea> au-dessus de l'élément le temps de la saisie. Un textarea (et
// non un input) parce que le texte peut désormais tenir sur plusieurs lignes.

const textEditor = document.getElementById("text-editor");
let editedText = null; // élément texte en cours d'édition, ou null

// Hauteur du cadre nécessaire pour afficher ce contenu, en unités du monde.
// Mesuré hors zoom : la hauteur stockée est une donnée du monde, pas de l'écran.
function neededTextHeight(element, contenu) {
    ctx.font = textFont(element.font_size);
    const lines = wrapText(ctx, contenu, element.width);
    return textBlockHeight(lines.length, element.font_size);
}

// Le textarea grandit avec son contenu et reste centré sur le cadre, pour
// coller au rendu du canvas (qui centre le bloc de texte verticalement).
function fitEditorToContent() {
    if (!editedText) return;

    textEditor.style.height = "auto";
    const height = textEditor.scrollHeight;
    textEditor.style.height = `${height}px`;

    const center = worldToScreen(editedText.x + editedText.width / 2, editedText.y + editedText.height / 2);
    textEditor.style.top = `${center.y - height / 2}px`;
}

function startTextEdit(element) {
    editedText = element;

    const screen = worldToScreen(element.x, element.y);
    textEditor.style.left = `${screen.x}px`;
    textEditor.style.width = `${element.width * zoom}px`;
    textEditor.style.font = textFont(element.font_size * zoom);

    textEditor.value = element.contenu;
    textEditor.classList.remove("hidden");
    fitEditorToContent();
    textEditor.focus();
    textEditor.select();
}

function closeTextEditor() {
    editedText = null;
    textEditor.classList.add("hidden");
}

function commitTextEdit() {
    if (!editedText) return;

    const element = editedText;
    const previous = { contenu: element.contenu, height: element.height };
    const contenu = textEditor.value.trim();
    closeTextEditor();

    // Vide ou inchangé : rien à enregistrer (un texte vide serait invisible,
    // donc impossible à re-sélectionner pour le corriger).
    if (contenu === "" || contenu === previous.contenu) return;

    // Le cadre s'ajuste au nombre de lignes : c'est la hauteur qui découle du
    // contenu, pas l'inverse (voir font_size dans models.py).
    const height = neededTextHeight(element, contenu);

    pushUndo([{ image: element, previous }]);
    element.contenu = contenu;
    element.height = height;
    render();
    patchElement(element.id, { contenu, height }).catch((error) => console.error(error));
}

canvas.addEventListener("dblclick", (event) => {
    const worldPos = screenToWorld(event.clientX, event.clientY);
    const element = getElementAt(worldPos.x, worldPos.y);

    if (element && element.type === "texte") startTextEdit(element);
});

textEditor.addEventListener("input", fitEditorToContent);

textEditor.addEventListener("keydown", (event) => {
    // Indispensable : sans ça, taper "n" ouvrirait le panneau de réglages,
    // Suppr effacerait l'élément, Ctrl+A sélectionnerait tout le canevas...
    event.stopPropagation();

    // Entrée valide ; Ctrl+Entrée insère un saut de ligne dans le texte.
    if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        commitTextEdit();
    } else if (event.key === "Escape") {
        closeTextEditor();
    }
});

textEditor.addEventListener("blur", commitTextEdit);
