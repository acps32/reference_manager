// ===== Amorçage =====
//
// Chargé en dernier (voir l'ordre des <script> dans index.html) : tout le
// reste doit être défini avant que ce fichier ne dessine la première frame.

resizeCanvas();
render();

// Le chargement est asynchrone (fetch + Image.onload pour les images, voir
// api.js) : le premier render() ci-dessus dessine juste la grille, celui-ci
// rajoute les éléments une fois qu'ils sont réellement prêts.
loadAllElements()
    .then((elements) => {
        loadedElements = elements;
        render();
    })
    .catch((error) => {
        console.error(error);
    });

window.addEventListener("resize", () => {
    resizeCanvas();
    render();
});
