/**
 * Contenu des guides : le guide général et une fiche par jeu.
 * Tout est ici (texte pur) : pour corriger une règle, on modifie ce fichier.
 * Les clés des jeux suivent le catalogue du menu : « tacle-1 » = « Je ne te l’ai jamais dit mais… »,
 * « tacle-0 » = « Moi au moins… ».
 */

export type GameGuideId = 'tacle-1' | 'tacle-0' | 'ding' | 'defi' | 'aov' | 'cap' | 'jacques';
export type GuideFocus = GameGuideId | 'general';

export interface GameGuide {
  id: GameGuideId;
  title: string;
  tagline: string;
  /** Condition pour jouer (nombre de joueurs, même pièce…). */
  needs?: string;
  steps: string[];
  tips: string[];
}

export interface GuideSection {
  title: string;
  items: string[];
}

export const GENERAL_GUIDE: { intro: string; sections: GuideSection[] } = {
  intro:
    'Tacle ou Vérité est un jeu de confessions, de questions et de défis pour couples et groupes d’amis. Tu choisis l’intensité, puis vous enchaînez les jeux. Le but : se dire les choses, sans filtre.',
  sections: [
    {
      title: 'Démarrer',
      items: [
        '« Un seul téléphone » : vous êtes ensemble et le téléphone passe de main en main. Le premier joueur ajouté le garde pour dévoiler les cartes.',
        '« Salon en ligne » : l’un crée le salon et partage le code ou le lien, les autres rejoignent. Chacun joue sur son téléphone, à distance ou dans la même pièce.',
        'Il faut au moins 2 joueurs. Certains jeux demandent plus de monde ou d’être dans la même pièce : c’est indiqué sur leur fiche.',
      ],
    },
    {
      title: 'Le maître de la partie',
      items: [
        'C’est celui qui a créé la partie. Il choisit les jeux et règle la partie ; les autres voient ce qu’il lance.',
        'Il peut changer le niveau et les réglages à tout moment depuis le menu des jeux (bouton « Réglages »).',
      ],
    },
    {
      title: 'Les trois niveaux',
      items: [
        'Débutant : basique, pour s’échauffer. Des questions et des défis simple pour passer un bon moment.',
        'Moyen : la tension monte. Crush, jalousie, confessions, des aveux qui peuvent piquer.',
        'Extrême : on y va à fond. Aveux lourds, confessions hot, plus de filtre, on balance tout.',
        'Le niveau choisi domine. Avec Moyen et Extrême, il arrive qu’une carte du niveau juste en dessous revienne pour respirer ; l’Extrême ne redescend jamais jusqu’au Débutant.',
      ],
    },
    {
      title: 'Âge et contenu',
      items: [
        'Il faut avoir au moins 13 ans pour jouer.',
        'Le jeu passe en mode adulte si au moins 60 % des joueurs sont majeurs, sinon il reste en mode Ado. À deux, c’est le maître qui choisit l’ambiance : Tout public ou Osée.',
        'Un mineur ne reçoit jamais de carte adulte et ne peut ni en envoyer ni en lire : la carte est remplacée par « Carte réservée aux adultes » sur son écran.',
        'Le contenu adulte reste suggestif, jamais explicite.',
      ],
    },
    {
      title: 'Anonymat',
      items: [
        'En groupe, l’auteur d’un message ou d’une réponse n’est jamais affiché, et les votes des sondages sont secrets.',
        'À deux, il n’y a pas d’anonymat : on se parle directement, sans couverture.',
      ],
    },
    {
      title: 'Les réglages utiles',
      items: [
        'Durée maximale pour répondre : de 1 à 10 minutes, 3 par défaut.',
        '« Même pièce » : active les défis en face-à-face et « Jacques a dit ».',
        '« Les vérités se répondent à voix haute » (même pièce) : on lit la carte et on répond de vive voix, sans rien écrire.',
        '« Défis bon pour plus tard » : un défi peut être noté dans le carnet des dettes, à rattraper en vrai. Pratique pour 2 ou 3 joueurs qui se reverront en physique.',
      ],
    },
    {
      title: 'Respect et vie privée',
      items: [
        'Tu peux toujours passer un défi. Personne n’est obligé de faire ce qui le met mal à l’aise.',
        'Rien n’est enregistré : à la fin de la partie, tout s’efface.',
        'Les défis qui demandent une photo ou un vocal passent par WhatsApp : rien n’est stocké ici.',
      ],
    },
  ],
};

export const GAME_GUIDES: Record<GameGuideId, GameGuide> = {
  'tacle-1': {
    id: 'tacle-1',
    title: 'Je ne te l’ai jamais dit mais…',
    tagline: 'Dis enfin à quelqu’un ce que tu gardais pour toi.',
    needs: 'À partir de 2 joueurs.',
    steps: [
      'Chaque joueur voit des cartes, une par autre joueur, avec un prénom au dos.',
      'Retourne la carte de la personne à qui tu veux parler et complète la phrase « Je ne te l’ai jamais dit mais… ».',
      'Envoie ton message. Tu peux écrire à autant de personnes que tu veux, tant que le temps n’est pas écoulé.',
      'Quand tu as fini, appuie sur « J’ai fini d’écrire ».',
      'Au dépouillement, chaque message s’affiche avec le prénom de la personne visée, jamais celui de l’auteur. À deux, vous lisez tout ensemble.',
    ],
    tips: [
      'Un message peut être envoyé en « Version osée » : option réservée aux adultes, les mineurs ne le voient pas.',
      'Si personne n’écrit rien, le jeu s’arrête de lui-même.',
      'Un aveu peut être doux autant que piquant : c’est toi qui choisis.',
    ],
  },
  'tacle-0': {
    id: 'tacle-0',
    title: 'Moi au moins…',
    tagline: 'Tacle quelqu\'un en une phrase.',
    needs: 'À partir de 2 joueurs.',
    steps: [
      'Chaque joueur voit des cartes, une par autre joueur, avec un prénom au dos.',
      'Retourne la carte de la personne que tu veux tacler et complète la phrase « Moi au moins… ». Exemple : « Moi au moins, je ne vide pas le frigo des autres. »',
      'Envoie ton tacle. Tu peux tacler plusieurs personnes tant que le temps n’est pas écoulé.',
      'Quand tu as fini, appuie sur « J’ai fini d’écrire ».',
      'Au dépouillement, chaque tacle s’affiche avec le prénom de la cible, jamais celui de l’auteur. À deux, vous lisez tout ensemble.',
    ],
    tips: [
      'Un bon tacle est direct : on parle sans filtre.',
      'Si personne n’écrit rien, le jeu s’arrête de lui-même.',
    ],
  },
  ding: {
    id: 'ding',
    title: 'Dingueries',
    tagline: 'Une question pour chacun, des réponses sans filtre.',
    needs: 'À partir de 2 joueurs. Les sondages arrivent à partir de 3 joueurs.',
    steps: [
      'Chaque joueur reçoit sa propre question.',
      'Écris ta réponse. En groupe, ton nom reste caché.',
      'Quand tout le monde a répondu, ou que le temps est écoulé, les réponses s’affichent une par une avec leur question, sans nom d’auteur.',
      'À vous de deviner qui a dit quoi.',
    ],
    tips: [
      'Environ un tour sur trois est un sondage : tout le monde reçoit la même question en même temps et choisit la carte d’un joueur. On ne peut pas voter pour soi-même et le vote est secret.',
      'Certains sondages ne concernent qu’un sexe : par exemple « Qui est la plus belle ici ? » est voté par les garçons, parmi les filles. Ceux qui ne votent pas répondent à une question normale pendant ce temps.',
      'Le classement du sondage est dévoilé du dernier au premier, avec le nombre de votes, avant les réponses des autres.',
      'À deux, il n’y a pas de sondage : vous lisez les réponses ensemble.',
    ],
  },
  defi: {
    id: 'defi',
    title: 'Défis',
    tagline: 'Un défi, un joueur. Pas d’échappatoire (ou presque).',
    needs: 'À partir de 2 joueurs.',
    steps: [
      'Un défi est tiré au sort pour un joueur à la fois.',
      'Tout le monde voit le défi. À deux, l’autre le voit.',
      'Le joueur appuie sur « C’est fait » une fois le défi réalisé, ou sur « Passer » s’il préfère ne pas le faire.',
      'Certains défis sont « bon pour plus tard » : ils sont notés dans le carnet des dettes, à rattraper en vrai.',
    ],
    tips: [
      'Les défis en face-à-face demandent d’être dans la même pièce (réglage « Même pièce »).',
      'Les défis qui demandent une photo ou un vocal passent par WhatsApp. Rien n’est enregistré par le jeu.',
      'Les défis « bon pour plus tard » s’activent ou se désactivent dans les réglages.',
    ],
  },
  aov: {
    id: 'aov',
    title: 'Action ou Vérité',
    tagline: 'À ton tour : action ou vérité ?',
    needs: 'À partir de 2 joueurs.',
    steps: [
      'Chaque joueur passe à son tour. Il choisit « Action » ou « Vérité ».',
      'Vérité : une question t’est posée. Tu écris ta réponse, ou tu réponds de vive voix si le réglage « vérités à voix haute » est actif. La question et la réponse sont partagées.',
      'Action : un défi s’affiche pour tout le monde. Tu le fais, puis tu appuies sur « C’est fait ».',
      'Au tour suivant, on passe au joueur d’après.',
    ],
    tips: [
      'Le niveau réglé par le maître s’applique aux deux : un Extrême, c’est aussi une vérité plus piquante.',
      'Comme pour les défis, une action peut être « bon pour plus tard » et finir dans le carnet des dettes.',
    ],
  },
  cap: {
    id: 'cap',
    title: 'Cap ou Pas Cap',
    tagline: 'Cap ? Tu le fais, ou tu passes.',
    needs: 'À partir de 2 joueurs.',
    steps: [
      'Une carte « Cap de… » est tiré au sort pour un joueur.',
      'Tout le monde voit la carte. Le joueur répond « Cap ! » ou « Pas Cap ».',
      'S’il dit « Cap ! », il réalise le défi puis appuie sur « C’est fait » (ou « Abandonner » s’il renonce en route).',
      'S’il dit « Pas Cap », on passe à la suite.',
    ],
    tips: [
      'Un « Cap ! » est un engagement devant les autres : réfléchis avant de répondre.',
      'Certains caps peuvent être notés « pour plus tard » dans le carnet des dettes.',
    ],
  },
  jacques: {
    id: 'jacques',
    title: 'Jacques a dit',
    tagline: 'Un ordre pour tous. Obéis seulement s’il commence par « Jacques a dit ».',
    needs: 'À partir de 3 joueurs, dans la même pièce (réglage « Même pièce »).',
    steps: [
      'Un ordre s’affiche en même temps pour tous les joueurs.',
      'S’il commence par « Jacques a dit », tout le monde l’exécute.',
      'S’il ne commence pas par « Jacques a dit », n’obéis surtout pas : ceux qui le font se sont piégés.',
      'Le maître appuie sur « C’est fait » pour passer à l’ordre suivant.',
    ],
    tips: [
      'Beaucoup d’ordres sont du type « lève la main si… » : lever la main sans « Jacques a dit » revient à avouer devant tout le monde, d’où le piège.',
    ],
  },
};

export const GAME_ORDER: GameGuideId[] = ['tacle-1', 'tacle-0', 'ding', 'defi', 'aov', 'cap', 'jacques'];
