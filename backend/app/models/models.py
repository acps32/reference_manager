from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Canvas(Base):
    __tablename__ = "canvas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column()

    elements: Mapped[list["Element"]] = relationship(back_populates="canvas")
    groupes: Mapped[list["Groupe"]] = relationship(back_populates="canvas")


class Groupe(Base):
    __tablename__ = "groupes"

    id: Mapped[int] = mapped_column(primary_key=True)
    canvas_id: Mapped[int] = mapped_column(ForeignKey("canvas.id"))
    nom: Mapped[str] = mapped_column()
    x: Mapped[float] = mapped_column()
    y: Mapped[float] = mapped_column()
    width: Mapped[float] = mapped_column()
    height: Mapped[float] = mapped_column()

    canvas: Mapped["Canvas"] = relationship(back_populates="groupes")
    elements: Mapped[list["Element"]] = relationship(back_populates="groupe")


# Table parente de l'héritage à tables jointes : Image et Texte n'ajoutent que
# leurs champs propres, reliés ici par une FK 1-pour-1 sur "id".
class Element(Base):
    __tablename__ = "elements"

    id: Mapped[int] = mapped_column(primary_key=True)
    canvas_id: Mapped[int] = mapped_column(ForeignKey("canvas.id"))
    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("groupes.id"))
    type: Mapped[str] = mapped_column()
    x: Mapped[float] = mapped_column()
    y: Mapped[float] = mapped_column()
    width: Mapped[float] = mapped_column()
    height: Mapped[float] = mapped_column()
    z_index: Mapped[int] = mapped_column()
    visible: Mapped[bool] = mapped_column(default=True)

    canvas: Mapped["Canvas"] = relationship(back_populates="elements")
    groupe: Mapped[Optional["Groupe"]] = relationship(back_populates="elements")

    __mapper_args__ = {
        # "type" détermine quelle sous-classe (Image/Texte) reconstruire à la lecture.
        "polymorphic_on": "type",
        "polymorphic_identity": "element",
    }


class Image(Element):
    __tablename__ = "images"

    # FK vers elements.id, pas une clé indépendante : c'est ça, la jointure de l'héritage.
    id: Mapped[int] = mapped_column(ForeignKey("elements.id"), primary_key=True)
    nom_original: Mapped[str] = mapped_column()
    chemin_fichier: Mapped[str] = mapped_column(unique=True)
    flip_horizontal: Mapped[bool] = mapped_column(default=False)
    flip_vertical: Mapped[bool] = mapped_column(default=False)

    __mapper_args__ = {"polymorphic_identity": "image"}


class Texte(Element):
    __tablename__ = "textes"

    id: Mapped[int] = mapped_column(ForeignKey("elements.id"), primary_key=True)
    contenu: Mapped[str] = mapped_column()

    __mapper_args__ = {"polymorphic_identity": "texte"}
