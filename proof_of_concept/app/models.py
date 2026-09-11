from sqlalchemy import Column, Float, Integer, String

from .database import Base


# Hériter de Base est ce qui transforme cette classe Python en "modèle" :
# SQLAlchemy lit ses attributs pour générer la structure de la table SQL
# correspondante (via Base.metadata.create_all() dans main.py).
class Image(Base):
    # Nom réel de la table dans la base SQLite.
    __tablename__ = "images"

    # primary_key=True suffit pour que l'id s'auto-incrémente (1, 2, 3, ...),
    # aucun mot-clé "auto_increment" n'est nécessaire avec SQLAlchemy.
    #
    # index=True n'a rien à voir avec l'auto-incrémentation : ça demande à la
    # base de créer un index sur cette colonne pour accélérer les recherches
    # du type "WHERE id = 5". Sur une primary key, l'index est souvent déjà
    # créé automatiquement par la base, mais le préciser ne fait pas de mal.
    id = Column(Integer, primary_key=True, index=True)

    # Nom du fichier tel qu'uploadé par l'utilisateur (juste pour l'affichage,
    # jamais utilisé comme nom réel sur le disque -> voir uuid dans main.py).
    nom_original = Column(String, nullable=False)

    # Chemin RELATIF à la racine du projet (ex: "storage/images/uuid.png"),
    # pas un chemin absolu propre à une seule machine.
    # unique=True car deux entrées ne devraient jamais pointer vers le même fichier.
    chemin_fichier = Column(String, nullable=False, unique=True)

    # Position sur le futur canevas. Stockées à 0.0 par défaut à l'upload,
    # modifiées plus tard via une route PATCH (pas encore écrite dans ce POC).
    x = Column(Float, nullable=False, default=0.0)
    y = Column(Float, nullable=False, default=0.0)
