import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image as PILImage
from PIL import UnidentifiedImageError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Canvas, Image

router = APIRouter()

# routers/images.py -> parent.parent.parent = backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage" / "images"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def get_or_create_canvas(db: Session) -> Canvas:
    """
    Le MVP n'a qu'un seul canevas, pas d'interface de sélection (voir
    docs/Decisions.md). On récupère le premier enregistrement, ou on le
    crée s'il n'existe pas encore (tout premier appel à l'API).
    """
    canvas = db.query(Canvas).first()
    if canvas is None:
        canvas = Canvas(nom="Canevas principal")
        db.add(canvas)
        db.commit()
        db.refresh(canvas)
    return canvas


def image_to_dict(image: Image) -> dict:
    return {
        "id": image.id,
        "canvas_id": image.canvas_id,
        "nom_original": image.nom_original,
        "chemin_fichier": image.chemin_fichier,
        "x": image.x,
        "y": image.y,
        "width": image.width,
        "height": image.height,
        "z_index": image.z_index,
        "visible": image.visible,
    }


@router.post("/upload")
def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Fichier sans nom.")

    canvas = get_or_create_canvas(db)

    extension = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4()}{extension}"
    destination = STORAGE_DIR / unique_name

    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Lit les dimensions réelles du fichier une fois copié sur disque (pas
    # depuis le flux d'upload, déjà consommé par la copie ci-dessus).
    try:
        with PILImage.open(destination) as pil_image:
            width, height = pil_image.size
    except UnidentifiedImageError:
        destination.unlink()
        raise HTTPException(status_code=400, detail="Fichier image invalide ou non supporté.")

    image = Image(
        canvas_id=canvas.id,
        nom_original=file.filename,
        # .as_posix() force des "/" même sur Windows : chemin_fichier doit
        # rester utilisable tel quel dans une URL (voir frontend/js/api.js).
        chemin_fichier=destination.relative_to(BASE_DIR).as_posix(),
        x=0.0,
        y=0.0,
        width=float(width),
        height=float(height),
        z_index=0,
        visible=True,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    return image_to_dict(image)


@router.get("/images")
def list_images(db: Session = Depends(get_db)):
    images = db.query(Image).all()
    return [image_to_dict(image) for image in images]


class ImageUpdate(BaseModel):
    x: float | None = None
    y: float | None = None
    visible: bool | None = None


@router.patch("/images/{image_id}")
def update_image(image_id: int, update: ImageUpdate, db: Session = Depends(get_db)):
    image = db.get(Image, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail="Image introuvable.")

    # exclude_unset : ne touche que les champs réellement envoyés dans la
    # requête, pas ceux qui valent juste None par défaut.
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(image, field, value)

    db.commit()
    db.refresh(image)

    return image_to_dict(image)
