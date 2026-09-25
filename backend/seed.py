"""
Génère N images de test réparties en grille, pour pouvoir mesurer le
comportement de l'appli à charge (10 -> 100 -> 1000 images) avant/après le
chargement par viewport. Symétrique de reset.py : celui-ci vide, celui-ci
remplit.

Usage : depuis backend/, venv activé -> python seed.py [nombre]
(200 par défaut)
"""

import math
import sys
import uuid

from PIL import Image as PILImage, ImageDraw

from app.database import Base, SessionLocal, engine
from app.models import Canvas, Image
from app.routers.images import STORAGE_DIR

IMAGE_SIZE = 200  # carré, en pixels ET en unités du monde (1:1, pour rester simple)
SPACING = 260  # écart entre le coin de deux images voisines, en unités du monde
PALETTE = [
    (230, 126, 34), (52, 152, 219), (46, 204, 113), (155, 89, 182),
    (241, 196, 15), (231, 76, 60), (26, 188, 156), (149, 165, 166),
]


def make_test_file(index: int) -> str:
    """Crée un PNG uni avec un numéro dessiné dessus - pas des images vides
    indiscernables les unes des autres pendant les tests."""
    color = PALETTE[index % len(PALETTE)]
    img = PILImage.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), color)
    draw = ImageDraw.Draw(img)
    label = str(index)
    # textbbox plutôt qu'une taille de police fixe : centre le numéro quelle
    # que soit sa longueur (1 chiffre ou 4), sans dépendre d'une police précise.
    bbox = draw.textbbox((0, 0), label)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((IMAGE_SIZE - text_w) / 2, (IMAGE_SIZE - text_h) / 2),
        label, fill="white",
    )

    filename = f"{uuid.uuid4()}.png"
    img.save(STORAGE_DIR / filename)
    return f"storage/images/{filename}"


def main(count: int):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        canvas = db.query(Canvas).first()
        if canvas is None:
            canvas = Canvas(nom="Canevas principal")
            db.add(canvas)
            db.commit()
            db.refresh(canvas)

        # Grille à peu près carrée, pour étaler les images dans les deux
        # dimensions - un test de viewport n'a rien à filtrer si tout est
        # aligné sur un seul axe.
        columns = math.ceil(math.sqrt(count))

        for i in range(count):
            column, row = i % columns, i // columns
            chemin_fichier = make_test_file(i)
            db.add(Image(
                canvas_id=canvas.id,
                nom_original=f"seed_{i}.png",
                chemin_fichier=chemin_fichier,
                x=column * SPACING,
                y=row * SPACING,
                width=float(IMAGE_SIZE),
                height=float(IMAGE_SIZE),
                z_index=0,
                visible=True,
            ))

        # Un seul commit pour les N lignes : passer par POST /upload ferait N
        # requêtes HTTP + N transactions, bien trop lent pour tester à 1000.
        db.commit()
    finally:
        db.close()

    print(f"{count} images de test créées, en grille de {columns} colonnes.")


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    main(n)
