"""
Générateur de jeu de test pour les mesures de performance, symétrique de
reset.py : crée N images numérotées et les dispose en grille régulière, par
écriture directe en base (et non N requêtes HTTP), donc en quelques secondes.

La régularité de la grille est volontaire : elle rend calculable à l'avance le
nombre d'éléments attendus dans un rectangle donné (largeur / SPACING colonnes
x hauteur / SPACING lignes). C'est ce qui permet de *vérifier* le filtrage par
viewport plutôt que de le constater à l'oeil.

Usage : depuis backend/, venv activé -> python seed.py [nombre]
Lancer reset.py avant : les noms de fichiers sont dérivés de l'index, donc un
second passage entrerait en collision avec la contrainte d'unicité sur
chemin_fichier.
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

# Construite une seule fois : la police est identique pour les N images, la
# reconstruire à chaque appel serait du travail refait 1000 fois pour rien.
FONT = ImageFont.load_default(size=48)


def create_test_image(index: int) -> Path:
    color = PALETTE[index % len(PALETTE)]
    image = PILImage.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), color)

    # C'est l'objet Draw qui porte les méthodes de dessin, pas l'image.
    draw = ImageDraw.Draw(image)
    # anchor="mm" : la position passée est le centre du texte et non son coin
    # haut-gauche, ce qui évite de mesurer la largeur du numéro pour le centrer.
    center = IMAGE_SIZE / 2
    draw.text((center, center), str(index), fill="white", font=FONT, anchor="mm")

    destination = STORAGE_DIR / f"seed_{index:04d}.png"
    image.save(destination)
    return destination


def main():
    # sys.argv est la liste des mots tapés dans le terminal. Le premier est
    # toujours le nom du script lui-même, donc l'argument éventuel est en [1] -
    # et c'est une chaîne de caractères même quand on tape un nombre.
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

            # db.add() ne touche pas encore la base, il marque seulement l'objet
            # comme "à écrire" : un seul commit après la boucle suffit donc, au
            # lieu de N transactions (et N synchronisations disque).
            db.add(
                Image(
                    canvas_id=canvas.id,
                    nom_original=path.name,
                    # .as_posix() force des "/" même sous Windows : chemin_fichier
                    # doit rester utilisable tel quel dans une URL (frontend/js/api.js).
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
