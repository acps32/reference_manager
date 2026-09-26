# 06 — Questions probables et faiblesses assumées

## Comment répondre quand tu ne sais pas

Trois formulations qui te sauvent, et qui valent mieux qu'une improvisation :

> « Je ne l'ai pas mesuré, donc je ne veux pas avancer un chiffre. Ce que je sais, c'est… »

> « Je ne l'ai pas implémenté. C'est identifié dans le backlog sous tel ticket, avec le coût estimé. »

> « Je ne sais pas. Voilà comment je m'y prendrais pour le savoir. »

**Un jury sanctionne beaucoup plus une affirmation fausse qu'un « je ne sais pas » suivi d'une méthode.**

## Sur la modélisation

**« Pourquoi l'héritage à tables jointes plutôt qu'une table unique ? »**
→ Fiche 02. Le besoin réel est « tous les éléments d'un canevas, quel que soit leur type ». La table unique imposerait des colonnes toujours nulles (`contenu` pour une image) et interdirait toute contrainte `NOT NULL` sur les champs spécifiques. Le coût assumé est la jointure — et le N+1 qu'elle a révélé, que j'ai mesuré et corrigé.

**« Pourquoi une colonne `type` alors que SQLAlchemy pourrait deviner ? »**
→ Il ne peut pas deviner : en partant de la table `elements`, rien ne dit quelle table fille joindre. `polymorphic_on` désigne la colonne qui porte l'information. C'est le même motif qu'une union discriminée en JSON ou en TypeScript.

**« `Canvas` et `Groupe` existent sans interface, pourquoi ? »**
→ Ajouter une colonne aujourd'hui coûte une ligne ; l'ajouter après coup demande une migration de données. Coût d'anticipation très inférieur au coût de rattrapage.

**« Pourquoi `visible` plutôt qu'un vrai `DELETE` ? »**
→ Pour rendre la suppression annulable (Ctrl+Z) sans recopier le fichier. Attention à ne pas le confondre avec le chargement par viewport : `visible` est un choix de l'utilisateur, le viewport est automatique.

## Sur les performances

**« Comment savez-vous que c'est plus rapide ? »**
→ Toute la fiche 04. Donne un chiffre, pas une impression : 1001 requêtes SQL pour 1000 éléments, ramenées à 1.

**« Comment avez-vous trouvé le N+1 ? »**
→ Les 630 ms m'ont paru beaucoup pour du SQLite local sur 1000 lignes. J'ai branché un écouteur sur l'événement `before_cursor_execute` du moteur pour compter les requêtes réellement envoyées. 1001.

**« Votre filtre renvoie 16 éléments, comment savez-vous que ce sont les bons ? »**
→ **La meilleure question possible pour toi.** La grille du script de seed est régulière, donc le nombre attendu est calculable à l'avance. Et les fichiers renvoyés sont `seed_0000` à `0003`, `0032` à `0035`, `0064` à `0067`, `0096` à `0099` : le carré 4 × 4 en haut à gauche d'une grille de 32 colonnes.

**« Pourquoi deux marges différentes pour charger et décharger ? »**
→ L'hystérésis. Avec un seuil unique, un élément sur la limite serait déchargé puis rechargé à chaque micro-mouvement. Même principe qu'un thermostat.

**« Pourquoi `img.src = ""` ? »**
→ Retirer l'objet du tableau le rend seulement éligible au ramasse-miettes, à un moment qu'on ne choisit pas. Couper la source libère le bitmap décodé immédiatement.

**« Combien d'images votre outil supporte-t-il ? »**
→ Réponds par le raisonnement, pas par un nombre unique. ~60 images 4K sans LOD, contre 1000+ avec, en partant de ~2 Go utilisables dans un onglet et de 33 Mo par image 4K décodée.

**« Pourquoi ne pas avoir fait le LOD ? »**
→ Fiche 04, dernière section. La génération est facile, l'affichage sans clignotement ne l'est pas, et il touche le rendu et le zoom.

## Sur la comparaison avec l'existant

**« En quoi c'est mieux que PureRef ? »**
→ **Ne réponds pas sur les fonctionnalités, tu perdrais.** Réponds sur l'architecture :

> « PureRef est une application native : elle peut se permettre de tout garder en mémoire en pleine résolution, son budget est la RAM de la machine. Moi je suis dans un navigateur, avec un plafond de l'ordre de 2 à 4 Go par onglet, et au-delà l'onglet ne ralentit pas, il meurt. Cette contrainte m'a obligé à faire un travail d'architecture qu'une application native peut éviter : chargement par vue et déchargement. C'est plus contraignant à court terme, et ça monte mieux en charge par construction — mais je parle du plafond de l'architecture, pas d'une parité fonctionnelle que je n'ai pas. »

**Ne cite aucun chiffre sur PureRef que tu n'as pas mesuré toi-même.**

## Sur la sécurité

**« Votre CORS est ouvert à tout. »**
→ Assumé et commenté dans le code : application locale, jamais exposée. En exposition publique, il faudrait restreindre `allow_origins` à l'origine du frontend, et le reste suivrait (authentification, HTTPS).

**« Que se passe-t-il si j'uploade un fichier malveillant ? »**
→ Réponse en trois temps, et les trois comptent :

1. Le fichier est ouvert par Pillow. Si ce n'est pas une image, il est **supprimé du disque** et la route renvoie 400.
2. Le nom sur le disque est un UUID, jamais le nom fourni. Donc **aucune traversée de répertoire possible**.
3. **La faiblesse que j'ai identifiée :** l'extension, elle, vient encore du nom fourni par l'utilisateur. Un fichier polyglotte — valide comme image et interprétable comme HTML — pourrait être stocké en `.html` et servi par `StaticFiles` avec le mauvais type MIME. Le correctif tient en une ligne : dériver l'extension de `pil_image.format` plutôt que du nom d'origine. Je ne l'ai pas fait avant le gel, c'est dans mes points suivants.

**Soulève-le toi-même.** Montrer qu'on a identifié une faiblesse vaut infiniment mieux que se la faire trouver.

**« Pas d'authentification ? »**
→ Application locale mono-utilisateur, hors périmètre assumé. Le modèle est prêt côté données (un `Canvas` est déjà une entité), ce serait le point d'accroche.

## Sur les tests et l'outillage

**« Où sont vos tests ? »**
→ La question la plus prévisible. Réponds franchement, puis montre ce que tu as :

> « Je n'ai pas de tests automatisés, et c'est ma principale dette. Ce que j'ai, c'est un harnais de charge en Node qui rejoue tous les scripts du frontend dans l'ordre réel de `index.html` avec un DOM bouchonné, puis appelle les fonctions contre le vrai backend. Il attrape les erreurs d'ordre de chargement, les déclarations en double, et vérifie le comportement du chargement par vue : combien d'éléments sont chargés, si les références d'objets survivent, si une image éloignée est bien libérée, et si 300 mouvements de souris ne produisent qu'une requête. »

**Et sache dire ce que tu ajouterais en premier :** `pytest` + le `TestClient` de FastAPI sur les routes. Trois tests prioritaires :

1. `GET /elements` avec un rectangle renvoie exactement les éléments attendus (le jeu de seed rend l'assertion calculable)
2. `PATCH` avec un champ de symétrie sur un texte renvoie bien 400
3. `POST /upload` avec un fichier qui n'est pas une image renvoie 400 **et ne laisse rien sur le disque**

**« Pas de migrations ? »**
→ `Base.metadata.create_all()` crée les tables manquantes, mais ne modifie pas une table existante. Concrètement, ajouter une colonne aujourd'hui demanderait de recréer la base. Alembic est la réponse standard ; je ne l'ai pas installé parce que le schéma s'est stabilisé tôt et que le coût ne se justifiait pas sur la durée du projet. Sur un projet qui vit, c'est indispensable.

## Sur le frontend

**« Pourquoi pas React ? »**
→ Fiche 05, point 5. Un framework synchronise un DOM avec un état ; ici il n'y a quasiment pas de DOM, il y a un canevas repeint entièrement à chaque frame.

**« Pourquoi Canvas plutôt que des `<div>` ou du SVG ? »**
→ Avec du DOM, 1000 images font 1000 nœuds, et le navigateur recalcule styles et disposition pour chacun. Le canevas est un seul nœud : on peint et le navigateur n'a rien à réconcilier. La contrepartie, c'est qu'on perd tout gratuitement — pas de clic natif, pas de retour à la ligne, pas d'accessibilité. Il faut tout réécrire, y compris le test de survol et le découpage du texte.

**« Vos fichiers dépassent la limite que vous vous êtes fixée. »**
→ Trois fichiers sur 20. `main.js` faisait 692 lignes et a été découpé en 8 modules. Les trois restants sont dans le backlog (`REF-02`, `REF-03`). Découper un fichier de rendu la veille d'une démo est un risque que j'ai refusé.

**« Expliquez-moi le zoom. »**
→ Fiche 03, section 3. **Sache la démontrer au tableau en trois lignes.** C'est la question technique la plus probable du projet.

## Les faiblesses à connaître avant qu'on les trouve

| Faiblesse | Où | Ta réponse |
|---|---|---|
| Aucun test automatisé | tout le projet | Dette principale assumée, harnais de charge en remplacement partiel, plan `pytest` prêt |
| Pas de migrations | `create_all` | Alembic est la réponse, schéma stabilisé tôt |
| Extension d'upload non validée | `images.py` | Identifiée, correctif d'une ligne connu |
| Pas de limite de taille à l'upload | `images.py` | Même famille, à traiter ensemble |
| `z_index` jamais persisté | modèle | L'ordre d'affichage vient du tableau frontend, perdu au rechargement (`ELM-02`) |
| Aucun retour visuel en cas d'échec réseau | `api.js` | Les erreurs partent dans `console.error`, invisibles pour l'utilisateur (`UI-06`) |
| Scripts à globales partagées | `index.html` | Ordre significatif, deux bugs de TDZ rencontrés, modules ES en correction |
| SQLite mono-écrivain | base | Possible « database is locked », parade = PATCH groupé |
| Duplication d'élément impossible | `chemin_fichier unique=True` | Empêche deux éléments de pointer le même fichier (`ELM-01`) |

## Si on te demande « et ensuite ? »

Dans cet ordre, et sache dire pourquoi c'est cet ordre :

1. **Les tests automatisés.** Parce que tout le reste devient risqué sans eux.
2. **Le LOD.** Parce que c'est le levier qui fait passer la capacité de 60 à 1000+ images.
3. **Les modules ES et la chaîne de build.** Parce que ça supprime une famille entière de bugs et que c'est le prérequis du portage Obsidian.
4. **Les groupes.** Déjà spécifiés, il ne reste qu'à implémenter.
5. **Le multi-canevas.** Le modèle est prêt, il manque l'interface.

## Ta phrase de conclusion

Si tu dois résumer le projet en une phrase, prends celle-là plutôt qu'une liste de fonctionnalités :

> « Le sujet de ce projet n'est pas d'afficher des images, c'est de rester utilisable quand il y en a beaucoup. J'ai mesuré avant de corriger, corrigé ce qui était mesurable, et documenté avec leur coût les choses que j'ai choisi de ne pas faire. »
