from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Element, Image, Texte

router = APIRouter()


# Un seul sérialiseur pour tous les types d'Element : les champs communs
# viennent de la table "elements", et on ajoute les champs propres au type
# réel de l'objet (Image ou Texte), reconstruit automatiquement par
# l'héritage polymorphique de SQLAlchemy.
def element_to_dict(element: Element) -> dict:
    base = {
        "id": element.id,
        "canvas_id": element.canvas_id,
        "type": element.type,
        "x": element.x,
        "y": element.y,
        "width": element.width,
        "height": element.height,
        "z_index": element.z_index,
        "visible": element.visible,
    }
    if isinstance(element, Image):
        base["nom_original"] = element.nom_original
        base["chemin_fichier"] = element.chemin_fichier
        base["flip_horizontal"] = element.flip_horizontal
        base["flip_vertical"] = element.flip_vertical
    elif isinstance(element, Texte):
        base["contenu"] = element.contenu
        base["font_size"] = element.font_size
    return base


@router.get("/elements")
def list_elements(db: Session = Depends(get_db)):
    # Les éléments supprimés (visible=False) ne sont pas renvoyés : les laisser
    # passer revenait à les faire télécharger et décoder par le navigateur à
    # chaque chargement de page, pour ne jamais les afficher.
    elements = db.query(Element).filter(Element.visible.is_(True)).all()
    return [element_to_dict(element) for element in elements]


class ElementUpdate(BaseModel):
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    visible: bool | None = None
    flip_horizontal: bool | None = None
    flip_vertical: bool | None = None
    contenu: str | None = None
    font_size: float | None = None


@router.patch("/elements/{element_id}")
def update_element(element_id: int, update: ElementUpdate, db: Session = Depends(get_db)):
    # Requête sur Element (pas Image/Texte) : x/y/visible vivent sur la table
    # commune, donc ça marche pour n'importe quel type sans le savoir à l'avance.
    element = db.get(Element, element_id)
    if element is None:
        raise HTTPException(status_code=404, detail="Élément introuvable.")

    changes = update.model_dump(exclude_unset=True)
    if not isinstance(element, Image) and ({"flip_horizontal", "flip_vertical"} & changes.keys()):
        raise HTTPException(status_code=400, detail="La symétrie ne s'applique qu'aux images.")
    if not isinstance(element, Texte) and ({"contenu", "font_size"} & changes.keys()):
        raise HTTPException(status_code=400, detail="Contenu et taille de police ne s'appliquent qu'aux textes.")

    for field, value in changes.items():
        setattr(element, field, value)

    db.commit()
    db.refresh(element)

    return element_to_dict(element)
