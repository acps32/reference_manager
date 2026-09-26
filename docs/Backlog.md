# Backlog

Source de vérité unique : ce qui existe, ce qui est prévu, ce qui est volontairement laissé de côté. Le panneau d'aide "?" de l'application doit refléter cette liste (ticket `UI-07`).

Les tickets de performance ne sont pas répétés ici : voir `Optimisations.md`.

## Contrainte transverse : longueur des fichiers

**Cible 100 lignes par fichier, 150 maximum.** État après le découpage de `main.js` (`REF-01`) :

| Fichier | Lignes | Statut |
|---|---|---|
| `frontend/js/canvas.js` | 314 | dépasse (`REF-02`) |
| `frontend/css/style.css` | 213 | dépasse (`REF-03`) |
| tous les autres fichiers front | ≤ 138 | conforme |
| tout le backend | ≤ 79 | conforme |

| ID | Titre | Portée | État |
|---|---|---|---|
| REF-01 | Découper `main.js` en modules | front | fait |
| REF-02 | Découper `canvas.js` (314 lignes) en géométrie (conversions, hit-testing) et dessin | front | à faire |
| REF-03 | Découper `style.css` (213 lignes) par zone d'interface | front | à faire |

Découpage issu de `REF-01` (l'ordre des `<script>` dans `index.html` suit cette liste) :

| Fichier | Responsabilité | Lignes |
|---|---|---|
| `state.js` | état d'interaction partagé entre modules | 26 |
| `status-bar.js` | barre d'état (information seule) | 43 |
| `help.js` | panneau d'aide : raccourcis et périmètre à venir | 103 |
| `selection-toolbar.js` | barre flottante d'actions sur la sélection | 80 |
| `actions.js` | actions sur les éléments + historique annuler/rétablir | 88 |
| `transform.js` | calcul pur : redimensionnement, échelle, symétrie | 138 |
| `pointer.js` | souris : début et suivi du geste | 117 |
| `pointer-commit.js` | souris : validation du geste (historique + `PATCH`) | 78 |
| `view.js` | zoom, import, panneau du canevas | 120 |
| `shortcuts.js` | raccourcis clavier | 55 |
| `main.js` | amorçage seul, **chargé en dernier** | 24 |

Contrainte de ce découpage : les scripts sont chargés en `<script defer>` classiques (pas de modules ES), donc les variables globales restent partagées, mais **l'ordre des balises dans `index.html` est significatif** — une déclaration `let`/`const` lue avant son exécution lève une `ReferenceError` (piège déjà rencontré). D'où `state.js` tôt et `main.js` en dernier.

## Interface

| ID | Titre | Portée | État |
|---|---|---|---|
| UI-01 | Menu contextuel classique au clic droit (actions sur la sélection) | front | fait |
| UI-02 | ~~Pie menu~~ **supprimé** : rebranché sur Tab puis retiré, l'apport ne justifiait pas le coût de découvrabilité face à un menu contextuel classique | front | abandonné |
| UI-03 | Panneau ⋮ devenu le **panneau du canevas** : import, réglages d'affichage, et entrées à venir marquées comme telles. Scale et Flip partis dans le menu contextuel | front | fait |
| UI-04 | Barre d'état passive : nb d'éléments, zoom %, taille de la sélection | front | fait |
| UI-05 | Barre flottante d'icônes suivant la sélection (éditer le texte, symétries, supprimer) | front | fait |
| UI-06 | Retour visuel en cas d'échec réseau (aujourd'hui `console.error` uniquement) | front | à faire |
| UI-08 | Choisir un style (exploré dans `design-lab.html`) et l'appliquer dans `style.css` | front | fait |
| UI-09 | Retirer `theme.js` et son sélecteur une fois `UI-08` fait — outil de test, pas une fonctionnalité de l'appli | front | fait |
| UI-10 | Retirer `frontend/design-lab.html`/`design-lab.css` une fois `UI-08` fait — gabarit isolé, jamais lié depuis `index.html` | front | à discuter |
| UI-11 | Mode clair / sombre : bascule dans le panneau du canevas, persistée (`localStorage`), respecte `prefers-color-scheme` au premier chargement | front | fait |
| UI-07 | Panneau d'aide "?" listant raccourcis et fonctionnalités, avec marquage explicite du non implémenté | front | fait |

Raccourcis ajoutés avec cette réorganisation : **Ctrl +** / **Ctrl −** mettent la sélection à l'échelle (l'équivalent des anciens boutons du panneau ⋮), **Maj+0** ramène le zoom à 100 %.

Le panneau d'aide (`UI-07`) liste raccourcis et limites connues ; la section « à venir » qui listait aussi les fonctionnalités prévues a été retirée (25 sept, choix volontaire) — ce backlog reste la seule source pour ça. Les entrées non encore implémentées du panneau ⋮ restent, elles, **affichées et désactivées**, avec une mention « à venir » : le périmètre visé y reste lisible sans faire croire à une fonctionnalité disponible. Chacune correspond à un ticket ci-dessous (`NAV-04` à `NAV-07`, viewport et miniatures dans `Optimisations.md`).

Principe de rangement retenu : **par portée de l'action**. Sur la sélection → menu contextuel, doublé par la barre flottante pour les gestes les plus fréquents. Global/préférence → panneau ⋮. Information passive → barre d'état. Outil modal → raccourci + indicateur dans la barre d'état.

Les boutons ⋮ et ? forment une colonne en haut à droite ; leurs panneaux s'ouvrent à gauche de cette colonne pour ne pas la recouvrir.

## Performance (viewport)

| ID | Titre | Portée | État |
|---|---|---|---|
| PERF-01 | Script de seed (`backend/seed.py`) pour générer N images de test en grille | back | fait |
| PERF-02 | `GET /elements` filtré par viewport (x/y/width/height), facultatif et rétrocompatible | back | fait |
| PERF-03 | Le frontend envoie son viewport réel à `GET /elements` au lieu de tout demander | front | fait |
| PERF-04 | Debounce des requêtes viewport pendant un pan/zoom continu | front | fait |
| PERF-05 | Décharger les images qui sortent du viewport (libérer la mémoire, pas seulement arrêter de les demander) | front | fait |
| PERF-06 | Corriger le N+1 de `GET /elements` (`with_polymorphic`) : 1001 requêtes / 630 ms → 1 / 65 ms | back | fait |
| PERF-07 | Rendu coalescé sur la frame (`requestRender`) pour le seul `mousemove` ; les 19 autres `render()` restent synchrones | front | fait |
| PERF-08 | `GET /elements/summary` (total + bounding box) : corrige `zoomToFit`, qui cadrait sur les seuls éléments chargés, et alimente le compteur « chargés / total » | back+front | fait |
| PERF-09 | Culling client — **écarté après mesure** : `loadedElements` ne contient plus que ce qui est près de la vue, il n'y a quasiment plus rien à écarter au dessin | front | abandonné |

Détail et chiffres mesurés : voir `Optimisations.md`.

## Éléments : texte

| ID | Titre | Portée | État |
|---|---|---|---|
| TXT-01 | Éditer le contenu d'un texte existant (double-clic) | front + back | fait |
| TXT-02 | Taille du texte réglable (police fixe), via les poignées de redimensionnement | front + back | fait |
| TXT-03 | Couleur du texte | front + back | assumé non fait |
| TXT-04 | Retour à la ligne automatique à la largeur du cadre | front | fait |
| TXT-05 | Texte centré dans son cadre, police système au lieu de `sans-serif` | front | fait |
| TXT-06 | Régler la **largeur du cadre indépendamment de la police** : aujourd'hui les poignées mettent les deux à l'échelle ensemble, donc impossible de resserrer le retour à la ligne sans rétrécir le texte | front | à faire |

Décision TXT-02/04 : avec le retour à la ligne, le nombre de lignes dépend de la taille de police et de la largeur — la hauteur en **découle**, elle ne peut donc pas la déterminer. Modèle retenu : `width` = largeur de retour à la ligne, `font_size` = colonne explicite sur `Texte`, `height` = recalculée à chaque édition. Redimensionner un texte met la police à l'échelle en même temps que le cadre (`geometryOf()` dans `main.js` regroupe ces champs pour l'annulation comme pour le `PATCH`).

Raccourcis de saisie : Entrée valide, Ctrl+Entrée insère un saut de ligne, Échap annule, perdre le focus valide.

Limites connues : pendant la saisie le `<textarea>` approxime le centrage vertical en suivant la hauteur de son contenu ; un mot plus long que le cadre déborde au lieu d'être coupé.

## Éléments : groupes — spécifié, non implémenté

Le modèle retenu est celui du **cadre visuel** (façon Miro), pas du groupe atomique (façon Figma) : un groupe est un rectangle persisté qui ne change pas le comportement des éléments qu'il contient. Chacun reste sélectionnable et déplaçable individuellement.

| ID | Titre | Portée | État |
|---|---|---|---|
| GRP-01 | Cadre persisté et dessiné avec son étiquette ; `Groupe.x/y/width/height` deviennent des données réelles | front + back | assumé non fait |
| GRP-02 | Appartenance **spatiale** : ce qui est dans le rectangle appartient au groupe, recalculée à chaque déposer | front + back | assumé non fait |
| GRP-03 | Sélection du groupe par sa **bordure ou son étiquette**, pas par son intérieur vide | front | assumé non fait |
| GRP-04 | Déplacer le cadre emmène son contenu ; le redimensionner ne redimensionne pas le contenu | front + back | assumé non fait |
| GRP-05 | Dissoudre (le cadre part, les éléments restent) / supprimer avec le contenu | front + back | assumé non fait |
| GRP-06 | Renommer le groupe (`Groupe.nom`, déjà en base) | front + back | assumé non fait |
| GRP-07 | Annuler / rétablir un groupement | front + back | assumé non fait |

**Raison du report (24 septembre)** : une première version « groupe atomique » a été codée puis **retirée volontairement**, son comportement ne correspondant pas au modèle voulu. Le coût réel n'est pas le dessin du cadre, c'est qu'un cadre introduit une **deuxième classe d'objet sélectionnable**, alors que toute la machinerie existante (sélection, glisser, annulation, poignées, suppression) suppose qu'une sélection est un ensemble d'éléments. Ce ricochet traverse tout `main.js`, déjà hors norme de longueur (`REF-01`). Préféré : une spécification complète assumée plutôt qu'un comportement à moitié cohérent.

`Groupe` et `group_id` restent donc modélisés sans interface, comme prévu dans `Decisions.md`.

## Éléments : transformations et organisation

| ID | Titre | Portée | État |
|---|---|---|---|
| ELM-01 | Dupliquer sans recopier le fichier (nouvelle ligne `Element`, même `chemin_fichier`) | front + back | à faire |
| ELM-02 | Ordre de profondeur avant-plan / arrière-plan, avec persistance de `z_index` | front + back | à faire |
| ELM-03 | Aligner et répartir la sélection | front | à faire |
| ELM-04 | Niveaux de gris par élément (`ctx.filter`, une colonne comme pour la symétrie) | front + back | à faire |
| ELM-05 | Rotation | front + back | à faire |
| ELM-06 | Verrouiller un élément (empêche déplacement et redimensionnement) | front + back | à faire |
| ELM-07 | Masquer / afficher, distinct de la suppression | front | à faire |
| ELM-08 | Opacité | front + back | à faire |
| ELM-09 | Rangement automatique sans chevauchement | front | assumé non fait |
| ELM-10 | Inversion des valeurs | front | assumé non fait |
| ELM-11 | Importer au **centre de la vue** (au point du lâcher pour un glisser-déposer), avec décalage en cascade si l'emplacement est déjà occupé | front + back | fait |

Note ELM-01 : `chemin_fichier` est déclaré `unique=True` dans `models.py` ; cette contrainte doit être levée pour que deux éléments partagent le même fichier.

## Navigation et outils

| ID | Titre | Portée | État |
|---|---|---|---|
| NAV-01 | Zoom 100 % (Maj+0) | front | fait |
| NAV-02 | Afficher / masquer la grille | front | fait |
| NAV-03 | Pipette à couleur (`getImageData`) | front | à faire |
| NAV-04 | Minimap | front | à faire |
| NAV-05 | Multi-canevas : créer, changer, renommer (`Canvas` modélisé, une seule ligne utilisée aujourd'hui) | front + back | à faire |
| NAV-06 | Exporter le canevas en image | front | à faire |
| NAV-07 | Dossier de stockage configurable par canevas (voir `Decisions.md`, dépend du multi-canevas) | front + back | à faire |

## Connu cassé

| ID | Titre | Portée | État |
|---|---|---|---|
| BUG-01 | Ctrl+C / Ctrl+X inopérants : l'API Clipboard exige un contexte sécurisé, or le frontend est ouvert en `file://` | front | bloqué |
| BUG-02 | Les éléments supprimés (`visible: false`) sont quand même renvoyés puis téléchargés et décodés | back | fait |
| BUG-03 | `z_index` existe en base mais n'est ni lu ni écrit (couvert par ELM-02) | front + back | à faire |

Note BUG-01 : se résout en servant le frontend en `http://` plutôt qu'en fichier local. Le coller (Ctrl+V) fonctionne, lui, via l'événement `paste`.

## Déjà fait

Canevas quadrillé, zoom, pan · import par glisser-déposer, presse-papier et sélecteur de fichiers · déplacement · sélection multiple (Maj+clic et rectangle) · redimensionnement individuel et de groupe · suppression réversible · annuler/rétablir · tout sélectionner · zoom to fit · magnétisme (snap) · échelle ± · symétrie horizontale/verticale · script de reset pour les tests de charge.
