# 02 — Backend : FastAPI et SQLAlchemy

## Le modèle de données

### Le schéma

```
Canvas 1 ──── N Element          (un canevas contient des éléments)
Groupe 1 ──── N Element          (group_id est nullable)

Element (table "elements")       id, canvas_id, group_id, type,
                                 x, y, width, height, z_index, visible
   ├── Image (table "images")    nom_original, chemin_fichier (unique),
   │                             flip_horizontal, flip_vertical
   └── Texte (table "textes")    contenu, font_size
```

### L'héritage à tables jointes

C'est **le** point technique à maîtriser. Trois tables : `elements` porte ce qui est commun, `images` et `textes` portent uniquement leurs champs propres, reliées par une clé étrangère 1-pour-1 sur `id`.

```python
class Element(Base):
    __tablename__ = "elements"
    type: Mapped[str] = mapped_column()
    __mapper_args__ = {
        "polymorphic_on": "type",           # la colonne qui dit quelle sous-classe
        "polymorphic_identity": "element",
    }

class Image(Element):
    __tablename__ = "images"
    id: Mapped[int] = mapped_column(ForeignKey("elements.id"), primary_key=True)
    __mapper_args__ = {"polymorphic_identity": "image"}
```

**Ce que ça change concrètement :** `db.scalars(select(Element))` te rend des objets `Image` et `Texte`, reconstruits automatiquement selon la valeur de la colonne `type`. Tu interroges le parent, tu reçois les enfants.

### Pourquoi celui-là et pas l'héritage à table unique

Trois alternatives existaient :

| Stratégie | Principe | Défaut ici |
|---|---|---|
| Table unique | une seule table, colonnes de tous les types, nullables | `contenu` toujours NULL pour une image ; aucune contrainte possible |
| Table par classe concrète | une table complète par type, rien en commun | impossible de récupérer tous les éléments d'un canevas en une requête |
| **Tables jointes** | commun séparé du spécifique | demande une jointure — c'est le coût assumé |

Le besoin réel du projet, c'est « donne-moi tous les éléments de ce canevas, quel que soit leur type ». Les tables jointes répondent à ça sans colonnes vides, et la jointure est exactement ce que le projet devait apprendre à faire.

**Son coût, à connaître :** le N+1 (voir plus bas).

### Deux décisions de modélisation à savoir défendre

**`Canvas` et `Groupe` existent en base sans interface.** Ajouter une colonne maintenant coûte une ligne ; l'ajouter après coup demande une migration de données. Le coût d'anticipation est très inférieur au coût de rattrapage.

**`visible` est un booléen métier, pas une optimisation.** C'est un choix de l'utilisateur, comme un calque masqué dans Photoshop. À ne pas confondre avec le chargement par viewport, qui est automatique et lié à la caméra. La suppression est donc réversible (Ctrl+Z).

**`font_size` est stocké, `height` est calculé.** Avec le retour à la ligne, le nombre de lignes dépend de la police et de la largeur : la hauteur en découle, elle ne peut donc pas la déterminer.

## L'infrastructure

### `database.py`

```python
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'database.db'}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
```

**Chemin absolu construit depuis le fichier.** Un chemin relatif dépendrait du dossier depuis lequel `uvicorn` est lancé. C'est un piège rencontré en vrai, noté dans `CLAUDE.md`.

**`check_same_thread=False`.** SQLite refuse par défaut qu'une connexion soit utilisée depuis plusieurs threads. FastAPI peut traiter les requêtes sur des threads différents, d'où ce réglage. Acceptable parce que SQLAlchemy donne une session par requête.

### La dépendance `get_db`

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

C'est un générateur : FastAPI exécute jusqu'au `yield`, injecte la session dans la route, puis reprend après le `yield` une fois la réponse produite. Le `finally` garantit la fermeture **même si la route lève une exception**.

Si on te demande ce qu'est l'injection de dépendances : c'est ça. La route déclare `db: Session = Depends(get_db)` et ne sait rien de la façon dont la session est créée ni fermée.

### `main.py`

`Base.metadata.create_all(bind=engine)` crée les tables manquantes au démarrage. Pas de migrations (pas d'Alembic) — voir fiche 06 pour la réponse à préparer.

CORS (_Cross-Origin Resource Sharing_, ou partage de ressources entre origines multiples) ouvert à `*` : frontend et backend sont sur des ports différents en développement. C'est acceptable **parce que l'application est locale et jamais exposée**, et c'est écrit dans le code.

`app.mount("/storage", StaticFiles(...))` sert les fichiers images. C'est la seule chose non-JSON que renvoie le backend.

## Les routes, une par une

### `GET /elements`

Quatre paramètres optionnels `x`, `y`, `width`, `height` en coordonnées monde.

```python
statement = select(all_element_types).where(Element.visible.is_(True))

if None not in (x, y, width, height):
    statement = statement.where(
        Element.x < x + width,
        Element.x + Element.width > x,
        Element.y < y + height,
        Element.y + Element.height > y,
    )
return [element_to_dict(element) for element in db.scalars(statement)]
```

**Les quatre ou aucun :** un rectangle à moitié renseigné n'a pas de sens, et sans ce garde-fou la route casserait pour tout appelant qui n'envoie rien.

**`Element.x + Element.width` ne fait pas d'addition Python.** `Element.x` est un objet colonne ; l'expression construit du SQL, et c'est SQLite qui calcule, ligne par ligne. Résultat réel :

```sql
WHERE elements.visible IS true
  AND elements.x < 1000 AND elements.x + elements.width > 0
  AND elements.y < 1000 AND elements.y + elements.height > 0
```

Le test de chevauchement lui-même est expliqué en fiche 03 — c'est le même que celui du rectangle de sélection côté frontend.

### `GET /elements/summary`

Un agrégat SQL : total et bounding box du board.

```python
count, min_x, min_y, max_x, max_y = db.execute(
    select(func.count(Element.id), func.min(Element.x), func.min(Element.y),
           func.max(Element.x + Element.width), func.max(Element.y + Element.height))
    .where(Element.visible.is_(True))
).one()
```

**Pourquoi elle existe :** depuis que le frontend ne charge qu'une partie des éléments, il ne peut plus déduire le total ni les limites de sa propre liste. Elle sert au cadrage automatique et au compteur « chargés / total ».

Les `min`/`max` valent `NULL` sur un board vide, d'où le garde-fou sur `count` côté frontend.

### `PATCH /elements/{element_id}`

Corps validé par un modèle Pydantic dont **tous les champs sont optionnels** :

```python
changes = update.model_dump(exclude_unset=True)
```

`exclude_unset=True` est la clé : il ne garde que les champs réellement envoyés. Sans lui, envoyer `{"x": 10}` écraserait tout le reste avec des `None`.

Deux garde-fous renvoient un 400 : les champs de symétrie sur autre chose qu'une image, `contenu`/`font_size` sur autre chose qu'un texte.

La requête porte sur `Element` (la table commune), donc la route fonctionne pour n'importe quel type sans le connaître à l'avance.

### `POST /upload`

Le flux complet :

1. `UploadFile` + deux champs `Form` : `center_x`, `center_y`, le point du monde où centrer.
2. Nom unique `uuid4()` + extension, copie par `shutil.copyfileobj` (flux, pas tout en mémoire).
3. **Pillow ouvre le fichier copié** pour lire ses dimensions réelles. Si ce n'est pas une image, le fichier est supprimé et la route renvoie 400.
4. Le coin haut-gauche se calcule depuis le centre : `center_x - width / 2`.
5. `free_position()` décale en diagonale de 24 px tant qu'un élément commence déjà à cet endroit.
6. `chemin_fichier` est relatif et en `.as_posix()` — des `/` même sous Windows, puisque la valeur part telle quelle dans une URL.

**Pourquoi le frontend envoie le centre et pas le coin :** les dimensions réelles de l'image ne sont connues qu'ici, après lecture par Pillow. Le frontend ne peut donc pas calculer le coin lui-même.

### `POST /texts`

Crée un `Texte` avec un contenu et une position. Plus simple : pas de fichier, donc pas de Pillow.

## Le N+1, et sa correction

### Le symptôme

À 1000 éléments, `GET /elements` mettait **630 ms**. Beaucoup, pour du SQLite local sur 1000 lignes. En comptant les requêtes réellement envoyées à la base :

```
1000 éléments sérialisés  ->  1001 requêtes SQL
```

### La cause

`select(Element)` ne lit que la table `elements`. Quand `element_to_dict()` accède ensuite à `element.chemin_fichier`, SQLAlchemy constate qu'il ne l'a pas et part le chercher — **un `SELECT` supplémentaire, pour cette ligne seulement**.

Une requête pour la liste, plus une par élément : c'est la définition du N+1.

### La correction

```python
all_element_types = with_polymorphic(Element, "*")
statement = select(all_element_types).where(...)
```

`with_polymorphic` demande la jointure de toutes les sous-classes **dès le départ**. Tout arrive en une requête.

```
avant   1001 requêtes   634 ms  (base seule)   ~630 ms (HTTP)
après      1 requête     31 ms                  ~65 ms
```

Le gain HTTP (10×) est plus petit que le gain en base (20×) parce que le temps restant n'est plus du SQL : c'est la sérialisation JSON. **La base n'est plus le goulot.**

### Ce qu'il faut savoir en dire

- Le N+1 est la contrepartie connue de l'héritage à tables jointes. Le choix de modélisation reste bon, il fallait juste connaître son coût.
- Le volume transféré n'a pas bougé d'un octet : c'était un problème de **temps serveur**, pas de réseau. Le filtrage par viewport reste donc indispensable.
- Ça n'apparaissait dans aucune liste d'axes d'optimisation. C'est la mesure qui l'a trouvé, pas la relecture du code.

## L'API `select()` de SQLAlchemy 2.0

Toutes les requêtes utilisent le style 2.0, pas l'API `Query` héritée de la 1.x :

```python
db.scalars(select(Canvas)).first()                    # et non db.query(Canvas).first()
db.scalars(select(Element).where(...)).all()
db.execute(select(func.count(...), ...)).one()        # agrégat : execute, pas scalars
```

**`scalars` vs `execute` :** `scalars()` déplie les lignes à une seule colonne et rend directement les objets ; `execute()` rend des `Row`, ce qu'il faut pour un agrégat à plusieurs colonnes.
