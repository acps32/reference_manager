# Journal des décisions

Trace des choix techniques et de leur raison, pour ne pas avoir à se souvenir "pourquoi j'ai fait ça".

## Stack

**FastAPI + SQLAlchemy + SQLite.** Stack déjà connue, le strict nécessaire pour ce projet, pas de sur-ingénierie (pas de Redis, pas de PostgreSQL, pas de microservices).

## Stockage des images

**Copie dans un dossier local (`storage/images/`), jamais de référence au chemin d'origine.** Logique "coffre-fort", comme les pièces jointes d'Obsidian. Chaque fichier est renommé en UUID à la copie pour éviter les collisions de noms ; le nom d'origine est gardé en métadonnée pour l'affichage.

**Pillow utilisée pour lire les dimensions réelles de l'image à l'import (métadonnées), pas pour générer des thumbnails.** Revirement du 14 septembre : connaître la vraie taille du fichier s'est révélé nécessaire dès l'import, pour que `width`/`height` sur `Element` reflètent l'image plutôt qu'une valeur arbitraire (200x200 utilisé un temps). La génération de miniatures reste, elle, hors scope : c'est une optimisation de performance, pas le problème critique identifié par le formateur (qui portait sur la capacité à faire de la gestion d'image du tout, testée via la preuve de concept upload) — à activer seulement si le nombre d'images le justifie.

## Plateforme

**Application web locale (FastAPI sert aussi le frontend), pas d'application bureau, pas de plugin Obsidian pour l'instant.** Une vraie application bureau (Electron/PyQt) ou un plugin Obsidian ajouteraient une techno non maîtrisée sous un délai serré. Confirmé faisable techniquement pour plus tard (un plugin Obsidian desktop peut lancer un processus Python en arrière-plan via `child_process` et lui parler en HTTP local), mais hors scope actuel.

**Contrainte conservée pour permettre cette migration future à coût nul aujourd'hui : le backend n'expose qu'une API JSON, jamais de HTML généré côté serveur. Le frontend reste un ensemble de fichiers statiques autonomes.**

## Chargement par viewport (le point critique du projet)

**Filtrage fait côté backend (requête SQL sur `x`, `y`, `width`, `height`), pas côté frontend.** Le frontend envoie juste les coordonnées de la zone visible ; c'est le serveur qui décide quelles images renvoyer. Choix cohérent avec l'objectif du projet : une vitrine de compétence back-end, pas de rendu front.

## Modèle de données

**Table `canvases` créée dès maintenant, même si un seul canevas est utilisé pour l'instant (pas d'interface de sélection).** Coût d'ajout après coup (migration de données) largement supérieur au coût d'anticipation (une colonne).

**Héritage à tables jointes pour `Element` / `Image` / `Texte`.** Une table `elements` porte les champs communs (position, taille, visibilité, z-index) ; `images` et `textes` n'ajoutent que leurs champs propres. Choisi plutôt que l'héritage à table unique car le besoin réel (récupérer tous les éléments d'un canevas en une requête) demande justement de savoir faire une jointure/union, que l'on a décidé d'apprendre plutôt que d'éviter.

**`Groupe` modélisé (table + `group_id` nullable sur les éléments) mais sans interface.** Même logique que `canvases` : le coût d'anticipation est faible, le coût de rattrapage après coup ne l'est pas.

**Attribut `visible` (booléen) sur les éléments.** À distinguer du chargement par viewport : `visible` est un choix manuel de l'utilisateur (comme un calque caché dans Blender/Photoshop), pas une optimisation automatique liée à la position de la caméra.

## Interface

**Rangement par portée de l'action (24 sept).** Une action sur la sélection va dans le menu contextuel (clic droit) et, pour les plus fréquentes, dans une barre flottante ; un réglage global va dans le panneau ⋮ ; une information passive va dans la barre d'état. Le panneau ⋮ mélangeait auparavant une préférence (magnétisme) et des actions sur la sélection (échelle, symétrie), ce qui rendait l'ensemble illisible.

**Menu radial supprimé (24 sept).** Il avait été construit façon Blender (presser-glisser-relâcher), puis rebranché sur une touche pour laisser le clic droit au menu classique. Retiré ensuite : son apport ne justifiait pas son coût de découvrabilité face à une convention universelle.

**Les fonctionnalités prévues mais non implémentées sont affichées et désactivées**, avec une mention « à venir », plutôt qu'absentes ou faussement fonctionnelles. Le périmètre visé reste lisible sans induire en erreur.

## Texte

**Taille de police stockée explicitement, hauteur du cadre calculée (24 sept).** Avec le retour à la ligne, le nombre de lignes dépend de la police et de la largeur : la hauteur en découle et ne peut donc pas la déterminer. `width` fixe la largeur de retour à la ligne, `font_size` est une colonne sur `Texte`, `height` est recalculée à chaque édition. Redimensionner un texte met la police à l'échelle en même temps que le cadre.

## Contrainte de taille des fichiers

**100 lignes visées par fichier, 150 maximum.** `main.js` avait atteint 692 lignes ; il a été découpé en modules d'une responsabilité chacun. Conséquence à connaître : les scripts étant chargés en `<script defer>` classiques (pas de modules ES), l'ordre des balises dans `index.html` devient significatif — une variable `let` lue avant l'exécution de sa déclaration lève une `ReferenceError`.

## Hors scope assumé (pour rattraper si le temps le permet)

- Interface de sélection/gestion de plusieurs canevas
- Chemin de stockage configurable par canevas (actuellement un seul dossier fixe, `backend/storage/`, câblé en dur). Dépend du multi-canevas ci-dessus — à concevoir ensemble à ce moment-là, pas avant. Impliquera de remplacer le `StaticFiles` actuel par une route dynamique (lisant le chemin en base par canevas), avec une vraie réflexion sécurité (empêcher qu'un chemin sorte du dossier autorisé)
- Groupes : **spécifiés en détail mais non implémentés** (modèle du cadre visuel, voir `Backlog.md`). Une première version « groupe atomique » a été codée puis retirée, son comportement ne correspondant pas au modèle voulu
- Génération de thumbnails / LOD
- Plugin Obsidian, application bureau