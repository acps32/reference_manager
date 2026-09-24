// ===== Actions sur les éléments, et historique =====
//
// Toute action qui modifie durablement un élément passe par ici : elle
// s'enregistre dans la pile d'annulation et se persiste via l'API.

// Pile d'annulation (Ctrl+Z) et de rétablissement (Ctrl+Y) : chaque entrée
// est une ACTION complète (un tableau de { image: element, previous }), pas
// un élément individuel - sinon annuler une suppression de 10 éléments
// demanderait 10 Ctrl+Z.
let undoStack = [];
let redoStack = [];

function pushUndo(changes) {
    undoStack.push(changes);
    redoStack = []; // une nouvelle action invalide l'historique de rétablissement
}

// Applique `changes` (venant de fromStack) et pousse l'inverse dans
// toStack - undo() et redo() sont exactement la même opération, juste
// dans des directions opposées.
async function applyChanges(fromStack, toStack) {
    if (fromStack.length === 0) return;

    const changes = fromStack.pop();
    const inverse = changes.map(({ image, previous }) => {
        const current = {};
        for (const key in previous) current[key] = image[key];
        return { image, previous: current };
    });
    toStack.push(inverse);

    for (const { image, previous } of changes) {
        Object.assign(image, previous);
    }
    render();

    await Promise.all(
        changes.map(({ image, previous }) =>
            patchElement(image.id, previous).catch((error) => console.error(error))
        )
    );
}

function undo() {
    return applyChanges(undoStack, redoStack);
}

function redo() {
    return applyChanges(redoStack, undoStack);
}

async function deleteElements(elements) {
    const targets = [...elements]; // copie : on va modifier selectedElements pendant la boucle
    if (targets.length === 0) return;

    pushUndo(targets.map((element) => ({ image: element, previous: { visible: true } })));
    for (const element of targets) {
        element.visible = false;
        selectedElements.delete(element);
    }

    render();

    await Promise.all(
        targets.map((element) =>
            patchElement(element.id, { visible: false }).catch((error) => console.error(error))
        )
    );
}

async function copyElementToClipboard(element) {
    if (element.type === "texte") {
        await navigator.clipboard.writeText(element.contenu);
        return;
    }

    // Image : passe par un canvas hors-écran pour forcer du PNG - c'est le
    // seul format que l'API Clipboard garantit de savoir écrire, peu importe
    // le format d'origine du fichier (jpg, gif...). element.image est déjà
    // chargé (voir loadImage() dans api.js), pas besoin de re-fetch.
    const offscreen = document.createElement("canvas");
    offscreen.width = element.image.naturalWidth;
    offscreen.height = element.image.naturalHeight;
    offscreen.getContext("2d").drawImage(element.image, 0, 0);

    const blob = await new Promise((resolve) => offscreen.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
