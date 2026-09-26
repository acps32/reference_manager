const API_URL = "http://127.0.0.1:8000";

// rect : { x, y, width, height } en coordonnées monde, ou null pour tout demander (scripts, tests).
async function fetchElements(rect = null) {
    const query = rect ? `?x=${rect.x}&y=${rect.y}&width=${rect.width}&height=${rect.height}` : "";
    const response = await fetch(`${API_URL}/elements${query}`);
    if (!response.ok)
        throw new Error(`Erreur HTTP ${response.status}`);
    return response.json();
}

// centerX/centerY : point du monde où centrer l'image. Le backend en déduit
// le coin haut-gauche une fois les dimensions réelles connues.
async function uploadFile(file, centerX, centerY) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("center_x", centerX);
    formData.append("center_y", centerY);

    const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok)
        throw new Error(`Erreur HTTP ${response.status}`);
}

// Nombre total d'éléments et limites du board, que le frontend ne peut plus déduire de sa
// propre liste puisqu'il n'en charge qu'une partie.
async function fetchSummary() {
    const response = await fetch(`${API_URL}/elements/summary`);
    if (!response.ok)
        throw new Error(`Erreur HTTP ${response.status}`);
    return response.json();
}

async function createText(contenu, x = 0, y = 0) {
    const response = await fetch(`${API_URL}/texts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu, x, y }),
    });

    if (!response.ok)
        throw new Error(`Erreur HTTP ${response.status}`);
}

// Générique : changes = { x, y } pour un déplacement, { visible } pour
// supprimer/restaurer. Marche pour n'importe quel type d'élément (voir
// PATCH /elements/{id} côté backend, qui ne touche que les champs communs).
async function patchElement(id, changes) {
    const response = await fetch(`${API_URL}/elements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
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

// Transforme un élément JSON en objet utilisable par le canevas. Pour une image, attend que le
// fichier soit téléchargé et décodé ; un texte est prêt immédiatement.
async function hydrateElement(element) {
    const base = {
        id: element.id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        visible: element.visible,
    };

    if (element.type === "image") {
        base.image = await loadImage(element.chemin_fichier);
        base.flip_horizontal = element.flip_horizontal;
        base.flip_vertical = element.flip_vertical;
    } else if (element.type === "texte") {
        base.contenu = element.contenu;
        base.font_size = element.font_size;
    }

    return base;
}