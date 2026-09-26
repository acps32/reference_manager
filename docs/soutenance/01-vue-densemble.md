# 01 — Vue d'ensemble

## Le pitch, en trois phrases

Reference Manager est un tableau de références visuelles pour artistes : on y dépose des images, on les déplace librement sur un canevas infini, on zoome, on annote.

C'est une application web locale : un backend Python qui expose une API JSON, et un frontend statique qui dessine tout dans un `<canvas>`.

Le problème central du projet n'est pas d'afficher des images, c'est de **rester utilisable quand il y en a beaucoup** — un board de référence grossit sans arrêt.

## Le périmètre

**Fait et fonctionnel :** import (bouton, glisser-déposer, presse-papier), déplacement, sélection multiple au rectangle, déplacement de groupe, redimensionnement à proportions bloquées, symétrie horizontale/verticale, éléments texte avec retour à la ligne, suppression, annuler/rétablir, magnétisme sur la grille, zoom/pan, cadrage automatique, mode clair/sombre, barre d'état, panneau d'aide, chargement par viewport.

**Modélisé en base mais sans interface :** `Canvas` (multi-canevas) et `Groupe`.

**Spécifié et volontairement non implémenté :** les groupes façon cadre visuel (tickets `GRP-01` à `GRP-07` dans `docs/Backlog.md`). Une première version « groupe atomique » a été codée puis **retirée**, parce que son comportement ne correspondait pas au modèle voulu.

**Identifié, chiffré, non implémenté :** le LOD (miniatures), l'index R-Tree, la déduplication par hash, le PATCH groupé. Voir fiche 04.

La formulation à employer : *« ces éléments sont dans le backlog avec leur spécification et leur coût estimé, pas dans le code à moitié faits. »*

## La stack, et pourquoi

| Techno | Version | Pourquoi celle-là |
|---|---|---|
| FastAPI | 0.141.1 | Typage natif, validation par Pydantic, documentation OpenAPI générée |
| SQLAlchemy | 2.0.52 | ORM, et surtout l'héritage à tables jointes dont le modèle a besoin |
| SQLite | intégré | Base d'une application locale mono-utilisateur, zéro installation |
| Pillow | 12.3.0 | Lecture des dimensions réelles à l'import, génération du jeu de test |
| python-multipart | 0.0.32 | Requis par FastAPI dès qu'une route reçoit un `UploadFile` |
| JavaScript nu | — | Aucun framework : le rendu est du Canvas 2D, React n'apporterait rien (voir fiche 06) |

## L'arborescence

```
backend/
  app/
    main.py            FastAPI, CORS, montage des routeurs et de /storage
    database.py        moteur, session, Base, dépendance get_db
    models/models.py   Canvas, Groupe, Element -> Image, Texte
    routers/
      elements.py      GET /elements, GET /elements/summary, PATCH /elements/{id}
      images.py        POST /upload
      texts.py         POST /texts
  storage/images/      les fichiers copiés, nommés en UUID
  seed.py              génère N images de test en grille
  reset.py             vide la base et le stockage
  database.db          SQLite

frontend/
  index.html           la page, et l'ordre de chargement des scripts
  css/style.css        tokens de design, thème clair/sombre
  js/                  17 fichiers, un rôle chacun
  design-lab.html      maquette isolée ayant servi à l'exploration visuelle

docs/                  Decisions, Roadmap, Backlog, Optimisations, soutenance/
proof_of_concept/      la preuve de concept initiale, gardée telle quelle
```

## Les 17 fichiers du frontend

Ils sont chargés en `<script defer>` classiques, donc **l'ordre dans `index.html` compte** (voir fiche 03, piège de la TDZ).

| Fichier | Rôle |
|---|---|
| `api.js` | seule couche qui sait qu'un serveur existe : `fetch` et rien d'autre |
| `canvas.js` | état de la caméra, conversions, tout le dessin |
| `viewport.js` | chargement par vue : rectangle, fusion, limitation de fréquence, déchargement |
| `text-layout.js` | découpage du texte en lignes (`measureText`) |
| `state.js` | variables d'interaction partagées entre modules |
| `actions.js` | actions durables sur les éléments + pile d'annulation |
| `transform.js` | calcul pur : redimensionnement, mise à l'échelle, symétrie |
| `pointer.js` / `pointer-commit.js` | souris pendant le geste / à la validation du geste |
| `view.js` | zoom, cadrage, import, panneau ⋮ |
| `shortcuts.js` | raccourcis clavier |
| `text-edit.js` | édition d'un texte via un `<textarea>` posé sur le canevas |
| `context-menu.js` | menu contextuel (clic droit) |
| `status-bar.js` | barre d'état, purement passive |
| `selection-toolbar.js` | barre flottante suivant la sélection |
| `help.js` | panneau d'aide |
| `main.js` | amorçage, chargé en dernier |

## La contrainte de taille de fichier

100 lignes visées, 150 maximum. Trois fichiers dépassent : `canvas.js` (351), `view.js` (152), `style.css` (384).

**Assume-le, ne l'esquive pas :** *« `main.js` faisait 692 lignes, je l'ai découpé en 8 modules. Les trois fichiers restants sont identifiés dans le backlog (`REF-02`, `REF-03`), je ne les ai pas découpés faute de temps et parce que découper un fichier de rendu la veille d'une démo est un risque que j'ai refusé de prendre. »*

## Le workflow Git

Deux branches : `main` et `dev`. Tout le travail se fait sur `dev`.

Commits en anglais, messages détaillés qui expliquent **pourquoi** et pas seulement quoi — plusieurs contiennent les mesures avant/après. C'est un point à montrer si on te parle de méthode : `git log` est une partie de la documentation du projet.
