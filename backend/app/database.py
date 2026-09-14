from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Chemin absolu construit depuis ce fichier : le résultat ne dépend jamais
# du dossier depuis lequel `uvicorn` est lancé.
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'database.db'}"

# SQLite refuse par défaut qu'une connexion soit utilisée par plusieurs threads ;
# FastAPI peut traiter des requêtes sur des threads différents, d'où ce flag.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
