# Plan de route

Projet démarré le 9 septembre 2026, échéance le 25 septembre 2026 (16 jours calendaires).

```
9 sept ──── 16 sept ──── 23 sept ── 25 sept
   │            │            │          │
  POC        Fondations   Le dur      Marge
```

## Jour 0 (9 sept) : preuve de concept — ✅ fait

Upload d'une image, sauvegarde sur disque (copie + renommage UUID), route qui sert le fichier.

Objectif : lever le doute technique du formateur avant de committer sur le reste du projet.

## Fondations (10 → 16 sept)

- ✅ Setup du projet (structure back/front, venv)
- ✅ Modèle de données SQLAlchemy (`Canvas`, `Element`/`Image`/`Texte`, `Groupe`)
- ✅ Branchement API du modèle (`backend/app/main.py` + `backend/app/routers/images.py` + `requirements.txt`), dimensions réelles lues via Pillow
- ✅ Canevas quadrillé avec zoom et pan, sans image, juste la mécanique de coordonnées monde/écran
- 🔶 Import d'images, affichage simple (toutes chargées d'un coup), persistance en base — prochaine étape immédiate ; nécessite aussi la route de service (`GET` du fichier), jamais écrite jusqu'ici

**Ajustement du 14 sept :** la semaine 1 devait s'arrêter le 14, mais le canevas et l'import/affichage n'ont pas démarré (le modèle de données a pris plus de place que prévu — héritage à tables jointes + `Canvas`/`Groupe`). Fondations repoussées de 2 jours (10 → 16 au lieu de 10 → 14), marge réduite d'autant (4 → 2 jours) en fin de planning plutôt que de toucher à la semaine 2, qui reste le vrai risque du projet.

À la fin de cette phase : un outil fonctionnel, pas encore optimisé.

## Le dur (17 → 23 sept) : la partie qui compte pour la soutenance

- 🔲 Sélection multiple et transformations (translation, échelle) via menu
- 🔲 Chargement dynamique par viewport côté backend (le point le plus risqué du planning, volontairement le plus de jours dessus)

## 24 → 25 sept : marge de sécurité

Non affectée à une fonctionnalité précise. Sert à absorber un dérapage sur la phase précédente, tester la montée en charge (10 → 100 → 1000 images), corriger les bugs, préparer la démo et la présentation.

## Ordre de développement détaillé (niveau code)

1. ✅ Preuve de concept isolée : upload, sauvegarde disque, route de service
2. ✅ Modèle de données (`Canvas`, `Element`/`Image`/`Texte`, `Groupe`)
3. ✅ Branchement API (`main.py`, routeur `images.py`) sur ce modèle — équivalent du POC mais avec le vrai schéma
4. ✅ Canevas : grille, zoom, pan (sans image)
5. 🔶 Import et affichage simple des images (persistance en base)
6. 🔲 Sélection multiple et transformations (translation, échelle)
7. 🔲 Chargement dynamique par viewport (filtrage backend)

## Fonctionnalités du MVP (rappel)

- [ ] Canevas quadrillé avec zoom et pan
- [ ] Import d'images avec coordonnées modifiables
- [ ] Transformations basiques via menu (translation, mise à l'échelle)
- [ ] Sélection multiple
- [ ] Chargement dynamique des images selon le viewport

Voir `decisions.md` pour le détail et la justification de chaque choix technique.