// ===== Panneau d'aide (touche ? ou bouton d'en-tête) =====
//
// Deux rôles : documenter ce qui existe, et rendre lisible le périmètre visé
// sans faire croire qu'il est disponible. La section "à venir" reflète
// docs/Backlog.md - les deux doivent être mis à jour ensemble.

const HELP_SECTIONS = [
    {
        title: "Souris",
        rows: [
            ["Clic gauche", "Sélectionner, déplacer"],
            ["Maj + clic", "Ajouter / retirer de la sélection"],
            ["Glisser depuis le vide", "Rectangle de sélection"],
            ["Maj + glisser depuis le vide", "Rectangle additif"],
            ["Clic droit", "Menu contextuel"],
            ["Clic molette", "Déplacer la vue"],
            ["Molette", "Zoomer"],
            ["Double-clic sur un texte", "Éditer le contenu"],
            ["Poignées d'angle", "Redimensionner (proportions conservées)"],
            ["Glisser-déposer un fichier", "Importer une image"],
        ],
    },
    {
        title: "Clavier",
        rows: [
            ["Suppr", "Supprimer la sélection"],
            ["Ctrl + Z", "Annuler"],
            ["Ctrl + Maj + Z, Ctrl + Y", "Rétablir"],
            ["Ctrl + A", "Tout sélectionner / désélectionner"],
            ["Ctrl + V", "Coller une image du presse-papier"],
            ["Ctrl + +, Ctrl + −", "Agrandir / réduire la sélection"],
            ["Maj + 0", "Zoom 100 %"],
            ["Maj + 1", "Ajuster à la vue"],
            ["Alt (maintenu)", "Ignorer le magnétisme pendant un geste"],
            ["N", "Panneau du canevas"],
            ["?", "Cette aide"],
        ],
    },
    {
        title: "Dans un texte en cours d'édition",
        rows: [
            ["Entrée", "Valider"],
            ["Ctrl + Entrée", "Saut de ligne"],
            ["Échap", "Annuler"],
        ],
    },
    {
        title: "Connu comme indisponible",
        rows: [
            ["Ctrl + C, Ctrl + X", "L'API presse-papier exige un contexte sécurisé : inopérant tant que la page est ouverte en file://"],
        ],
        muted: true,
    },
];

const helpPanel = document.getElementById("help-panel");

helpPanel.innerHTML = HELP_SECTIONS.map((section) => `
    <p class="help-title${section.muted ? " help-title-muted" : ""}">${section.title}</p>
    <dl class="help-list">
        ${section.rows.map(([key, description]) => `<dt>${key}</dt><dd>${description}</dd>`).join("")}
    </dl>
`).join("");

function toggleHelpPanel() {
    settingsPanel.classList.add("hidden"); // un seul panneau ouvert à la fois
    helpPanel.classList.toggle("hidden");
}

const helpButton = document.getElementById("help-button");
helpButton.addEventListener("click", toggleHelpPanel);

window.addEventListener("mousedown", (event) => {
    if (!helpPanel.contains(event.target) && event.target !== helpButton) {
        helpPanel.classList.add("hidden");
    }
}, { capture: true });

window.addEventListener("keydown", (event) => {
    if (event.key === "?") {
        event.preventDefault();
        toggleHelpPanel();
    } else if (event.key === "Escape" && !helpPanel.classList.contains("hidden")) {
        toggleHelpPanel();
    }
});
