// ===== Barre d'état =====
//
// Strictement passive : aucune action, uniquement de l'information. C'est ce
// qui la distingue du menu contextuel (actions sur la sélection) et du
// panneau ⋮ (réglages du canevas) - voir docs/Backlog.md.
//
// Mise à jour depuis render() : c'est le seul point par lequel passe tout
// changement visible (zoom, pan, sélection, glisser), donc l'affichage ne peut
// pas se désynchroniser de l'état réel.

const statusElementsField = document.getElementById("status-elements");
const statusZoomField = document.getElementById("status-zoom");
const statusSelectionField = document.getElementById("status-selection");

let lastStatus = ""; // render() tourne à chaque frame d'un glisser : on n'écrit dans le DOM que si le texte change

function pluralize(count, word) {
    return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function selectionSummary() {
    if (selectedElements.size === 0) return "";
    if (selectedElements.size > 1) return pluralize(selectedElements.size, "sélectionné");

    // Un seul élément : ses dimensions sont plus utiles que son nombre.
    const element = [...selectedElements][0];
    return `1 sélectionné · ${Math.round(element.width)} × ${Math.round(element.height)}`;
}

function updateStatusBar() {
    const visibleCount = loadedElements.filter((element) => element.visible).length;
    const elements = pluralize(visibleCount, "élément");
    const zoomLevel = `${Math.round(zoom * 100)} %`;
    const selection = selectionSummary();

    const status = `${elements}|${zoomLevel}|${selection}`;
    if (status === lastStatus) return;
    lastStatus = status;

    statusElementsField.textContent = elements;
    statusZoomField.textContent = zoomLevel;
    statusSelectionField.textContent = selection;
}
