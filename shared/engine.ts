/**
 * Moteur du jeu. Il ne connaît ni le réseau ni l'écran : il reçoit des actions,
 * modifie l'état d'un salon, et fabrique pour chaque joueur la vue qu'il a le
 * droit de voir. Le même code tourne dans le navigateur (un seul téléphone) et
 * sur le serveur (salons en ligne).
 *
 * Règles de sécurité tenues ici, jamais côté interface :
 *  - l'auteur d'un message n'apparaît dans aucune vue ;
 *  - un mineur ne reçoit jamais le texte d'une carte adulte ;
 *  - un mineur ne reçoit jamais de question adulte et ne peut pas être visé
 *    par un message adulte.
 */
import {
  ADULT_WORDS,
  AOV_ACTION_ALL as AOV_ACTION,
  AOV_VERITE_ALL as AOV_VERITE,
  CAP_ALL as CAP,
  DEFIS_ALL as DEFIS,
  DING_ALL as DING,
  JACQUES,
  POLLS,
} from './cards';
import { groupOnly, speak } from './speak';
import {
  MAX_PLAYERS,
  MIN_AGE,
  PREFIXES,
  type Action,
  type AnswerView,
  type Card,
  type CardRules,
  type Composition,
  type DefiCard,
  type GameKind,
  type Level,
  type Mode,
  type Player,
  type PlayerInit,
  type Rank,
  type RankView,
  type RevealItem,
  type RevealItemView,
  type RevealView,
  type Room,
  type Round,
  type Settings,
  type View,
} from './types';

/* ---------- horloge et hasard (remplaçables dans les tests) ---------- */

let clock: () => number = () => Date.now();
export function setClock(fn: () => number): void {
  clock = fn;
}
export function now(): number {
  return clock();
}

let rand: () => number = Math.random;
export function setRandom(fn: () => number): void {
  rand = fn;
}

function pickIndex(n: number): number {
  return Math.floor(rand() * n);
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeId(len = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ---------- règles d'âge ---------- */

export const isMinor = (p: { age: number }): boolean => p.age < 18;

export function isDuo(room: Room): boolean {
  const adults = room.players.filter((p) => !isMinor(p)).length;
  return room.players.length === 2 && adults === 1;
}

/** Mode adulte si au moins 60 % des joueurs sont majeurs. Duo majeur + mineur : choix du maître. */
export function computeMode(room: Room): Mode {
  const n = room.players.length;
  if (isDuo(room)) return room.settings.duoMode;
  const adults = room.players.filter((p) => !isMinor(p)).length;
  return n > 0 && adults * 10 >= n * 6 ? 'adult' : 'ado';
}

/* ---------- création du salon et des joueurs ---------- */

export const DEFAULT_SETTINGS: Settings = {
  level: 1,
  answerSeconds: 180,
  duoMode: 'ado',
  together: false,
  deferred: false,
  composition: 'mixed',
  aovVoice: false,
};

export function validateInit(init: PlayerInit): string | null {
  const name = (init.name ?? '').trim();
  if (!name) return 'Écris un prénom.';
  if (name.length > 24) return 'Prénom trop long (24 caractères au maximum).';
  if (init.sex !== 'M' && init.sex !== 'F') return 'Indique si tu es un garçon ou une fille.';
  if (!Number.isInteger(init.age)) return 'Indique ton âge.';
  if (init.age < MIN_AGE) return `Âge minimum : ${MIN_AGE} ans.`;
  if (init.age > 99) return 'Âge invalide.';
  return null;
}

export function newRoom(code: string, host: PlayerInit, hostId = makeId()): Room {
  const room: Room = {
    code,
    hostId,
    players: [],
    settings: { ...DEFAULT_SETTINGS },
    phase: 'lobby',
    mode: 'ado',
    game: null,
    round: null,
    betweenDeadline: null,
    endReason: '',
    used: {},
    debts: [],
    defiTurn: 0,
    created: clock(),
  };
  const res = addPlayer(room, host, hostId);
  if ('error' in res) throw new Error(res.error);
  return room;
}

export function addPlayer(
  room: Room,
  init: PlayerInit,
  id = makeId(),
): { player: Player } | { error: string } {
  const bad = validateInit(init);
  if (bad) return { error: bad };
  if (room.phase !== 'lobby') return { error: 'La partie a déjà commencé.' };
  if (room.players.length >= MAX_PLAYERS) return { error: `${MAX_PLAYERS} joueurs au maximum.` };
  const name = init.name.trim();
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: 'Ce prénom est déjà pris. Ajoute une initiale.' };
  }
  const player: Player = { id, name, sex: init.sex, age: init.age, connected: true };
  room.players.push(player);
  syncComposition(room);
  room.mode = computeMode(room);
  return { player };
}

export function removePlayer(room: Room, id: string): void {
  const i = room.players.findIndex((p) => p.id === id);
  if (i < 0) return;
  room.players.splice(i, 1);
  syncComposition(room);
  if (room.round) {
    room.round.done = room.round.done.filter((x) => x !== id);
    delete room.round.votes[id];
  }
  if (room.hostId === id && room.players.length) room.hostId = room.players[0].id;
  if (room.phase === 'lobby') {
    room.mode = computeMode(room);
    return;
  }
  if (room.phase !== 'ended' && room.players.length < 2) {
    endRoom(room, 'alone');
    return;
  }
  progress(room);
}

export function setConnected(room: Room, id: string, connected: boolean): void {
  const p = room.players.find((x) => x.id === id);
  if (!p) return;
  p.connected = connected;
  progress(room);
}

/** Donne le rôle de maître au premier joueur connecté qui n'est pas déjà maître. */
export function transferHost(room: Room): boolean {
  const next = room.players.find((p) => p.connected && p.id !== room.hostId);
  if (!next) return false;
  room.hostId = next.id;
  return true;
}

/* ---------- tirage des cartes (composition, nombre de joueurs, attirance) ---------- */

/** Composition déduite du sexe des joueurs : plus aucun réglage à la main. */
export function deriveComposition(players: { sex: 'M' | 'F' }[]): Composition {
  const m = players.filter((p) => p.sex === 'M').length;
  if (m === players.length) return 'guys';
  if (m === 0) return 'girls';
  return 'mixed';
}

function syncComposition(room: Room): void {
  room.settings.composition = deriveComposition(room.players);
}

function matchesComp<T extends { comp?: Composition[] }>(c: T, composition: Composition): boolean {
  if (!c.comp || c.comp.length === 0) return true;
  return c.comp.includes(composition);
}

/**
 * Une carte peut-elle être tirée pour ce joueur, avec ces joueurs-là ?
 * - nombre minimum de joueurs, carte « à deux » ou « jamais à deux » ;
 * - vocabulaire de groupe (« les autres », « ici »…) interdit à deux ;
 * - carte d'attirance : au moins 3 joueurs et 2 joueurs du sexe opposé au sien
 *   dans le reste du groupe (à deux : l'autre doit être du sexe opposé).
 */
export function eligible(room: Room, c: CardRules & { q?: string; t?: string }, who?: Player): boolean {
  const n = room.players.length;
  const duo = n === 2;
  if (c.min && n < c.min) return false;
  if (c.duo === 'only' && !duo) return false;
  if (c.duo === 'never' && duo) return false;
  if (duo && groupOnly(c.q ?? c.t ?? '')) return false;
  if (c.to && who && who.sex !== c.to) return false;
  if (c.attract && who) {
    const opposite = room.players.filter((p) => p.id !== who.id && p.sex !== who.sex).length;
    if (opposite < (duo ? 1 : 2)) return false;
  }
  return true;
}

/** Texte d'une carte adapté à ceux qui jouent (duo, sexe, prénom). */
function dress<T extends { q?: string; t?: string }>(room: Room, card: T, who?: Player): T {
  const me = who ?? room.players[0];
  const others = room.players.filter((p) => p.id !== me.id);
  const target = others.length ? others[pickIndex(others.length)].name : undefined;
  const ctx = { who: me, others, target };
  const out = { ...card };
  if (typeof out.q === 'string') out.q = speak(out.q, ctx);
  if (typeof out.t === 'string') out.t = speak(out.t, ctx);
  return out;
}

/** Part des tirages qui redescendent d'un niveau (Moyen -> Débutant, Extrême -> Moyen). */
const BELOW_SHARE = 0.3;

function pickFrom<T extends { lv: Level; comp?: Composition[] } & CardRules>(
  room: Room,
  key: string,
  pool: T[],
  text: (c: T) => string,
  fallback: T[],
  who?: Player,
): T {
  const level = room.settings.level;
  const composition = deriveComposition(room.players);
  const ok = (c: T): boolean => eligible(room, c as CardRules & { q?: string; t?: string }, who);
  let candidates = pool.filter(ok);
  if (!candidates.length) {
    // Plus de carte au niveau choisi : on prend ce qui existe, sans jamais dépasser le niveau si possible.
    const fb = fallback.filter(ok);
    const within = fb.filter((c) => c.lv <= level);
    candidates = within.length ? within : fb.length ? fb : fallback;
  }
  // Tirage pondéré : le niveau choisi domine (70 %), le niveau juste en dessous aère (30 %).
  // Débutant = que du Débutant ; Extrême ne redescend jamais jusqu'au Débutant.
  const exact = candidates.filter((c) => c.lv === level);
  const below = level > 0 ? candidates.filter((c) => c.lv === level - 1) : [];
  const useBelow = below.length > 0 && (!exact.length || rand() < BELOW_SHARE);
  const near = useBelow ? below : exact;
  let usable = near.length ? near : candidates;
  // Préférer les cartes qui matchent la composition, sans exclure les universelles
  const preferred = usable.filter((c) => matchesComp(c, composition));
  if (preferred.length) usable = preferred;
  const used = (room.used[key] ??= []);
  let fresh = usable.filter((c) => !used.includes(text(c)));
  if (!fresh.length) {
    room.used[key] = used.filter((u) => !usable.some((c) => text(c) === u));
    fresh = usable;
  }
  const card = fresh[pickIndex(fresh.length)];
  room.used[key].push(text(card));
  return card;
}

function pickCard(room: Room, key: string, deck: Card[], noAdult: boolean, who?: Player): Card {
  const allowAdult = room.mode === 'adult' && !noAdult;
  const pool = deck.filter((c) => c.lv <= room.settings.level && (!c.adult || allowAdult));
  return dress(room, pickFrom(room, key, pool, (c) => c.q, deck.filter((c) => !c.adult), who), who);
}

function pickDefiFrom(
  room: Room,
  who: Player,
  deck: DefiCard[],
  key: string,
  forcePhysical = false,
): DefiCard {
  const { level, together, deferred } = room.settings;
  const allowAdult = room.mode === 'adult' && !isMinor(who);
  let kinds: string[] = together ? ['now', 'physical'] : ['now'];
  if (deferred) kinds.push('later');
  if (forcePhysical) kinds = ['physical'];
  const pool = deck.filter(
    (c) => c.lv <= level && kinds.includes(c.kind) && (!c.adult || allowAdult),
  );
  const card = pickFrom(
    room,
    key,
    pool,
    (c) => c.t,
    deck.filter((c) => (forcePhysical ? c.kind === 'physical' : c.kind === 'now') && !c.adult),
    who,
  );
  return dress(room, card, who);
}

function pickDefi(room: Room, who: Player): DefiCard {
  return pickDefiFrom(room, who, DEFIS, 'defi');
}

/* ---------- déroulement d'un tour ---------- */

function emptyRound(game: GameKind): Round {
  return { game, done: [], messages: [], questions: {}, votes: {}, deadline: null };
}

function nextSoloPlayer(room: Room): Player {
  const who = room.players[room.defiTurn % room.players.length];
  room.defiTurn++;
  return who;
}

/** Part des manches de Dingueries qui sont un sondage (quand une carte de sondage est possible). */
const POLL_SHARE = 0.35;

/** Une carte de sondage est possible : au moins 3 joueurs, 2 cartes à choisir, 2 votants. */
function pollOk(room: Room, c: Card): boolean {
  const rule = c.poll;
  if (!rule || room.players.length < 3) return false;
  const cands = room.players.filter((p) => rule.cands === 'all' || p.sex === rule.cands);
  const voters = room.players.filter((p) => rule.voters === 'all' || p.sex === rule.voters);
  return cands.length >= 2 && voters.length >= 2;
}

function pickPoll(room: Room): Card | null {
  if (room.players.length < 3 || rand() >= POLL_SHARE) return null;
  // Tout le monde reçoit le sondage : pas de carte adulte dès qu'un mineur est dans le salon.
  const allowAdult = room.mode === 'adult' && !room.players.some(isMinor);
  const level = room.settings.level;
  const pool = POLLS.filter((c) => c.lv <= level && (!c.adult || allowAdult) && pollOk(room, c));
  if (!pool.length) return null;
  const fallback = POLLS.filter((c) => !c.adult && pollOk(room, c));
  // Le niveau fait partie de la clé : une même question peut exister en Débutant et en Extrême.
  return pickFrom(room, 'poll', pool, (c) => `${c.lv}|${c.q}`, fallback);
}

export function startRound(room: Room, kind: GameKind, variant?: number): void {
  room.mode = computeMode(room);
  room.game = kind;
  room.betweenDeadline = null;
  const r = emptyRound(kind);
  if (kind === 'tacle') r.prefix = variant === 1 ? 1 : variant === 0 ? 0 : (room.round?.prefix ?? 0);
  room.round = r;
  syncComposition(room);

  if (kind === 'ding') {
    const poll = pickPoll(room);
    if (poll) {
      const rule = poll.poll!;
      r.poll = {
        card: poll,
        voters: room.players.filter((p) => rule.voters === 'all' || p.sex === rule.voters).map((p) => p.id),
        cands: room.players.filter((p) => rule.cands === 'all' || p.sex === rule.cands).map((p) => p.id),
      };
    }
    // Sondage : les votants reçoivent tous la même question en même temps ; les autres, une question normale.
    for (const p of room.players) {
      if (r.poll?.voters.includes(p.id)) continue;
      r.questions[p.id] = pickCard(room, kind, DING, isMinor(p), p);
    }
    room.phase = 'answer';
    r.deadline = clock() + room.settings.answerSeconds * 1000;
    return;
  }

  if (kind === 'tacle') {
    room.phase = 'answer';
    r.deadline = clock() + room.settings.answerSeconds * 1000;
    return;
  }

  if (kind === 'jacques') {
    // Jeu collectif : un ordre pour tous. « Jacques a dit » est ajouté ou non par le moteur,
    // sans jamais l'écrire dans la carte : c'est le piège du jeu.
    const host = room.players.find((p) => p.id === room.hostId) ?? room.players[0];
    const allowAdult = room.mode === 'adult';
    const pool = JACQUES.filter((c) => c.lv <= room.settings.level && (!c.adult || allowAdult));
    const picked = pickFrom(room, 'jacques', pool, (c) => c.t, JACQUES.filter((c) => !c.adult), host);
    const said = rand() < 0.6;
    const order = picked.t.charAt(0).toUpperCase() + picked.t.slice(1);
    const text = said ? `Jacques a dit : ${picked.t}.` : `${order}.`;
    r.solo = { playerId: host.id, card: { ...picked, t: text } };
    r.reveal = {
      items: [{ kind: 'jacques', who: 'Tous', text, adult: !!picked.adult }],
      ranks: [],
      index: 0,
      shown: 0,
      gateOk: false,
      voters: room.players.length,
    };
    room.phase = 'reveal';
    return;
  }

  // Jeux solo (un joueur à la fois) : defi, aov, cap
  const who = nextSoloPlayer(room);

  if (kind === 'aov') {
    r.aov = { playerId: who.id };
    room.phase = 'answer';
    r.deadline = clock() + room.settings.answerSeconds * 1000;
    return;
  }

  if (kind === 'cap') {
    const card = pickDefiFrom(room, who, CAP, 'cap');
    r.solo = { playerId: who.id, card };
    r.reveal = {
      items: [
        {
          kind: 'cap',
          who: who.name,
          text: card.t,
          tag: card.kind,
          media: !!card.media,
          adult: !!card.adult,
        },
      ],
      ranks: [],
      index: 0,
      shown: 0,
      gateOk: false,
      voters: room.players.length,
    };
    room.phase = 'reveal';
    return;
  }

  // defi classique
  const card = pickDefi(room, who);
  r.defi = { playerId: who.id, card };
  r.reveal = {
    items: [
      {
        kind: 'defi',
        who: who.name,
        text: card.t,
        tag: card.kind,
        media: !!card.media,
        adult: !!card.adult,
      },
    ],
    ranks: [],
    index: 0,
    shown: 0,
    gateOk: false,
    voters: room.players.length,
  };
  room.phase = 'reveal';
}

function computeRanks(room: Room): Rank[] {
  const r = room.round!;
  const n = room.players.length;
  const limit = n <= 6 ? 3 : 5;
  const counts = new Map<string, number>();
  for (const target of Object.values(r.votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  const entries = room.players
    .map((p) => ({ name: p.name, v: counts.get(p.id) ?? 0 }))
    .filter((e) => e.v > 0)
    .sort((a, b) => b.v - a.v);
  if (!entries.length) return [];
  let cut = Math.min(limit, entries.length);
  while (cut < entries.length && entries[cut].v === entries[cut - 1].v) cut++;
  const top = entries.slice(0, cut);
  const ranks: Rank[] = [];
  for (const e of top) {
    const last = ranks[ranks.length - 1];
    if (last && last.votes === e.v) last.names.push(e.name);
    else ranks.push({ pos: 1 + entries.filter((x) => x.v > e.v).length, names: [e.name], votes: e.v });
  }
  return ranks;
}

function nameOf(room: Room, id?: string): string {
  return room.players.find((p) => p.id === id)?.name ?? 'Un joueur parti';
}

function beginReveal(room: Room): void {
  const r = room.round!;
  let items: RevealItem[] = [];
  let ranks: Rank[] = [];
  if (r.game === 'tacle') {
    items = shuffle(
      r.messages.map<RevealItem>((m) => ({
        kind: 'tacle',
        target: nameOf(room, m.targetId),
        prefix: m.prefix ?? PREFIXES[0],
        text: m.text,
        adult: m.adult,
      })),
    );
  } else if (r.game === 'ding') {
    items = shuffle(
      r.messages.map<RevealItem>((m) => ({ kind: 'ding', q: m.q ?? '', text: m.text, adult: m.adult })),
    );
    if (r.poll) {
      const pr = computeRanks(room);
      // Le classement du sondage passe en premier, dévoilé du dernier vers le premier.
      if (pr.length) {
        items.unshift({ kind: 'poll', q: r.poll.card.q, ranks: pr, voters: r.poll.voters.length, adult: !!r.poll.card.adult });
      }
    }
  }
  r.reveal = { items, ranks, index: 0, shown: 0, gateOk: false, voters: room.players.length };
  r.deadline = null;
  const empty = items.length === 0;
  if (empty) {
    afterRound(room);
    return;
  }
  room.phase = 'reveal';
}

function afterRound(room: Room): void {
  const r = room.round;
  if (r && r.game === 'tacle' && r.messages.length === 0) {
    // Plus personne n'a ciblé personne : on prévient, le maître relance ou termine.
    room.phase = 'between';
    room.betweenDeadline = null;
    return;
  }
  room.phase = 'between';
  room.betweenDeadline = clock() + 5000;
}

export function endRoom(room: Room, reason: Room['endReason']): void {
  room.phase = 'ended';
  room.endReason = reason;
  room.betweenDeadline = null;
  if (room.round) room.round.deadline = null;
}

/** À appeler après tout changement : passe au dépouillement quand tous les joueurs connectés ont fini. */
export function progress(room: Room): void {
  if (room.phase !== 'answer' || !room.round) return;
  const r = room.round;
  // AoV : on attend uniquement le joueur ciblé
  if (r.game === 'aov' && r.aov) {
    // Solo : on n’avance que via aov:choose / aov:answer
    return;
  }
  const waiting = room.players.filter((p) => p.connected && !r.done.includes(p.id));
  if (waiting.length === 0) beginReveal(room);
}

/** Le chrono est écoulé : on passe au dépouillement avec ce qui a été envoyé. */
export function forceEndAnswer(room: Room): void {
  if (room.phase !== 'answer' || !room.round) return;
  const r = room.round;
  if (r.game === 'aov' && r.aov) {
    if (!r.aov.choice) {
      afterRound(room);
      return;
    }
    if (r.aov.choice === 'verite' && r.aov.answer === undefined) {
      // Temps écoulé sans réponse : on affiche quand même la question
      const who = room.players.find((p) => p.id === r.aov!.playerId);
      const card = r.aov.card as { q?: string; adult?: boolean } | undefined;
      r.aov.answer = '(Pas de réponse)';
      r.reveal = {
        items: [
          {
            kind: 'aov',
            who: who?.name ?? '?',
            choice: 'verite',
            text: card?.q ?? '',
            answer: '(Pas de réponse)',
            media: false,
            adult: !!card?.adult,
          },
        ],
        ranks: [],
        index: 0,
        shown: 0,
        gateOk: false,
        voters: room.players.length,
      };
      r.deadline = null;
      room.phase = 'reveal';
      return;
    }
  }
  beginReveal(room);
}

/** Les 5 secondes entre deux tours sont écoulées : on relance le même jeu. */
export function autoAgain(room: Room): void {
  if (room.phase === 'between' && room.game) startRound(room, room.game);
}

/* ---------- actions des joueurs ---------- */

function clampSettings(room: Room, patch: Partial<Settings>): void {
  const s = room.settings;
  if (patch.level !== undefined && [0, 1, 2].includes(patch.level)) s.level = patch.level;
  if (patch.answerSeconds !== undefined) {
    const v = Math.round(Number(patch.answerSeconds));
    if (Number.isFinite(v)) s.answerSeconds = Math.min(600, Math.max(30, v));
  }
  if (patch.duoMode === 'adult' || patch.duoMode === 'ado') s.duoMode = patch.duoMode;
  if (typeof patch.together === 'boolean') s.together = patch.together;
  if (typeof patch.deferred === 'boolean') s.deferred = patch.deferred;
  if (typeof patch.aovVoice === 'boolean') s.aovVoice = patch.aovVoice;
  // Dans la même pièce, rien à reporter à « quand on se reverra » : pas de défis « bon pour plus tard »
  if (s.together) s.deferred = false;
  syncComposition(room);
  room.mode = computeMode(room);
}

const ALL_GAMES: GameKind[] = ['tacle', 'ding', 'defi', 'aov', 'cap', 'jacques'];

/** Retourne un message d'erreur, ou null si l'action a réussi. */
export function act(room: Room, playerId: string, action: Action): string | null {
  const me = room.players.find((p) => p.id === playerId);
  if (!me) return 'Joueur inconnu.';
  const isHost = room.hostId === playerId;
  const r = room.round;

  switch (action.type) {
    case 'settings': {
      if (!isHost) return 'Seul le maître de la partie peut changer les réglages.';
      if (!['lobby', 'menu', 'between'].includes(room.phase)) return 'Réglages bloqués pendant un tour.';
      clampSettings(room, action.patch);
      return null;
    }
    case 'open-menu': {
      if (!isHost) return 'Seul le maître de la partie peut continuer.';
      if (room.phase !== 'lobby') return 'Action impossible maintenant.';
      if (room.players.length < 2) return 'Il faut au moins deux joueurs.';
      room.mode = computeMode(room);
      room.phase = 'menu';
      return null;
    }
    case 'choose': {
      if (!isHost) return 'Seul le maître de la partie choisit le jeu.';
      if (room.phase !== 'menu') return 'Action impossible maintenant.';
      if (!ALL_GAMES.includes(action.game)) return 'Jeu inconnu.';
      if (action.game === 'jacques' && room.players.length < 3) {
        return 'Jacques a dit demande au moins trois joueurs.';
      }
      if (action.game === 'jacques' && !room.settings.together) {
        return 'Jacques a dit nécessite d’être dans la même pièce. Active l’option « même pièce ».';
      }
      startRound(room, action.game, action.variant);
      return null;
    }
    case 'tacle:send': {
      if (room.phase !== 'answer' || !r || r.game !== 'tacle') return 'Action impossible maintenant.';
      if (r.done.includes(playerId)) return 'Tu as déjà terminé ce tour.';
      const target = room.players.find((p) => p.id === action.targetId);
      if (!target || target.id === playerId) return 'Carte invalide.';
      const text = (action.text ?? '').trim();
      if (text.length < 2) return 'Écris un message avant d’envoyer.';
      if (text.length > 400) return 'Message trop long (400 caractères au maximum).';
      if (r.messages.some((m) => m.authorId === playerId && m.targetId === target.id)) {
        return 'Tu as déjà joué la carte de ' + target.name + '.';
      }
      const prefix = PREFIXES[r.prefix ?? 0] ?? PREFIXES[0];
      const adult = !!action.adult || ADULT_WORDS.test(text);
      if (adult && room.mode !== 'adult') {
        return 'Ce message est réservé aux adultes et la partie est en mode Ado. Reformule-le.';
      }
      if (adult && isMinor(me)) return 'Les mineurs ne peuvent pas envoyer de contenu adulte.';
      if (adult && isMinor(target)) {
        return 'Ce message ne peut pas être envoyé à cette personne. Reformule-le sans contenu adulte.';
      }
      r.messages.push({ authorId: playerId, targetId: target.id, prefix, text, adult });
      return null;
    }
    case 'ding:answer': {
      if (room.phase !== 'answer' || !r || r.game !== 'ding') {
        return 'Action impossible maintenant.';
      }
      if (r.done.includes(playerId)) return 'Tu as déjà répondu.';
      const text = (action.text ?? '').trim();
      if (text.length < 2) return 'Écris ta réponse avant de valider.';
      if (text.length > 500) return 'Réponse trop longue (500 caractères au maximum).';
      const q = r.questions[playerId];
      if (!q) return 'Ce tour est un sondage pour toi : choisis une carte.';
      r.messages.push({ authorId: playerId, q: q.q, text, adult: !!q.adult });
      r.done.push(playerId);
      progress(room);
      return null;
    }
    case 'vote:cast': {
      if (room.phase !== 'answer' || !r || r.game !== 'ding' || !r.poll) return 'Action impossible maintenant.';
      if (!r.poll.voters.includes(playerId)) return 'Tu ne votes pas pour ce sondage.';
      if (r.done.includes(playerId)) return 'Tu as déjà voté.';
      const target = room.players.find((p) => p.id === action.targetId);
      if (!target || !r.poll.cands.includes(target.id)) return 'Carte invalide.';
      if (target.id === playerId) return 'On ne peut pas voter pour soi-même.';
      r.votes[playerId] = target.id;
      r.done.push(playerId);
      progress(room);
      return null;
    }
    case 'done': {
      if (room.phase !== 'answer' || !r) return 'Action impossible maintenant.';
      if (!r.done.includes(playerId)) r.done.push(playerId);
      progress(room);
      return null;
    }
    case 'aov:choose': {
      if (room.phase !== 'answer' || !r || r.game !== 'aov' || !r.aov) return 'Action impossible maintenant.';
      if (r.aov.playerId !== playerId) return 'Ce n’est pas ton tour.';
      if (r.aov.choice) return 'Tu as déjà choisi.';
      if (action.choice !== 'action' && action.choice !== 'verite') return 'Choix invalide.';
      const who = room.players.find((p) => p.id === playerId)!;
      r.aov.choice = action.choice;
      if (action.choice === 'verite') {
        // Vérité : la personne répond d’abord ; tout le monde verra question + réponse ensuite.
        const card = pickCard(room, 'aov-v', AOV_VERITE, isMinor(who), who);
        r.aov.card = card;
        if (room.settings.aovVoice && room.settings.together) {
          // Vérité à voix haute : rien n'est écrit, la carte est lue devant tout le monde.
          r.reveal = {
            items: [
              {
                kind: 'aov',
                who: who.name,
                choice: 'verite',
                text: card.q,
                media: false,
                adult: !!card.adult,
              },
            ],
            ranks: [],
            index: 0,
            shown: 0,
            gateOk: false,
            voters: room.players.length,
          };
          r.deadline = null;
          room.phase = 'reveal';
          return null;
        }
        r.deadline = clock() + room.settings.answerSeconds * 1000;
        // reste en phase answer
        return null;
      }
      // Action : la carte est montrée à tout le monde tout de suite (responsabilité partagée).
      const card = pickDefiFrom(room, who, AOV_ACTION, 'aov-a');
      r.aov.card = card;
      r.reveal = {
        items: [
          {
            kind: 'aov',
            who: who.name,
            choice: 'action',
            text: card.t,
            tag: card.kind,
            media: !!card.media,
            adult: !!card.adult,
          },
        ],
        ranks: [],
        index: 0,
        shown: 0,
        gateOk: false,
        voters: room.players.length,
      };
      r.deadline = null;
      room.phase = 'reveal';
      return null;
    }
    case 'aov:answer': {
      if (room.phase !== 'answer' || !r || r.game !== 'aov' || !r.aov) return 'Action impossible maintenant.';
      if (r.aov.playerId !== playerId) return 'Ce n’est pas ton tour.';
      if (r.aov.choice !== 'verite' || !r.aov.card) return 'Tu dois d’abord choisir Vérité.';
      if (r.aov.answer !== undefined) return 'Tu as déjà répondu.';
      const text = (action.text ?? '').trim();
      if (text.length < 1) return 'Écris ta réponse.';
      if (text.length > 500) return 'Réponse trop longue (500 caractères au maximum).';
      const who = room.players.find((p) => p.id === playerId)!;
      const card = r.aov.card as { q?: string; adult?: boolean };
      r.aov.answer = text;
      r.reveal = {
        items: [
          {
            kind: 'aov',
            who: who.name,
            choice: 'verite',
            text: card.q ?? '',
            answer: text,
            media: false,
            adult: !!card.adult,
          },
        ],
        ranks: [],
        index: 0,
        shown: 0,
        gateOk: false,
        voters: room.players.length,
      };
      r.deadline = null;
      room.phase = 'reveal';
      return null;
    }
    case 'cap:result': {
      if (room.phase !== 'reveal' || !r?.solo || r.game !== 'cap') return 'Action impossible maintenant.';
      if (!isHost && playerId !== r.solo.playerId) return 'Seul le joueur concerné ou l’hôte peut valider.';
      const accepted = action.result === 'cap';
      r.solo.accepted = accepted;
      if (r.reveal?.items[0] && r.reveal.items[0].kind === 'cap') {
        r.reveal.items[0].accepted = accepted;
      }
      if (!accepted) {
        afterRound(room);
        return null;
      }
      // Cap accepté : on laisse le host valider "fait" via defi:result ou reveal:next
      return null;
    }
    case 'jacques:done': {
      if (room.phase !== 'reveal' || r?.game !== 'jacques') return 'Action impossible maintenant.';
      if (!isHost && playerId !== r?.solo?.playerId) return 'Seul le joueur concerné ou l’hôte peut valider.';
      afterRound(room);
      return null;
    }
    case 'reveal:gate': {
      if (!isHost) return 'Seul le maître de la partie peut confirmer.';
      if (room.phase !== 'reveal' || !r?.reveal) return 'Action impossible maintenant.';
      r.reveal.gateOk = true;
      return null;
    }
    case 'reveal:next': {
      if (!isHost) return 'Seul le maître de la partie fait défiler les cartes.';
      if (room.phase !== 'reveal' || !r?.reveal) return 'Action impossible maintenant.';
      const rv = r.reveal;
      if (r.game === 'defi' || r.game === 'aov' || r.game === 'cap' || r.game === 'jacques') {
        afterRound(room);
      } else {
        const cur = rv.items[rv.index];
        // Sondage : le classement se dévoile du dernier vers le premier, un cran à chaque fois.
        if (cur && cur.kind === 'poll' && rv.shown < cur.ranks.length && (!cur.adult || rv.gateOk || !room.players.some(isMinor))) {
          rv.shown++;
          return null;
        }
        rv.index++;
        rv.shown = 0;
        rv.gateOk = false;
        if (rv.index >= rv.items.length) afterRound(room);
      }
      return null;
    }
    case 'defi:result': {
      if (room.phase !== 'reveal' || !r) return 'Action impossible maintenant.';
      if (r.game === 'defi' && r.defi) {
        if (!isHost && playerId !== r.defi.playerId) return 'Seul le joueur concerné ou l’hôte peut valider.';
        if (action.result === 'later') {
          if (!room.settings.deferred) return 'Les défis pour plus tard sont désactivés.';
          room.debts.push({ who: nameOf(room, r.defi.playerId), text: r.defi.card.t });
        }
        afterRound(room);
        return null;
      }
      if (r.game === 'cap' && r.solo) {
        if (!isHost && playerId !== r.solo.playerId) return 'Seul le joueur concerné ou l’hôte peut valider.';
        if (action.result === 'later') {
          if (!room.settings.deferred) return 'Les défis pour plus tard sont désactivés.';
          room.debts.push({ who: nameOf(room, r.solo.playerId), text: r.solo.card.t });
        }
        afterRound(room);
        return null;
      }
      if (r.game === 'aov' && r.aov) {
        if (!isHost && playerId !== r.aov.playerId) return 'Seul le joueur concerné ou l’hôte peut valider.';
        if (action.result === 'later') {
          if (!room.settings.deferred) return 'Les défis pour plus tard sont désactivés.';
          const card = r.aov.card as { t?: string } | undefined;
          if (r.aov.choice === 'action' && card?.t) {
            room.debts.push({ who: nameOf(room, r.aov.playerId), text: card.t });
          }
        }
        afterRound(room);
        return null;
      }
      return 'Action impossible maintenant.';
    }
    case 'again': {
      if (!isHost) return 'Seul le maître de la partie lance un nouveau tour.';
      if (room.phase !== 'between' || !room.game) return 'Action impossible maintenant.';
      startRound(room, room.game, room.round?.prefix);
      return null;
    }
    case 'menu': {
      if (!isHost) return 'Seul le maître de la partie change de jeu.';
      if (room.phase !== 'between') return 'Action impossible maintenant.';
      room.mode = computeMode(room);
      room.phase = 'menu';
      return null;
    }
    case 'end': {
      if (!isHost) return 'Seul le maître de la partie peut terminer la partie.';
      if (room.phase === 'ended') return null;
      endRoom(room, 'host');
      return null;
    }
    case 'kick': {
      if (!isHost) return 'Seul le maître de la partie peut retirer un joueur.';
      if (room.phase !== 'lobby') return 'On ne retire un joueur que dans le salon d’attente.';
      if (action.playerId === playerId) return 'Tu ne peux pas te retirer toi-même.';
      removePlayer(room, action.playerId);
      return null;
    }
    default:
      return 'Action inconnue.';
  }
}

/* ---------- ce que voit chaque joueur ---------- */

function answerView(room: Room, me: Player): AnswerView {
  const r = room.round!;
  const base: AnswerView = {
    game: r.game,
    done: r.done.includes(me.id),
    doneCount: r.done.length,
    total: room.players.length,
  };
  if (r.game === 'tacle') {
    base.targets = room.players
      .filter((p) => p.id !== me.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sent: r.messages.some((m) => m.authorId === me.id && m.targetId === p.id),
      }));
    base.canAdult = room.mode === 'adult' && !isMinor(me);
    base.prefix = PREFIXES[r.prefix ?? 0];
  } else if (r.game === 'ding') {
    if (r.poll && r.poll.voters.includes(me.id)) {
      base.question = r.poll.card.q;
      base.pollVote = true;
      base.targets = room.players
        .filter((p) => r.poll!.cands.includes(p.id) && p.id !== me.id)
        .map((p) => ({ id: p.id, name: p.name, sent: false }));
    } else {
      base.question = r.questions[me.id]?.q ?? '';
    }
  } else if (r.game === 'aov' && r.aov) {
    const who = room.players.find((p) => p.id === r.aov!.playerId);
    base.soloWho = who?.name;
    base.soloMe = r.aov.playerId === me.id;
    base.aovChoice = r.aov.playerId === me.id && !r.aov.choice;
    const needsAnswer = r.aov.choice === 'verite' && r.aov.card && r.aov.answer === undefined;
    base.aovAnswer = r.aov.playerId === me.id && !!needsAnswer;
    if (needsAnswer) {
      const card = r.aov.card as { q?: string };
      base.question = card.q ?? '';
    }
    base.total = 1;
    base.doneCount = r.aov.answer !== undefined || (r.aov.choice === 'action' && !!r.aov.card) ? 1 : 0;
    base.done = false;
  }
  return base;
}

function revealView(room: Room, me: Player, shared: boolean): RevealView {
  const r = room.round!;
  const rv = r.reveal!;
  const isHost = room.hostId === me.id;
  const view: RevealView = {
    game: r.game,
    isHost,
    index: rv.index,
    total: rv.items.length,
  };
  const it = rv.items[rv.index];
  if (!it) return view;
  view.canLater = room.settings.deferred;
  const meMinor = isMinor(me);
  const minorsPresent = room.players.some(isMinor);
  if (it.adult && meMinor) {
    view.item = { kind: 'masked' };
    return view;
  }
  if (it.adult && shared && minorsPresent && !rv.gateOk) {
    view.gate = { minors: room.players.filter(isMinor).map((p) => p.name) };
    return view;
  }
  let item: RevealItemView;
  if (it.kind === 'tacle') item = { kind: 'tacle', target: it.target, prefix: it.prefix, text: it.text };
  else if (it.kind === 'ding') item = { kind: 'ding', q: it.q, text: it.text };
  else if (it.kind === 'poll') {
    const total = it.ranks.length;
    item = {
      kind: 'poll',
      q: it.q,
      voters: it.voters,
      ranks: it.ranks.map<RankView>((rk, idx) => {
        const shown = idx >= total - rv.shown;
        return { pos: rk.pos, names: shown ? rk.names : [], votes: shown ? rk.votes : 0, shown };
      }),
    };
  }
  else if (it.kind === 'defi') item = { kind: 'defi', who: it.who, text: it.text, tag: it.tag, media: it.media };
  else if (it.kind === 'aov')
    item = {
      kind: 'aov',
      who: it.who,
      choice: it.choice,
      text: it.text,
      answer: it.answer,
      tag: it.tag,
      media: it.media,
    };
  else if (it.kind === 'cap')
    item = {
      kind: 'cap',
      who: it.who,
      text: it.text,
      tag: it.tag,
      media: it.media,
      accepted: it.accepted,
    };
  else item = { kind: 'jacques', who: it.who, text: it.text };
  view.item = item;
  // Le joueur ciblé ou l’hôte peut valider un défi / action / jacques / aov
  if (r.game === 'defi' && r.defi) {
    view.canResolve = isHost || me.id === r.defi.playerId;
  } else if (r.game === 'aov' && r.aov) {
    view.canResolve = isHost || me.id === r.aov.playerId;
  } else if ((r.game === 'cap' || r.game === 'jacques') && r.solo) {
    view.canResolve = isHost || me.id === r.solo.playerId;
  } else {
    view.canResolve = isHost;
  }
  return view;
}

export function viewFor(room: Room, playerId: string, opts: { shared?: boolean } = {}): View {
  const me = room.players.find((p) => p.id === playerId);
  if (!me) throw new Error('Joueur inconnu');
  const shared = !!opts.shared;
  const isHost = room.hostId === playerId;
  const showMinors = isHost || shared;
  const view: View = {
    serverNow: clock(),
    code: room.code,
    phase: room.phase,
    settings: room.settings,
    mode: room.phase === 'lobby' ? computeMode(room) : room.mode,
    game: room.game,
    me: { id: me.id, name: me.name, isHost, isMinor: isMinor(me) },
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      isHost: p.id === room.hostId,
      ...(showMinors ? { minor: isMinor(p) } : {}),
    })),
    duo: isDuo(room),
    dry: room.phase === 'between' && room.round?.game === 'tacle' && room.round.messages.length === 0,
    hasMinors: room.players.some(isMinor),
    debts: room.debts,
    deadline: null,
    endReason: room.endReason,
  };
  if (showMinors) view.minorNames = room.players.filter(isMinor).map((p) => p.name);
  if (room.phase === 'answer' && room.round) {
    view.answer = answerView(room, me);
    view.deadline = room.round.deadline;
  }
  if (room.phase === 'reveal' && room.round?.reveal) view.reveal = revealView(room, me, shared);
  if (room.phase === 'between') view.deadline = room.betweenDeadline;
  return view;
}
