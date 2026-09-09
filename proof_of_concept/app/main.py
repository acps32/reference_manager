import shutil
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Image

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage" / "images"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Reference Manager - Proof of Concept")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def image_to_dict(image: Image) -> dict:
    return {
        "id": image.id,
        "nom_original": image.nom_original,
        "chemin_fichier": image.chemin_fichier,
        "x": image.x,
        "y": image.y,
    }


@app.post("/upload")
def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Fichier sans nom.")

    extension = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4()}{extension}"
    destination = STORAGE_DIR / unique_name

    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    image = Image(
        nom_original=file.filename,
        chemin_fichier=str(destination.relative_to(BASE_DIR)),
        x=0.0,
        y=0.0,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    return image_to_dict(image)


@app.get("/images")
def list_images(db: Session = Depends(get_db)):
    images = db.query(Image).all()
    return [image_to_dict(image) for image in images]
