# Plan de route

Projet démarré le 9 septembre 2026. **Soutenance le lundi 28 septembre à midi.**

## Jour 0 (9 sept) : preuve de concept — ✅

Upload d'une image, sauvegarde disque (copie + renommage UUID), route de service. Objectif : lever le doute technique du formateur avant d'engager le reste.

## Fondations (10 → 16 sept) — ✅

- ✅ Structure du projet, venv
- ✅ Modèle SQLAlchemy (`Canvas`, `Element`/`Image`/`Texte`, `Groupe`), héritage à tables jointes
- ✅ Branchement API, dimensions réelles lues via Pillow
- ✅ Canevas quadrillé, zoom et pan (mécanique monde/écran)
- ✅ Import et affichage des images, persistance

## Le dur (17 → 23 sept) — partiellement

- ✅ Sélection multiple (Maj+clic, rectangle), déplacement de groupe
- ✅ Transformations : redimensionnement individuel et de groupe, mise à l'échelle, symétrie
- ✅ Annuler / rétablir, suppression réversible, éléments texte
- ✅ **Chargement dynamique par viewport** — fait le 26 septembre, de bout en bout (filtre SQL, envoi de la vue réelle, limitation de fréquence, déchargement)

## 24 → 26 sept : finition, puis gel

**Gel du code prononcé dans la nuit du 26 au 27**, après la chaîne d'optimisation et une passe de vérification complète. Le dimanche est réservé à la répétition. Modifier la veille d'une soutenance est le meilleur moyen de se présenter avec une régression non détectée.

Réorientation assumée du 24 septembre : la consigne étant d'avoir un projet **à présenter** et non un produit fini, la priorité est passée à la cohérence de l'outil et à la lisibilité du périmètre, plutôt qu'à la dernière fonctionnalité technique.

- ✅ Réorganisation de l'interface par portée (menu contextuel, panneau du canevas, barre d'état, barre flottante)
- ✅ Texte complet : édition, retour à la ligne, centrage, taille réglable
- ✅ Panneau d'aide documentant raccourcis, limites connues et périmètre à venir
- ✅ Découpage de `main.js` (contrainte de 150 lignes par fichier)
- ✅ Backlog de tickets (`Backlog.md`) et analyse d'optimisation chiffrée (`Optimisations.md`)

## Plan des derniers jours

| Jour | Objectif |
|---|---|
| Jeudi 24 | Import au centre de la vue, filtrage des éléments supprimés, script de seed, filtrage viewport côté backend |
| Vendredi 25 | Viewport côté frontend : cache par identifiant, throttling des requêtes, déchargement hors champ |
| Samedi 26 | Montée en charge mesurée (10 → 100 → 1000 images), correction de bugs, **gel le soir** |
| Dimanche 27 | Répétition de la présentation, aucun code |

## État des fonctionnalités du MVP

- [x] Canevas quadrillé avec zoom et pan
- [x] Import d'images avec coordonnées modifiables
- [x] Transformations basiques (translation, mise à l'échelle, symétrie)
- [x] Sélection multiple
- [x] **Chargement dynamique des images selon le viewport**

## Ce qui reste, et pourquoi

Le chargement par viewport était le point identifié dès le départ comme le plus risqué ; il est fait depuis le 26 septembre (filtre SQL, envoi de la vue réelle, throttling, déchargement mémoire). `Optimisations.md` en garde l'analyse complète et les chiffres avant/après.

Le reste du travail identifié (tests automatisés, LOD, modules ES, groupes, multi-canevas...) est volontairement laissé pour l'après-soutenance : voir `Backlog.md`, seule source de vérité sur ce qui est fait, prévu, ou assumé non fait.

Voir `Decisions.md` pour la justification des choix techniques.
