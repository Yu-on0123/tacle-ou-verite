# Tacle ou Vérité

Jeu de défis, de tacles et de confessions pour couples et groupes d'amis, jouable dans le navigateur. Rien n'est enregistré : les salons vivent en mémoire et disparaissent à la fin de la partie.

Le nom est provisoire. Pour le changer : `index.html` (titre de l'onglet) et `src/ui.tsx` (le logo en haut de page).

## Ce que fait le jeu

**Deux façons de jouer, dans le navigateur, sans rien installer côté joueurs**
- **Un seul téléphone** : le téléphone passe de main en main. Le maître de la partie le garde pour le dépouillement.
- **Salon en ligne** : chacun sur son téléphone avec un code (ou un lien) à partager.

**Quatre jeux**
- **Tacles et confessions** : les cartes sont face cachée avec un nom au dos. On en retourne une, on écrit « Moi au moins… » ou « Je ne te l'ai jamais dit mais… », on envoie. Au dépouillement, chaque message s'affiche avec le nom de la cible, jamais celui de l'auteur. Si plus personne n'envoie rien, la partie s'arrête : « Le flux de vérités s'est tari ».
- **Dingueries** : une question par joueur, réponses anonymes affichées avec leur question.
- **Sondages (dans Dingueries)** : environ un tour sur trois, à partir de 3 joueurs, la question est un sondage. Les votants la reçoivent en même temps et choisissent la carte d'un joueur (jamais soi-même, vote secret) ; les autres répondent à une question normale. Certaines cartes limitent qui vote et qui peut être choisi (garçons / filles). Le classement passe en premier, dévoilé du dernier au premier : top 3 jusqu'à 6 joueurs, top 5 au-delà, ex æquo ensemble, score du type « 3/4 votes ». Les sondages sont dans `POLLS` (`shared/cards.ts`).
- **Défis** : un défi tiré au sort pour un joueur à la fois, à faire tout de suite, en face-à-face, ou « bon pour plus tard » (noté dans un carnet des dettes). Les défis qui demandent une photo ou un vocal renvoient vers WhatsApp : rien n'est stocké ici.

**Règles d'âge, appliquées par le moteur du jeu (pas seulement affichées)**
- Âge minimum : 13 ans.
- Mode adulte si au moins 60 % des joueurs sont majeurs, sinon mode Ado. Pour un duo majeur + mineur, le maître choisit.
- Un mineur ne reçoit jamais une question adulte, ne peut pas envoyer de contenu adulte et ne peut pas en recevoir. Au dépouillement, une carte adulte est remplacée par « Carte réservée aux adultes » sur son écran.
- Seul le maître de la partie connaît les mineurs. En mode un téléphone, il voit leurs noms avant chaque carte adulte et doit confirmer qu'ils ne regardent pas.
- Le contenu adulte reste suggestif, jamais explicite.

**Guides** : un guide général (bouton « Comment ça marche ? » sur l'accueil, dans les salons et dans le menu des jeux) et une fiche de règles par jeu (petit « ? » à côté de chaque jeu, pour la lire avant de le lancer). Le texte est dans `src/guides.ts`, l'affichage dans `src/Guide.tsx`.

**Réglages du maître** : niveau (Débutant, Moyen, Extrême), durée maximale de réponse (1 à 10 min, 3 par défaut), défis en face-à-face, défis « bon pour plus tard ».

## Lancer sur ton ordinateur

Il faut seulement [Node.js](https://nodejs.org) (version 20 ou plus).

- **Windows** : double-clique sur `LANCER.bat`.
- **Mac / Linux** : `./lancer.sh`
- **Ou à la main** : `npm install` puis `npm run dev`

Ouvre ensuite **http://localhost:5173**. Pour essayer avec ton téléphone sur le même Wi-Fi, ouvre l'adresse « Network » affichée dans le terminal.

## Tester la version de production

```
npm run build
npm start
```

Ouvre **http://localhost:3001**. C'est exactement ce que Render fera tourner.

## Vérifier que tout fonctionne

```
npm run typecheck     # vérification des types
npm test              # tests du moteur du jeu (règles d'âge, sondages, anonymat, niveaux…)
npm run smoke         # joue de vraies parties avec plusieurs clients (le serveur doit tourner : npm start)
```

## Mettre en ligne sur Render

1. Crée un dépôt GitHub et envoie-y ce dossier :
   ```
   git init
   git add .
   git commit -m "Première version"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/tacle-ou-verite.git
   git push -u origin main
   ```
2. Sur [render.com](https://render.com) : **New → Blueprint**, choisis ton dépôt, puis **Apply**. Render lit `render.yaml`, construit l'image Docker et démarre le service tout seul.
3. Au bout de quelques minutes, tu as une adresse du type `https://tacle-ou-verite.onrender.com`. C'est le lien à partager.
4. À chaque `git push`, Render reconstruit et redéploie automatiquement.

Tu n'as pas besoin de Docker sur ta machine : c'est Render qui construit l'image. Pour l'essayer en local malgré tout : `docker build -t tov .` puis `docker run -p 10000:10000 tov`, et ouvre http://localhost:10000.

**À savoir sur l'offre gratuite de Render**
- Le service s'endort après 15 minutes sans trafic et met environ une minute à se réveiller. Les messages échangés pendant une partie comptent comme du trafic : une partie en cours ne s'endort pas.
- Un salon vit en mémoire : s'il y a un redéploiement ou un redémarrage, les salons en cours disparaissent. Les joueurs reviennent à l'accueil.
- La région choisie est Francfort (`render.yaml`), la plus proche de l'Afrique de l'Ouest.
- Pour supprimer l'endormissement, passe le service sur une instance payante (`plan: starter` dans `render.yaml`, ou depuis le tableau de bord).

## Où se trouve quoi

```
shared/engine.ts       le moteur du jeu : règles d'âge, tours, sondages, vues par joueur
shared/engine.test.ts  les tests du moteur
shared/cards.ts        TOUTES les cartes (questions, sondages, défis) : c'est ici qu'on ajoute du contenu
shared/types.ts        les formes de données partagées
server/                serveur Express + Socket.IO, salons en mémoire, chronos, reconnexion
src/                   l'interface React (écrans, mode un téléphone, mode salon)
scripts/smoke.ts       test de fumée avec plusieurs clients
Dockerfile, render.yaml, .dockerignore   déploiement
```

**Ajouter des cartes** : ouvre `shared/cards.ts` et ajoute une ligne. `lv` est le niveau minimum (0 Soft à 3 Extrême), `adult: true` réserve la carte aux adultes. Les défis ont un type : `now` (tout de suite), `physical` (même pièce), `later` (bon pour plus tard), et `media: true` s'ils demandent une photo ou un vocal.

## PWA

L’app peut s’installer sur l’écran d’accueil (manifest + service worker). Le cache ne stocke que la coque visuelle : aucune donnée de partie n’est enregistrée.

## Limites connues

- **L'âge est déclaré, pas vérifié.** Un joueur peut mentir. Le jeu est conçu pour que ça change peu de choses (le contenu adulte reste suggestif), mais ce n'est pas une garantie. Une vraie vérification d'âge demanderait un service tiers.
- **Pas de modération** des messages libres : ce que les joueurs écrivent n'est pas filtré, sauf un petit détecteur de mots pour marquer un tacle comme adulte. Le maître peut retirer un joueur dans le salon d'attente, pas pendant la partie.
- **Le maître qui part** : au bout de 20 secondes hors ligne, le rôle passe au joueur suivant.
- Les cartes couvrent dingueries, sondages, Action ou Vérité, Cap ou Pas Cap, Jacques a dit et défis (~260 entrées), avec tags composition et contenu adulte. Tu peux encore en ajouter dans `shared/cards.ts`.

## Règles d'adaptation des cartes (v3)

- **Composition** : déduite du sexe des joueurs (garçons / filles / mixte). Plus aucun réglage à la main.
- **Nombre de joueurs** : Les sondages et « Jacques a dit » demandent au moins 3 joueurs. À deux, les cartes qui parlent du groupe (« les autres », « ici », « le groupe ») ne sortent jamais ; « la personne de ton choix » devient le prénom de l'autre.
- **Attirance** (`attract: true`) : « Qui ici t'attire le plus ? » ne sort que s'il y a au moins 3 joueurs et au moins 2 joueurs du sexe opposé à celui qui reçoit la carte. À deux, elle ne sort que si l'autre est du sexe opposé et que la carte a une version « à deux ».
- **Texte des cartes** : `{a|b}` = a à deux, b à plusieurs ; `[[a|b]]` = garçon / fille ; `{cible}` = un prénom ; « mis(e) », « doux(ce) » s'accordent seuls. Code dans `shared/speak.ts`.
- **Jacques a dit** : un ordre pour tous, dit ou non « Jacques a dit » au hasard par le moteur (le piège n'est jamais écrit).
- **Action ou Vérité** : le maître peut choisir « vérités à voix haute » (même pièce) : rien n'est écrit.
- Le Quiz a été retiré (doublon avec les dingueries).
