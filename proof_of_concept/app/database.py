from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# __file__ = chemin de CE fichier (database.py)
# .parent      -> dossier app/
# .parent.parent -> dossier racine du projet (proof_of_concept/)
# On construit un chemin ABSOLU pour que database.db soit toujours créé
# au même endroit, peu importe le dossier depuis lequel on lance uvicorn.
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'database.db'}"

# connect_args={"check_same_thread": False} :
# SQLite refuse par défaut qu'une connexion soit utilisée par plusieurs threads.
# FastAPI peut traiter des requêtes sur des threads différents, donc on désactive
# cette vérification. C'est un compromis propre à SQLite, pas nécessaire avec
# PostgreSQL ou MySQL.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Fabrique de sessions. Chaque requête HTTP va en ouvrir une (voir get_db() dans main.py).
# autocommit=False -> rien n'est écrit en base tant qu'on ne fait pas db.commit() nous-mêmes.
# autoflush=False  -> SQLAlchemy n'envoie pas de requêtes SQL "en avance" avant un commit/query explicite.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Classe de base dont hérite chaque modèle (voir models.py).
# C'est elle qui permet à SQLAlchemy de savoir quelles classes Python
# correspondent à quelles tables SQL.
Base = declarative_base()
