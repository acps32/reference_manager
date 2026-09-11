import shutil   # copier un fichier binaire par blocs, sans tout charger en mémoire
import uuid     # générer des identifiants aléatoires quasi impossibles à dupliquer
from pathlib import Path   # manipuler des chemins de fichiers de façon portable (Windows/Linux/Mac)

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Image

# __file__            -> chemin de CE fichier (app/main.py)
# .resolve()          -> le transforme en chemin absolu
# .parent.parent      -> remonte de app/ vers la racine du projet
# Peu importe le dossier depuis lequel on lance "uvicorn", ce chemin reste correct.
BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage" / "images"

# Crée le dossier storage/images/ s'il n'existe pas encore.
# parents=True -> crée aussi les dossiers intermédiaires manquants (storage/).
# exist_ok=True -> ne plante pas si le dossier existe déjà.
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Crée les tables SQL définies dans models.py si elles n'existent pas encore
# dans la base. Ne fait rien si elles existent déjà (pas de perte de données).
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Reference Manager - Proof of Concept")


def get_db():
    """
    Ouvre une session de base de données pour la durée d'une seule requête HTTP,
    puis la referme automatiquement (même si une erreur survient), grâce au
    "yield" + "finally". FastAPI appelle cette fonction via Depends(get_db)
    dans chaque route qui a besoin d'accéder à la base.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def image_to_dict(image: Image) -> dict:
    """
    Convertit un objet Image (SQLAlchemy) en dictionnaire simple.
    Nécessaire car :
    1. FastAPI a besoin de quelque chose de sérialisable en JSON.
    2. Un objet SQLAlchemy reste lié à sa session : y accéder après la
    fermeture de celle-ci (voir get_db) peut lever un DetachedInstanceError.
    Le convertir en dict pendant que la session est encore ouverte évite ce piège.
    """
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
        # HTTPException renvoie un vrai code d'erreur HTTP (ici 400 = mauvaise requête)
        # avec un message clair, plutôt qu'un crash serveur brut (500).
        raise HTTPException(status_code=400, detail="Fichier sans nom.")

    # Path(...).suffix extrait juste l'extension : "photo.png" -> ".png"
    extension = Path(file.filename).suffix

    # Nom de fichier unique pour éviter qu'un second upload appelé "photo.png"
    # n'écrase le premier sur le disque.
    unique_name = f"{uuid.uuid4()}{extension}"
    destination = STORAGE_DIR / unique_name

    # file.file = flux binaire brut du fichier envoyé par le client.
    # copyfileobj copie ce flux vers le disque par blocs successifs,
    # important pour ne pas charger une image très lourde entièrement en RAM.
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    image = Image(
        nom_original=file.filename,
        # Chemin stocké RELATIF au projet (pas absolu), pour que la base
        # reste valide même si tout le dossier du projet est déplacé.
        chemin_fichier=str(destination.relative_to(BASE_DIR)),
        x=0.0,
        y=0.0,
    )
    db.add(image)      # prépare l'insertion (encore en mémoire)
    db.commit()         # écrit réellement en base
    db.refresh(image)   # recharge l'objet depuis la base (récupère l'id généré)

    return image_to_dict(image)


@app.get("/images")
def list_images(db: Session = Depends(get_db)):
    images = db.query(Image).all()
    return [image_to_dict(image) for image in images]
