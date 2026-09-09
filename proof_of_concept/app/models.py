from sqlalchemy import Column, Float, Integer, String

from .database import Base


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    nom_original = Column(String, nullable=False)
    chemin_fichier = Column(String, nullable=False, unique=True)
    x = Column(Float, nullable=False, default=0.0)
    y = Column(Float, nullable=False, default=0.0)
