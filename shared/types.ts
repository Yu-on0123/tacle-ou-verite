/**
 * Types partagés entre le serveur et l'interface web.
 * Rien ici ne contient de logique : seulement des formes de données.
 */

export type Sex = 'M' | 'F';
/** 0 = Débutant, 1 = Moyen, 2 = Extrême. */
export type Level = 0 | 1 | 2;
/** Jeux disponibles. aov = Action ou Vérité, cap = Cap ou Pas Cap, jacques = Jacques a dit. */
export type GameKind = 'tacle' | 'ding' | 'defi' | 'aov' | 'cap' | 'jacques';
export type Phase = 'lobby' | 'menu' | 'answer' | 'reveal' | 'between' | 'ended';
export type Mode = 'adult' | 'ado';
export type DefiTag = 'now' | 'physical' | 'later';
/** Composition du groupe : adapte le ton et le tirage des cartes. */
export type Composition = 'mixed' | 'guys' | 'girls';

export const LEVEL_NAMES = ['Débutant', 'Moyen', 'Extrême'] as const;
export const COMPOSITION_NAMES: Record<Composition, string> = {
  mixed: 'Mixte',
  guys: 'Entre mecs',
  girls: 'Entre filles',
};
export const PREFIXES = ['Moi au moins…', 'Je ne te l’ai jamais dit mais…'] as const;

export const MIN_AGE = 13;
export const MAX_PLAYERS = 12;

export interface PlayerInit {
  name: string;
  sex: Sex;
  age: number;
}

export interface Player extends PlayerInit {
  id: string;
  connected: boolean;
}

export interface Settings {
  level: Level;
  /** Durée maximale pour répondre, en secondes. */
  answerSeconds: number;
  /** Choix du maître quand la partie réunit un majeur et un mineur. */
  duoMode: Mode;
  /** Les joueurs sont dans la même pièce (actions physiques proposées). */
  together: boolean;
  /** Inclure les défis « bon pour plus tard » (petits groupes). */
  deferred: boolean;
  /** Calculée par le moteur d'après le sexe des joueurs (plus un réglage). */
  composition: Composition;
  /** Action ou Vérité : la vérité se répond à voix haute (même pièce) au lieu d'être écrite. */
  aovVoice: boolean;
}

/* ---------- Cartes ---------- */

/** Conditions de tirage communes à toutes les cartes. */
export interface CardRules {
  /** Nombre minimum de joueurs. */
  min?: number;
  /** 'only' : seulement à deux. 'never' : jamais à deux. */
  duo?: 'only' | 'never';
  /**
   * Carte d'attirance : tirée pour un joueur seulement s'il y a au moins 2 joueurs
   * du sexe opposé au sien dans le reste du groupe (1 seul s'ils sont deux).
   */
  attract?: boolean;
  /** Carte adressée seulement à un joueur de ce sexe (M = garçon, F = fille). */
  to?: Sex;
}

/** Sondage (Dingueries) : tous les votants reçoivent la question en même temps et choisissent une carte. */
export interface PollRule {
  /** Qui peut être choisi : seulement les garçons (M), les filles (F) ou tout le monde. */
  cands: Sex | 'all';
  /** Qui vote : seulement les garçons (M), les filles (F) ou tout le monde. Les autres répondent à une question normale. */
  voters: Sex | 'all';
}

export interface Card extends CardRules {
  q: string;
  poll?: PollRule;
  lv: Level;
  adult?: boolean;
  /** Si présent, la carte est surtout destinée à ces compositions (sinon elle convient à toutes). */
  comp?: Composition[];
}

export interface DefiCard extends CardRules {
  t: string;
  lv: Level;
  kind: DefiTag;
  adult?: boolean;
  /** Le défi demande d'envoyer une photo, un vocal ou une vidéo : on renvoie vers WhatsApp. */
  media?: boolean;
  /** Si présent, la carte est surtout destinée à ces compositions. */
  comp?: Composition[];
}

/* ---------- État interne d'un salon (jamais envoyé tel quel aux joueurs) ---------- */

export interface Msg {
  authorId: string;
  targetId?: string;
  prefix?: string;
  q?: string;
  text: string;
  adult: boolean;
}

export interface Rank {
  pos: number;
  names: string[];
  votes: number;
}

export type RevealItem =
  | { kind: 'tacle'; target: string; prefix: string; text: string; adult: boolean }
  | { kind: 'ding'; q: string; text: string; adult: boolean }
  | { kind: 'poll'; q: string; ranks: Rank[]; voters: number; adult: boolean }
  | { kind: 'defi'; who: string; text: string; tag: DefiTag; media: boolean; adult: boolean }
  | {
      kind: 'aov';
      who: string;
      choice: 'action' | 'verite';
      text: string;
      /** Réponse à une vérité (toujours visible par les autres). */
      answer?: string;
      tag?: DefiTag;
      media: boolean;
      adult: boolean;
    }
  | { kind: 'cap'; who: string; text: string; tag: DefiTag; media: boolean; adult: boolean; accepted?: boolean }
  | { kind: 'jacques'; who: string; text: string; adult: boolean };

export interface Round {
  game: GameKind;
  /** Tacles : index de la phrase à compléter (voir PREFIXES). */
  prefix?: number;
  done: string[];
  messages: Msg[];
  questions: Record<string, Card>;
  /** Dingueries : si la manche est un sondage. */
  poll?: { card: Card; voters: string[]; cands: string[] };
  votes: Record<string, string>;
  defi?: { playerId: string; card: DefiCard };
  /** Action ou Vérité : le joueur doit encore choisir, ou a déjà choisi. */
  aov?: {
    playerId: string;
    choice?: 'action' | 'verite';
    card?: Card | DefiCard;
    /** Réponse texte si vérité. */
    answer?: string;
  };
  /** Cap ou Pas Cap / Jacques a dit. */
  solo?: {
    playerId: string;
    card: DefiCard;
    accepted?: boolean;
  };
  deadline: number | null;
  reveal?: {
    items: RevealItem[];
    ranks: Rank[];
    index: number;
    shown: number;
    gateOk: boolean;
    /** Nombre de joueurs qui pouvaient voter (dénominateur du classement). */
    voters: number;
  };
}

export interface Debt {
  who: string;
  text: string;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  settings: Settings;
  phase: Phase;
  mode: Mode;
  game: GameKind | null;
  round: Round | null;
  betweenDeadline: number | null;
  endReason: '' | 'tari' | 'host' | 'alone';
  used: Record<string, string[]>;
  debts: Debt[];
  defiTurn: number;
  created: number;
}

/* ---------- Ce que chaque joueur reçoit (vues filtrées) ---------- */

export interface PlayerPublic {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Visible seulement par le maître de la partie. */
  minor?: boolean;
}

export interface AnswerView {
  game: GameKind;
  done: boolean;
  doneCount: number;
  total: number;
  /** Tacles et sondages : les cartes visibles. */
  targets?: { id: string; name: string; sent: boolean }[];
  /** Tacles : le début de phrase que le joueur complète. */
  prefix?: string;
  /** Dingueries : la question posée (ou la question du sondage). */
  question?: string;
  /** Dingueries : ce joueur vote pour un sondage (il choisit une carte). */
  pollVote?: boolean;
  /** Tacles : le joueur peut cocher « contenu adulte ». */
  canAdult?: boolean;
  /** Action ou Vérité : le joueur ciblé doit choisir. */
  aovChoice?: boolean;
  /** Action ou Vérité : le joueur doit répondre à sa vérité. */
  aovAnswer?: boolean;
  /** Nom du joueur ciblé (solo : aov / cap / jacques / defi). */
  soloWho?: string;
  /** true si c’est mon tour en mode solo. */
  soloMe?: boolean;
}

export type RevealItemView =
  | { kind: 'tacle'; target: string; prefix: string; text: string }
  | { kind: 'ding'; q: string; text: string }
  | { kind: 'poll'; q: string; voters: number; ranks: RankView[] }
  | { kind: 'defi'; who: string; text: string; tag: DefiTag; media: boolean }
  | {
      kind: 'aov';
      who: string;
      choice: 'action' | 'verite';
      text: string;
      answer?: string;
      tag?: DefiTag;
      media: boolean;
    }
  | { kind: 'cap'; who: string; text: string; tag: DefiTag; media: boolean; accepted?: boolean }
  | { kind: 'jacques'; who: string; text: string }
  | { kind: 'masked' };

export interface RankView {
  pos: number;
  names: string[];
  votes: number;
  shown: boolean;
}

export interface RevealView {
  game: GameKind;
  isHost: boolean;
  index: number;
  total: number;
  item?: RevealItemView;
  /** Écran partagé : carte adulte à confirmer par le maître, avec les mineurs présents. */
  gate?: { minors: string[] };
  canLater?: boolean;
  /** Le joueur ciblé (ou l’hôte) peut valider « c’est fait ». */
  canResolve?: boolean;
}

export interface View {
  serverNow: number;
  code: string;
  phase: Phase;
  settings: Settings;
  mode: Mode;
  game: GameKind | null;
  me: { id: string; name: string; isHost: boolean; isMinor: boolean };
  players: PlayerPublic[];
  /** Noms des mineurs : seulement pour le maître de la partie. */
  minorNames?: string[];
  /** true s’il y a au moins un mineur dans le salon (toujours envoyé). */
  hasMinors: boolean;
  duo: boolean;
  /** Tacles : personne n'a ciblé personne pendant le tour. */
  dry: boolean;
  debts: Debt[];
  answer?: AnswerView;
  reveal?: RevealView;
  deadline: number | null;
  endReason: Room['endReason'];
}

/* ---------- Actions envoyées par les joueurs ---------- */

export type Action =
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'open-menu' }
  | { type: 'choose'; game: GameKind; /** Tacles : 0 = « Moi au moins… », 1 = « Je ne te l’ai jamais dit mais… » */ variant?: 0 | 1 }
  | { type: 'tacle:send'; targetId: string; prefix: number; text: string; adult: boolean }
  | { type: 'ding:answer'; text: string }
  | { type: 'vote:cast'; targetId: string }
  | { type: 'done' }
  | { type: 'reveal:next' }
  | { type: 'reveal:gate' }
  | { type: 'defi:result'; result: 'done' | 'skip' | 'later' }
  | { type: 'aov:choose'; choice: 'action' | 'verite' }
  | { type: 'aov:answer'; text: string }
  | { type: 'cap:result'; result: 'cap' | 'pascap' }
  | { type: 'jacques:done' }
  | { type: 'again' }
  | { type: 'menu' }
  | { type: 'end' }
  | { type: 'kick'; playerId: string };

export interface Result {
  ok: boolean;
  error?: string;
}
