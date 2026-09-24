from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Texte
from .elements import element_to_dict
from .images import get_or_create_canvas

router = APIRouter()

# Largeur par défaut = largeur de retour à la ligne à la création.
# Hauteur par défaut = une ligne à la taille de police par défaut
# (16 x 1.3 d'interligne, voir TEXT_LINE_HEIGHT_RATIO dans text-layout.js) :
# la hauteur suit le contenu, elle est recalculée à chaque édition.
DEFAULT_WIDTH = 200.0
DEFAULT_HEIGHT = 21.0


class TextCreate(BaseModel):
    contenu: str
    x: float = 0.0
    y: float = 0.0


@router.post("/texts")
def create_text(payload: TextCreate, db: Session = Depends(get_db)):
    canvas = get_or_create_canvas(db)

    texte = Texte(
        canvas_id=canvas.id,
        contenu=payload.contenu,
        x=payload.x,
        y=payload.y,
        width=DEFAULT_WIDTH,
        height=DEFAULT_HEIGHT,
        z_index=0,
        visible=True,
    )
    db.add(texte)
    db.commit()
    db.refresh(texte)

    return element_to_dict(texte)
