// ===== Vue et panneau du canevas =====
//
// Tout ce qui porte sur la vue plutôt que sur la sélection : zoom, import,
// et le panneau ⋮ qui regroupe les réglages globaux du canevas.

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// Cadre le zoom/pan pour que tous les éléments visibles tiennent à l'écran.
function zoomToFit() {
    const visibleElements = loadedElements.filter((element) => element.visible);
    if (visibleElements.length === 0) return;

    const minX = Math.min(...visibleElements.map((element) => element.x));
    const minY = Math.min(...visibleElements.map((element) => element.y));
    const maxX = Math.max(...visibleElements.map((element) => element.x + element.width));
    const maxY = Math.max(...visibleElements.map((element) => element.y + element.height));

    const PADDING = 40; // marge en pixels écran autour du contenu
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    zoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Math.min(
            (window.innerWidth - PADDING * 2) / contentWidth,
            (window.innerHeight - PADDING * 2) / contentHeight
        ))
    );

    offsetX = window.innerWidth / 2 - (minX + contentWidth / 2) * zoom;
    offsetY = window.innerHeight / 2 - (minY + contentHeight / 2) * zoom;

    scheduleViewportLoad();
    render();
}

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor));

    // Garde le point du monde sous le curseur immobile à l'écran pendant le zoom, sinon l'image "dérive" vers le coin de l'écran au lieu de rester sous la souris.
    const worldBeforeZoom = screenToWorld(event.clientX, event.clientY);
    zoom = newZoom;
    offsetX = event.clientX - worldBeforeZoom.x * zoom;
    offsetY = event.clientY - worldBeforeZoom.y * zoom;

    scheduleViewportLoad(); // dézoomer élargit la vue : elle peut découvrir des éléments non chargés
    render();
}, { passive: false });

document.getElementById("upload-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return; // l'utilisateur a annulé le sélecteur

    const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    await uploadFile(file, center.x, center.y);

    // Recharge la vue pour y faire apparaître le nouvel élément, importé au centre de l'écran.
    await loadViewport();
});

// ===== Panneau de paramètres avancés (touche N ou bouton "...") =====

const settingsButton = document.getElementById("settings-button");
const settingsPanel = document.getElementById("settings-panel");

function toggleSettingsPanel() {
    helpPanel.classList.add("hidden"); // un seul panneau ouvert à la fois
    settingsPanel.classList.toggle("hidden");
}

// Capture : se déclenche avant les autres gestionnaires, donc le panneau se
// ferme même si le clic sert par ailleurs à sélectionner sur le canevas.
// settingsButton est exclu, sinon ce mousedown fermerait le panneau juste
// avant que le clic du bouton ne le rouvre.
window.addEventListener("mousedown", (event) => {
    if (!settingsPanel.contains(event.target) && event.target !== settingsButton) {
        settingsPanel.classList.add("hidden");
    }
}, { capture: true });

settingsButton.addEventListener("click", toggleSettingsPanel);

// ===== Mode clair / sombre =====
//
// Seul le canevas change de couleurs entre les deux modes (voir style.css,
// [data-theme="dark"]) ; le chrome (panneaux, menus) reste constant - c'est
// la direction retenue le 25 sept (voir Decisions.md). refreshThemeFromCSS()
// et render() suffisent à répercuter le changement : THEME (canvas.js) est
// justement fait pour être relu à la demande.

const darkModeToggle = document.getElementById("dark-mode-toggle");

function applyDarkMode(dark, { skipRender = false } = {}) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    darkModeToggle.checked = dark;
    refreshThemeFromCSS();
    if (!skipRender) render();
}

// Au premier chargement : le choix déjà fait par l'utilisateur prime, sinon
// on suit la préférence système. skipRender ici : render() appelle
// updateStatusBar()/updateSelectionToolbar(), définies dans des fichiers
// chargés APRÈS celui-ci - le premier vrai rendu revient à main.js
// (chargé en dernier), une fois que tout existe.
const storedTheme = localStorage.getItem("theme");
applyDarkMode(
    storedTheme ? storedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches,
    { skipRender: true }
);

darkModeToggle.addEventListener("change", (event) => {
    localStorage.setItem("theme", event.target.checked ? "dark" : "light");
    applyDarkMode(event.target.checked);
});

let snapEnabled = false; // réglage permanent (voir le panneau), désactivé par défaut ; Alt reste une dérogation ponctuelle par-dessus

document.getElementById("snap-toggle").addEventListener("change", (event) => {
    snapEnabled = event.target.checked;
});

document.getElementById("grid-toggle").addEventListener("change", (event) => {
    gridVisible = event.target.checked;
    render();
});

// Ramène le zoom à 1 sans bouger le point du monde au centre de l'écran,
// pour ne pas désorienter (même principe que le zoom à la molette).
function zoomReset() {
    const centerWorld = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    zoom = 1;
    offsetX = window.innerWidth / 2 - centerWorld.x;
    offsetY = window.innerHeight / 2 - centerWorld.y;
    render();
}

// Les entrées désactivées (attribut disabled) ne déclenchent pas de clic :
// pas besoin de les filtrer ici, le navigateur s'en charge.
settingsPanel.addEventListener("click", (event) => {
    const action = event.target.closest(".settings-action")?.dataset.action;

    if (action === "import") document.getElementById("upload-input").click();
    else if (action === "zoom-fit") zoomToFit();
    else if (action === "zoom-reset") zoomReset();
});

const SCALE_STEP = 1.1; // +10% / -10% (l'inverse exact, 1/1.1) par clic

// Échelle et symétrie sont des actions sur la sélection : elles vivent
// maintenant dans le menu contextuel (voir context-menu.js) et sur les
// raccourcis ci-dessous, plus dans ce panneau réservé aux préférences.
