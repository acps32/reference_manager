"""
Générateur de jeu de test pour les mesures de performance, symétrique de reset.py : crée N images
numérotées en grille régulière, par écriture directe en base et non via N requêtes HTTP.

La grille est régulière à dessein : le nombre d'éléments attendus dans un rectangle donné est
calculable à l'avance, ce qui rend le filtrage par viewport vérifiable et pas seulement plausible.

Usage : depuis backend/, venv activé -> python seed.py [nombre]
Lancer reset.py avant, les noms de fichiers étant dérivés de l'index (contrainte d'unicité).
"""

import sys
from pathlib import Path

from PIL import Image as PILImage, ImageDraw, ImageFont

from app.database import Base, SessionLocal, engine
from app.models import Image
from app.routers.images import BASE_DIR, STORAGE_DIR, get_or_create_canvas

IMAGE_SIZE = 200
SPACING = 260
COLUMNS = 32
DEFAULT_COUNT = 1000

# Teintes assez sombres pour que le numéro en blanc reste lisible par-dessus.
PALETTE = [
    (198, 74, 74),    # rouge
    (198, 128, 58),   # orange
    (150, 138, 44),   # ocre
    (92, 150, 74),    # vert
    (58, 140, 140),   # cyan
    (52, 110, 180),   # bleu
    (110, 82, 170),   # violet
    (170, 74, 132),   # magenta
]

# Construite une seule fois : identique pour les N images, la recréer à chaque appel serait du travail refait pour rien.
FONT = ImageFont.load_default(size=48)


def create_test_image(index: int) -> Path:
    color = PALETTE[index % len(PALETTE)]
    image = PILImage.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), color)

    # C'est l'objet Draw qui porte les méthodes de dessin, pas l'image.
    draw = ImageDraw.Draw(image)
    # anchor="mm" : la position passée est le centre du texte et non son coin haut-gauche, d'où le centrage gratuit.
    center = IMAGE_SIZE / 2
    draw.text((center, center), str(index), fill="white", font=FONT, anchor="mm")

    destination = STORAGE_DIR / f"seed_{index:04d}.png"
    image.save(destination)
    return destination


def main():
    # sys.argv[0] est toujours le nom du script, donc l'argument éventuel est en [1], et c'est une chaîne.
    if len(sys.argv) > 1:
        count = int(sys.argv[1])
    else:
        count = DEFAULT_COUNT

    # Au cas où le script tourne sans que le serveur n'ait jamais démarré.
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        canvas = get_or_create_canvas(db)

        for index in range(count):
            path = create_test_image(index)
            # divmod rend le quotient puis le reste : la ligne, puis la colonne.
            row, column = divmod(index, COLUMNS)

            # db.add() ne touche pas encore la base : un seul commit après la boucle, au lieu de N transactions.
            db.add(
                Image(
                    canvas_id=canvas.id,
                    nom_original=path.name,
                    # .as_posix() force des "/" même sous Windows : la valeur part telle quelle dans une URL.
                    chemin_fichier=path.relative_to(BASE_DIR).as_posix(),
                    x=float(column * SPACING),
                    y=float(row * SPACING),
                    width=float(IMAGE_SIZE),
                    height=float(IMAGE_SIZE),
                    z_index=0,
                    visible=True,
                )
            )

        db.commit()
    finally:
        db.close()

    print(f"{count} image(s) générée(s) dans {STORAGE_DIR}, en grille de {COLUMNS} colonnes.")


if __name__ == "__main__":
    main()
