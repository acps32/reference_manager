async function fetchImages() {
    const response = await fetch("http://127.0.0.1:8000/images");
    if (!response.ok)
        throw new Error(`Erreur HTTP ${response.status}`)
    const images = await response.json();
    return images;
}


const API_URL = "http://127.0.0.1:8000";

async function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok)
        throw new Error(`Erreur HTTP ${response.status}`);
}

// Enveloppe le chargement (onload/onerror) dans une Promise, pour pouvoir faire "await loadImage(...)" comme pour fetch().
function loadImage(cheminFichier) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Impossible de charger l'image : ${cheminFichier}`));

        // chemin_fichier vaut déjà "storage/images/uuid.png" (voir routers/images.py), donc pas de "/storage/" à rajouter ici.
        img.src = `${API_URL}/${cheminFichier}`;
    });
}

// Récupère la liste des images (métadonnées) puis charge chaque fichier en parallèle. Retourne les deux infos associées, prêtes pour drawImage().
async function loadAllImages() {
    const images = await fetchImages();

    return Promise.all(
        images.map(async (image) => ({
            id: image.id,
            element: await loadImage(image.chemin_fichier),
            x: image.x,
            y: image.y,
            width: image.width,
            height: image.height,
            visible: image.visible,
        }))
    );
}

// Générique : changes = { x, y } pour un déplacement, { visible } pour
// supprimer/restaurer (voir main.js). Seuls les champs fournis sont modifiés.
async function patchImage(id, changes) {
    const response = await fetch(`${API_URL}/images/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
    });

    if (!response.ok)
        throw new Error(`Erreur HTTP ${response.status}`);
}
