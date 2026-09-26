# 05 — Les décisions d'architecture

Une décision se défend par sa **raison** et par son **alternative écartée**. Si tu ne sais dire que ce que tu as fait, ça passe pour un hasard.

## 1. Backend JSON pur, jamais de HTML généré

Le backend n'expose qu'une API JSON. Le frontend est un ensemble de fichiers statiques autonomes.

**La raison, et elle n'est pas esthétique :** la cible à terme est un plugin Obsidian. Un backend qui génère du HTML rendrait le frontend inutilisable ailleurs.

**Ce que ça rapporte, chiffré :** sur 1674 lignes de frontend, **~1403 sont réutilisables telles quelles**, soit environ 84 % — toute la logique canevas, transformations, pointeur, texte, raccourcis, menus, et jusqu'au chargement par vue. Le reste tient dans trois fichiers : `api.js` (98 lignes) à réécrire, `view.js` et `main.js` (173) à adapter (montage dans une `ItemView`, thème délégué à Obsidian).

**Pourquoi c'est si concentré :** `api.js` est la seule couture qui sait qu'un serveur existe. C'est délibéré, et c'est pour ça que j'y ai refusé la logique de cache quand j'ai écrit le chargement par vue — elle est allée dans `viewport.js`.

## 2. Le portage Obsidian

À savoir, parce que c'est ta vision produit et qu'on va sûrement te demander « et après ? ».

**Obsidian est une application Electron, donc un moteur de rendu Chromium.** Deux conséquences opposées :

- le code Canvas 2D y tourne à l'identique — ce n'est pas un portage vers une autre technologie, c'est le même moteur ;
- mais les contraintes mémoire y sont celles d'un onglet de navigateur, **pas** celles d'une application native. Le LOD y serait tout autant nécessaire.

**Deux stratégies restent ouvertes :**

1. Garder le backend Python, lancé en processus enfant par le plugin (`child_process` + HTTP local). `api.js` ne change quasiment pas, mais l'ensemble devient desktop uniquement.
2. Plugin autonome sans Python : on réimplémente les six fonctions de `api.js` sur le vault — `vault.createBinary()` pour les fichiers, `adapter.getResourcePath()` en remplacement de `loadImage()`, l'état du board dans un JSON du vault, exactement ce que sont les fichiers `.canvas` d'Obsidian. Plus de travail, compatible mobile.

**Ce qui survit dans les deux cas :** le modèle de données. L'héritage polymorphe `Element`/`Image`/`Texte` avec son champ discriminant `type` est exactement la forme que prend la même modélisation en JSON. C'est la syntaxe SQLAlchemy qui est spécifique, pas la conception.

**Le coût réel à ne pas minimiser :** la chaîne de build (TypeScript + esbuild) et le passage des scripts à globales partagées vers de vrais modules ES.

## 3. Le stockage des images

**Copie dans `storage/images/`, jamais de référence au chemin d'origine.** Logique « coffre-fort », comme les pièces jointes d'Obsidian : si l'utilisateur déplace ou supprime son fichier source, le board reste intact.

**Nom UUID à la copie.** Évite les collisions entre deux fichiers homonymes. Le nom d'origine est conservé en métadonnée (`nom_original`) pour l'affichage.

**Effet de bord sécurité intéressant :** aucun nom de fichier fourni par l'utilisateur ne sert à construire un chemin sur le disque, donc pas de traversée de répertoire possible (`../../etc/passwd`). C'est une bonne réponse à une question de sécurité.

**Pillow lit les dimensions réelles à l'import.** Revirement assumé du 14 septembre : `width`/`height` doivent décrire l'image, pas une valeur arbitraire (200 × 200 pendant un temps). Et ces valeurs sont devenues critiques plus tard, puisque c'est sur elles que porte le filtre SQL du viewport.

## 4. SQLite, et pas PostgreSQL

Application locale, mono-utilisateur, sans installation. PostgreSQL demanderait un serveur à installer et configurer pour zéro bénéfice ici.

**La limite à connaître, et à citer avant qu'on te la cite :** SQLite n'autorise qu'un seul écrivain à la fois. Sous des `PATCH` rapprochés, un « database is locked » est possible. C'est identifié dans `docs/Optimisations.md`, et la parade côté produit serait le PATCH groupé — déplacer N éléments fait aujourd'hui N requêtes, ça devrait en faire une.

## 5. Pas de framework frontend

**La raison :** le rendu est du Canvas 2D. React, Vue ou Svelte servent à synchroniser un DOM avec un état. Ici il n'y a quasiment pas de DOM à synchroniser — il y a un `<canvas>` qu'on repeint entièrement à chaque frame.

Un framework aurait ajouté une chaîne de build et une abstraction sans rien résoudre du vrai problème, qui est géométrique et mémoire.

**Ce que ça coûte, à assumer :** les scripts classiques partagent un espace global, donc l'ordre de chargement compte, et j'ai rencontré deux bugs de TDZ à cause de ça. La vraie correction, ce sont les modules ES — et elle vient avec la chaîne de build du portage Obsidian.

## 6. Le système de design

**Toute valeur de couleur, rayon, ombre ou taille de police utilisée plus d'une fois est un token CSS** dans `:root`.

Avant cette consolidation, six couleurs étaient codées en dur dans `canvas.js`, hors de portée de tout changement de thème — et l'une d'elles ne correspondait déjà plus à la couleur d'accent réelle.

**Le point technique intéressant :** un `<canvas>` ne sait pas lire de CSS. On ne peut pas y écrire `var(--canvas-grid)`. La solution est un objet `THEME` rempli par `getComputedStyle()` et relu à chaque frame, pour que les couleurs du canevas suivent le même thème que l'interface autour.

**Le mode clair/sombre :** un attribut `data-theme="dark"` sur `<html>`, et seuls les tokens du canevas sont surchargés. Le chrome (panneaux, menus) reste sombre en permanence.

C'est un choix, pas un oubli : *« un panneau flottant sombre reste lisible sur les deux fonds sans bordure ni ombre appuyée ; l'inverse aurait demandé plus d'artifice pour se détacher du canevas sombre. »*

**L'exploration a été faite dans un gabarit isolé** (`frontend/design-lab.html`), jamais lié depuis l'application : images réelles, tous les panneaux posés en dur. La comparaison grille en points contre grille en lignes s'y est faite avec un bouton pour basculer entre les deux sur le même contenu, plutôt qu'en discussion. Les lignes ont gagné.

## 7. L'organisation de l'interface par portée

**Une règle unique :** l'endroit où vit une action dépend de sa portée.

| Portée | Emplacement |
|---|---|
| Action sur la sélection | menu contextuel (clic droit), et barre flottante pour les plus fréquentes |
| Réglage global du canevas | panneau ⋮ |
| Information passive | barre d'état |

Avant, le panneau ⋮ mélangeait une préférence (magnétisme) et des actions sur la sélection (échelle, symétrie), ce qui le rendait illisible.

**Un menu radial façon Blender a été construit puis retiré.** Son apport ne justifiait pas son coût de découvrabilité face à une convention universelle. C'est une décision à assumer : du code écrit puis supprimé n'est pas du temps perdu, c'est une hypothèse testée.

**Les fonctionnalités prévues et non implémentées sont affichées et désactivées**, avec une mention « à venir », plutôt qu'absentes ou faussement fonctionnelles. Le périmètre visé reste lisible sans induire en erreur.

## 8. Les groupes : construits, puis retirés

Une première version « groupe atomique », façon Figma — le groupe se sélectionne et se déplace d'un bloc — a été codée, puis **entièrement retirée**.

**La raison :** ce n'était pas le modèle voulu. Dans un outil de références, un groupe est un **cadre visuel** façon Miro : il regroupe et se déplace avec son contenu, mais ne change pas le comportement des images à l'intérieur, qui restent individuellement manipulables.

La spécification complète est restée dans `docs/Backlog.md` (`GRP-01` à `GRP-07`), l'implémentation non.

**Le raisonnement à exposer :** *« je préfère une fonctionnalité absente et spécifiée à une fonctionnalité présente et mal conçue. La première se rattrape, la seconde induit l'utilisateur en erreur et devient une dette. »*

## 9. La documentation comme partie du projet

`docs/` contient quatre documents vivants, tenus à jour au fil du travail :

| Document | Rôle |
|---|---|
| `Decisions.md` | chaque choix technique et **sa raison**, pour ne pas avoir à s'en souvenir |
| `Roadmap.md` | le planning et son état réel |
| `Backlog.md` | les tickets, avec leur statut — y compris « abandonné » |
| `Optimisations.md` | tous les axes identifiés, mesurés, priorisés, et ceux écartés |

**Ce qui est notable :** le statut « abandonné » existe dans le backlog, et les pièges rencontrés sont notés dans `CLAUDE.md` pour ne pas y retomber. Les messages de commit contiennent les mesures avant/après.

C'est une réponse solide à « comment avez-vous travaillé ? ».
