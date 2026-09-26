# Fiches de révision — soutenance du 28 septembre

Ce dossier n'est pas un support de présentation, c'est ce que tu dois **savoir**. Le support, c'est ton outil lui-même.

## Les fiches

| Fiche | Contenu | Priorité |
|---|---|---|
| [01-vue-densemble.md](01-vue-densemble.md) | Ce qu'est le projet, le périmètre, la stack, l'arborescence | à savoir par cœur |
| [02-backend.md](02-backend.md) | FastAPI, SQLAlchemy, le modèle, chaque route | à savoir par cœur |
| [03-maths-canvas.md](03-maths-canvas.md) | Coordonnées, zoom, grille, redimensionnement, texte | à savoir par cœur |
| [04-performance.md](04-performance.md) | Toute la chaîne d'optimisation, avec les chiffres | ton meilleur atout |
| [05-architecture.md](05-architecture.md) | Les décisions et leur justification | pour les « pourquoi ? » |
| [06-questions.md](06-questions.md) | Questions probables, réponses préparées, faiblesses assumées | à relire en dernier |

## Les trois choses à savoir sans hésiter

Si tu ne retiens que trois blocs, retiens ceux-là. Ce sont ceux sur lesquels on va te pousser.

**1. La conversion écran ↔ monde.** Deux formules inverses l'une de l'autre, et tout le reste en découle (zoom, pan, clic, grille). Fiche 03.

**2. L'héritage à tables jointes et le N+1.** C'est le point technique le plus « certification » du projet : tu as un choix de modélisation, il a une conséquence de performance mesurée, et tu l'as corrigée. Fiche 02 et 04.

**3. La chaîne d'optimisation avec ses chiffres.** 242 Ko → 3,8 Ko, 1001 requêtes → 1, 630 ms → 65 ms. Fiche 04.

## Trois chiffres à retenir tels quels

```
1001 requêtes SQL pour 1000 éléments   ->  1 requête        (N+1, with_polymorphic)
242 Ko et 1000 images par chargement   ->  3,8 Ko et 16     (filtrage par viewport)
33 Mo de RAM par image 4K décodée      ->  plafond ~60 images sans LOD
```

## La démo, dans l'ordre

1. **Ouvrir sur un board vide**, importer quelques vraies images par glisser-déposer.
2. Montrer la manipulation : sélection multiple, déplacement de groupe, redimensionnement, symétrie, texte.
3. **Lancer `python seed.py 1000` en direct** — 3,6 secondes. C'est plus parlant qu'un jeu pré-généré, et ça montre l'outil de test.
4. Recharger : la barre d'état affiche « 84 / 1000 éléments ». Se déplacer : le premier nombre bouge, le second non.
5. Ouvrir l'onglet réseau : une requête par geste, pas par mouvement de souris.

La base est volontairement vide dans le dépôt. `python reset.py` pour repartir à zéro entre deux essais.

## Ce qu'il faut éviter de dire

- Ne compare pas PureRef sur des chiffres que tu n'as pas mesurés. Compare les **architectures** (fiche 06).
- Ne présente pas les groupes comme « à venir » sans dire qu'ils sont **spécifiés et volontairement non implémentés**.
- Ne dis pas « c'est optimisé ». Dis ce que tu as mesuré, avant et après.
