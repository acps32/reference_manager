# Plan de route

Projet démarré le 9 septembre 2026, échéance le 25 septembre 2026 (16 jours calendaires).

```
9 sept ──── 14 sept ──── 21 sept ──── 25 sept
   │            │            │            │
  POC        Semaine 1    Semaine 2     Marge
 Pillow      (bases)     (le dur)     + démo
```

## Jours 0 : preuve de concept

Upload d'une image, sauvegarde sur disque (copie + renommage UUID), route qui sert le fichier.

Objectif : lever le doute technique du formateur avant de committer sur le reste du projet.

## Semaine 1 (10 → 14 sept) : les fondations

- Setup du projet (structure back/front, venv, modèle de données SQLAlchemy)
- Canevas quadrillé avec zoom et pan, sans image, juste la mécanique de coordonnées monde/écran
- Import d'images, affichage simple (toutes chargées d'un coup), persistance en base

À la fin de cette semaine : un outil fonctionnel, pas encore optimisé.

## Semaine 2 (15 → 21 sept) : la partie qui compte pour la soutenance

- Sélection multiple et transformations (translation, échelle) via menu
- Chargement dynamique par viewport côté backend (le point le plus risqué du planning, volontairement le plus de jours dessus)

## 22 → 25 sept : marge de sécurité

Non affectée à une fonctionnalité précise. Sert à absorber un dérapage sur la semaine 2, tester la montée en charge (10 → 100 → 1000 images), corriger les bugs, préparer la démo et la présentation.

## Ordre de développement détaillé (niveau code)

1. Preuve de concept isolée : upload, sauvegarde disque, route de service
2. Modèle de données (`Canvas`, `Element`/`Image`/`Texte`, `Groupe`)
3. Canevas : grille, zoom, pan (sans image)
4. Import et affichage simple des images (persistance en base)
5. Sélection multiple et transformations (translation, échelle)
6. Chargement dynamique par viewport (filtrage backend)

## Fonctionnalités du MVP (rappel)

- [ ] Canevas quadrillé avec zoom et pan
- [ ] Import d'images avec coordonnées modifiables
- [ ] Transformations basiques via menu (translation, mise à l'échelle)
- [ ] Sélection multiple
- [ ] Chargement dynamique des images selon le viewport

Voir `decisions.md` pour le détail et la justification de chaque choix technique.