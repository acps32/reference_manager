"""
Outil de reset pour les tests de charge (voir docs/Roadmap.md, "tester la
montée en charge 10 -> 100 -> 1000 images") : vide entièrement la base
(elements/images/textes/canvas/groupes) et les fichiers de storage/images/,
pour repartir d'un état propre avant ou après un test.

Usage : depuis backend/, venv activé -> python reset.py
"""

from app.database import Base, SessionLocal, engine
from app.models import Canvas, Element, Groupe
from app.routers.images import STORAGE_DIR


def main():
    # Au cas où le script tourne sans que le serveur n'ait jamais démarré
    # (donc sans que les tables n'existent encore) : create_all() ne fait
    # rien si elles sont déjà là.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # db.delete() sur un Element chargé par l'ORM (donc déjà reconstruit
        # en Image/Texte via le polymorphisme) supprime la ligne fille ET la
        # ligne "elements" correspondante, dans le bon ordre.
        for element in db.query(Element).all():
            db.delete(element)

        # Groupes puis canvas : les elements les référencent (FK), donc ils
        # doivent déjà être supprimés avant qu'on puisse supprimer ceux-ci.
        for groupe in db.query(Groupe).all():
            db.delete(groupe)
        for canvas in db.query(Canvas).all():
            db.delete(canvas)

        db.commit()
    finally:
        db.close()

    deleted_files = 0
    for file in STORAGE_DIR.iterdir():
        if file.name == ".gitkeep":
            continue
        file.unlink()
        deleted_files += 1

    print(f"Base vidée, {deleted_files} fichier(s) supprimé(s) dans {STORAGE_DIR}.")


if __name__ == "__main__":
    main()
