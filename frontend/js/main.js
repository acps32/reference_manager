// ===== Amorçage =====
//
// Chargé en dernier (voir l'ordre des <script> dans index.html) : tout le
// reste doit être défini avant que ce fichier ne dessine la première frame.

resizeCanvas();
render();

// Le chargement est asynchrone (fetch + décodage des images, voir api.js) : le premier render()
// ci-dessus ne dessine que la grille, loadViewport() ajoute les éléments une fois qu'ils sont prêts.
loadViewport().catch((error) => {
    console.error(error);
});

window.addEventListener("resize", () => {
    resizeCanvas();
    // La fenêtre a changé de taille, donc la zone visible aussi : des éléments peuvent manquer.
    loadViewport().catch((error) => {
        console.error(error);
    });
});
