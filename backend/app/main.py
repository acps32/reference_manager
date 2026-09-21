from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from . import models
from .routers import elements, images, texts

# Crée les tables (canvas, groupes, elements, images, textes) si elles
# n'existent pas encore. Ne touche pas aux données existantes sinon.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Reference Manager")

# Frontend et backend tournent sur des origines différentes (ports
# différents) en développement. allow_origins="*" est acceptable ici :
# application locale, jamais exposée publiquement (voir README).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(images.router)
app.include_router(texts.router)
app.include_router(elements.router)

# Chemin absolu (indépendant du dossier de lancement d'uvicorn) : voir
# routers/images.py pour le même besoin. Actuellement un seul dossier fixe
# pour tout le backend ; deviendra une route dynamique lisant le chemin en
# base par canevas quand le multi-canevas sera implémenté (voir docs/Decisions.md).
BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"

app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="static")