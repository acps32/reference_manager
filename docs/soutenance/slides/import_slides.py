"""
Pose sur le board les slides exportées (png/slide-NN.png) et les groupes d'images de démo (Image_demo/),
par les vraies routes de l'API : POST /upload, POST /texts, puis PATCH pour la taille et la position.

Usage : backend lancé, venv activé -> python import_slides.py, depuis n'importe où.
reset.py efface tout : relancer ce script après chaque reset.
python import_slides.py --save : enregistre dans demo_layout.json la disposition actuelle des groupes, retouchée à la main dans l'app.
"""

import json
import sys
from pathlib import Path

import httpx
from PIL import Image

API_URL = "http://127.0.0.1:8000"
HERE = Path(__file__).resolve().parent
PNG_DIR = HERE / "png"
DEMO_DIR = HERE / "Image_demo"
LAYOUT_FILE = HERE / "demo_layout.json"
GEOMETRY = ("x", "y", "width", "height")

# Même disposition que le script de slides.html : les slides en colonne, dans l'ordre,
# à gauche de la grille de seed.py (x >= 0), assez loin pour rester hors de la vue chargée au démarrage.
ORIGIN_X = -9840
ORIGIN_Y = 0
COLUMNS = 1  # une seule colonne : les slides les unes sous les autres
PITCH_X = 2160  # 1920 de large + 240 d'écart
PITCH_Y = 1320  # 1080 de haut + 240 d'écart
SLIDE_WIDTH = 1920
SLIDE_HEIGHT = 1080

# Un groupe par dossier, en colonne juste à gauche des slides, en face des lignes 1 à 3.
DEMO_GROUPS = ["Dessin", "Design", "3D"]
GROUP_X = ORIGIN_X - PITCH_X
TITLE_SIZE = 90
IMAGES_TOP = 160  # espace laissé au titre au-dessus des images
TARGET_ROW_HEIGHT = 450
GAP = 20


def upload(path: Path, center_x: float, center_y: float) -> dict:
    with path.open("rb") as file:
        response = httpx.post(
            f"{API_URL}/upload",
            files={"file": (path.name, file)},
            data={"center_x": str(center_x), "center_y": str(center_y)},
        )
    response.raise_for_status()
    return response.json()


def patch(element_id: int, **changes) -> None:
    httpx.patch(f"{API_URL}/elements/{element_id}", json=changes).raise_for_status()


def import_slides(files: list[Path]) -> None:
    for path in files:
        index = int(path.stem.removeprefix("slide-")) - 1
        row, column = divmod(index, COLUMNS)
        # /upload attend le centre visé, pas le coin haut-gauche.
        element = upload(path, ORIGIN_X + column * PITCH_X + SLIDE_WIDTH / 2, ORIGIN_Y + row * PITCH_Y + SLIDE_HEIGHT / 2)
        print(f"{path.name}  ->  x {element['x']:.0f}, y {element['y']:.0f}")


def split_rows(ratios: list[float]) -> list[list[int]]:
    # Autant de lignes qu'il en faut pour approcher TARGET_ROW_HEIGHT, puis coupe dès que la ligne a sa part de largeur.
    row_count = max(1, round(sum(ratios) * TARGET_ROW_HEIGHT / SLIDE_WIDTH))
    share = sum(ratios) / row_count
    rows, current, filled = [], [], 0.0
    for index, ratio in enumerate(ratios):
        current.append(index)
        filled += ratio
        if filled >= share * (len(rows) + 1) - ratio / 2 and len(rows) < row_count - 1:
            rows.append(current)
            current = []
    return rows + [current] if current else rows


def save_layout() -> None:
    # Clé = nom du fichier (images) ou contenu (titres) : les seuls repères stables d'un reset à l'autre.
    demo_files = {path.name for path in DEMO_DIR.rglob("*") if path.is_file()}
    layout = {}
    for element in httpx.get(f"{API_URL}/elements").json():
        key = element.get("nom_original") if element["type"] == "image" else element.get("contenu")
        if key in demo_files or key in DEMO_GROUPS:
            layout[key] = {field: element[field] for field in GEOMETRY + ("font_size",) if field in element}
    LAYOUT_FILE.write_text(json.dumps(layout, indent=2), encoding="utf-8")
    print(f"{len(layout)} élément(s) enregistré(s) dans {LAYOUT_FILE.name}")


def import_group(name: str, top: float, layout: dict) -> None:
    title = httpx.post(f"{API_URL}/texts", json={"contenu": name, "x": GROUP_X, "y": top}).json()
    patch(title["id"], **layout.get(name, {"font_size": TITLE_SIZE, "width": 800, "height": TITLE_SIZE * 1.3}))

    paths = sorted(path for path in (DEMO_DIR / name).iterdir() if path.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
    ratios = []
    for path in paths:
        with Image.open(path) as image:
            ratios.append(image.width / image.height)

    # Lignes justifiées : chaque ligne fait la largeur d'une slide, sa hauteur découle des proportions.
    y = top + IMAGES_TOP
    for row in split_rows(ratios):
        height = (SLIDE_WIDTH - GAP * (len(row) - 1)) / sum(ratios[i] for i in row)
        x = GROUP_X
        for i in row:
            width = ratios[i] * height
            element = upload(paths[i], x + width / 2, y + height / 2)
            # La disposition retouchée à la main, si elle existe, prime sur la disposition calculée.
            patch(element["id"], **layout.get(paths[i].name, {"x": x, "y": y, "width": width, "height": height}))
            x += width + GAP
        y += height + GAP
    print(f"{name}  ->  {len(paths)} image(s)")


def main():
    if "--save" in sys.argv:
        save_layout()
        return

    files = sorted(PNG_DIR.glob("slide-*.png"))
    if not files:
        sys.exit("Aucune slide dans png/ : lancer export_slides.py d'abord.")

    try:
        existing = httpx.get(f"{API_URL}/elements").json()
    except httpx.ConnectError:
        sys.exit("Backend injoignable : depuis backend/, python -m uvicorn app.main:app")
    if existing:
        sys.exit("Le board n'est pas vide : python reset.py d'abord, sinon tout serait en double.")

    layout = json.loads(LAYOUT_FILE.read_text(encoding="utf-8")) if LAYOUT_FILE.exists() else {}
    import_slides(files)
    for row, name in enumerate(DEMO_GROUPS):
        if (DEMO_DIR / name).is_dir():
            import_group(name, ORIGIN_Y + row * PITCH_Y, layout)


if __name__ == "__main__":
    main()
