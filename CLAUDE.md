# Reference Manager — contexte projet

Projet de fin de formation (Full Stack Python Developer), échéance le 25 septembre 2026. Voir `docs/decisions.md` et `docs/roadmap.md` pour le détail complet.

## Comment travailler avec moi (Anthony)

Je préfère écrire le code moi-même plutôt que de le recevoir tout fait. Aide-moi à comprendre et à structurer, propose des squelettes ou pointe les erreurs, mais laisse-moi taper le code sauf si je demande explicitement de le générer. Si je bloque plus de 15-20 min ou demande un choix d'architecture, là oui, tranche et explique.

## Pièges déjà rencontrés (ne pas refaire perdre du temps dessus)

- Le venv doit être activé avec `source .venv/Scripts/activate` sous Git Bash (pas `.\venv\Scripts\Activate.ps1`, qui est la syntaxe PowerShell).
- `uvicorn` (la commande CLI) peut être absente du venv même si `fastapi` y est installé : toujours vérifier avec `pip list` ou lancer via `python -m uvicorn ...`.
- Toute commande `uvicorn` doit être lancée depuis la racine du sous-dossier contenant `app/` (`proof_of_concept/` pour le POC, `backend/` pour le vrai projet une fois le code écrit là), sinon `ModuleNotFoundError: No module named 'app'`.
- `python-multipart` est requis dès qu'une route utilise `UploadFile`/`File`, FastAPI ne le rappelle qu'à l'exécution.
- Chemins de fichiers (base SQLite, dossier de stockage) toujours construits en absolu via `Path(__file__).resolve().parent...`, jamais en relatif nu, sinon le résultat dépend du dossier depuis lequel `uvicorn` est lancé.

## Décisions d'architecture à respecter

- Backend API JSON pur, jamais de HTML généré côté serveur (contrainte gardée pour une éventuelle migration future vers un plugin Obsidian, hors scope actuel).
- Images copiées dans `storage/images/` avec un nom UUID, jamais référencées à leur chemin d'origine.
- Chargement par viewport filtré côté backend (requête SQL sur x/y/width/height), jamais côté frontend.
- Modèle `Element`/`Image`/`Texte` en héritage à tables jointes (SQLAlchemy `polymorphic_on`), pas à table unique.
- `Canvas` et `Groupe` sont modélisés dès maintenant mais sans interface pour l'instant : ne pas construire leur UI sans qu'on en discute explicitement.

Détails complets et raisons de chaque choix : `docs/decisions.md`.
