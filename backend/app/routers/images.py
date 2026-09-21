import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image as PILImage
from PIL import UnidentifiedImageError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Canvas, Image
from .elements import element_to_dict

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

    return element_to_dict(image)
