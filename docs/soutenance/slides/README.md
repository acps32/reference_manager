# Slides de la soutenance

15 slides en 1920 × 1080, posées **dans le board lui-même** : la présentation se fait dans Reference Manager, en zoomant d'une slide à l'autre.

| Fichier | Rôle |
|---|---|
| `slides.html` | la source. Ouverte dans un navigateur : toutes les slides ; `slides.html#8` : la huitième seule |
| `screens/` | les captures utilisées : code (`models.png`, `viewport.png`, `seed.png`) et board de test (`board-1000.png`) |
| `export_slides.py` | photographie chaque slide en PNG dans `png/`, avec Chrome sans interface |
| `import_slides.py` | pose les PNG sur le board par `POST /upload`, aux coordonnées écrites en bas de chaque slide |

## Remettre le board en état de présentation

Depuis `backend/`, venv activé, backend lancé :

```
python reset.py
python ../docs/soutenance/slides/import_slides.py
```

`reset.py` efface aussi les slides : ces deux commandes vont toujours ensemble. Si `slides.html` a changé, lancer `export_slides.py` avant l'import.

**Vérifier le thème avant de commencer.** L'app suit le réglage du navigateur : sur une autre machine, elle peut démarrer en sombre. Panneau ⋮, « Mode sombre » décoché.

## Où sont les choses sur le board

```
  groupes de démo        slides : une colonne en x −9 840, de y 0 à y 19 560
  (Dessin, Design, 3D)   ┌────┐
  à gauche, disposés  ←  │  1 │
  à la main              │  2 │
                         │ …  │
                         │ 15 │
                         └────┘
```

La disposition des groupes vient de `demo_layout.json` : après les avoir retouchés dans l'app, `python ../docs/soutenance/slides/import_slides.py --save` l'enregistre.

Les slides restent hors de la vue chargée au démarrage (caméra en 0, 0).

## Déroulé, environ 20 minutes

| | Slide | Durée | Geste |
|---|---|---|---|
| | Vue d'ensemble | 0:20 | F11, puis Maj+1 : « ma présentation est un board » |
| 1 | Infos | 0:30 | te présenter |
| 2 | Reference Manager | 1:30 | le pitch, puis l'histoire Obsidian |
| 3 | Ce qui existe déjà | 1:00 | |
| 4 | On ne voit qu'une partie du board | 1:00 | |
| 5 | Démo | 3:00 | les exemples, juste à côté de la slide |
| 6 | Les technologies | 1:30 | |
| 7 | Tout est un élément | 1:00 | le N+1 de vive voix, si tu en as envie |
| 8 | L'écran est une caméra | 1:30 | zoome pendant que tu l'expliques |
| 9 | Ne payer que ce qui est à l'écran | 1:00 | |
| 10 | Mesurer, corriger, remesurer | 1:30 | |
| 11 | Le test des 1 000 images | 1:00 | |
| 12 | La mémoire | 1:00 | |
| 13 | Choisir de ne pas faire | 1:00 | |
| 14 | Et ensuite | 0:45 | |
| 15 | Pour conclure | 0:30 | puis Maj+1 : tout le board |

## Naviguer

Molette : zoom centré sur la souris. Clic molette glissé : déplacement.

**Cadrer une slide depuis la vue d'ensemble.** Pointe la slide au même endroit relatif que ta souris dans l'écran, puis zoome : slide en haut à gauche de l'écran, vise son coin haut-gauche ; slide au centre, vise son centre.

Le point sous la souris ne bouge pas pendant le zoom : la slide grossit sur place jusqu'à remplir l'écran.

**Pas de clic gauche sur une slide** : ça la sélectionne, et un glisser la déplace en base. Si ça arrive : Ctrl+Z.

## Si tu changes d'avis pour le test des 1 000 images en direct

Aucune démo en direct n'est prévue. Si tu veux quand même la faire :

- `python seed.py 1000` **sans** `reset.py` avant : le reset effacerait les slides. Aucun conflit, les noms de fichiers du seed sont différents.
- Recharger la page : la barre d'état affiche par exemple « 84 / 1 015 éléments ». Le premier nombre dépend de la taille de la fenêtre (84 en plein écran 1920 × 1080), le total compte aussi les slides.
