/**
 * Test de fumée : plusieurs vrais clients se connectent à un serveur en marche
 * (par défaut http://localhost:3001) et jouent des parties complètes.
 * Il vérifie surtout ce qui compte : anonymat, mineurs, sondage, reconnexion.
 *
 *   npm run build && npm start        (dans un terminal)
 *   npm run smoke                     (dans un autre)
 */
import { io, type Socket } from 'socket.io-client';
import type { Action, PlayerInit, Result, View } from '../shared/types';

const URL = process.env.SERVER_URL || 'http://localhost:3001';
let failures = 0;

function check(cond: unknown, label: string): void {
  if (cond) console.log('  ok   ' + label);
  else {
    failures++;
    console.log('  FAIL ' + label);
  }
}

interface Client {
  name: string;
  socket: Socket;
  view: View | null;
  closed: boolean;
  session?: { code: string; playerId: string; token: string };
}

function connect(name: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ['websocket'], reconnection: false });
    const c: Client = { name, socket, view: null, closed: false };
    socket.on('state', (v: View) => (c.view = v));
    socket.on('closed', () => (c.closed = true));
    socket.on('connect', () => resolve(c));
    socket.on('connect_error', reject);
  });
}

function call<T extends Result>(c: Client, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    c.socket.timeout(5000).emit(event, payload, (err: Error | null, res: T) =>
      resolve(err ? ({ ok: false, error: 'timeout' } as T) : res),
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(label: string, fn: () => boolean, ms = 4000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await sleep(25);
  }
  check(false, 'délai dépassé : ' + label);
}

async function act(c: Client, a: Action): Promise<Result> {
  return call<Result>(c, 'act', a);
}

async function makeRoom(inits: PlayerInit[]): Promise<Client[]> {
  const clients: Client[] = [];
  for (const init of inits) clients.push(await connect(init.name));
  const created = await call<Result & { code: string; playerId: string; token: string }>(clients[0], 'room:create', inits[0]);
  clients[0].session = created;
  for (let i = 1; i < inits.length; i++) {
    const r = await call<Result & { code: string; playerId: string; token: string }>(clients[i], 'room:join', {
      ...inits[i],
      code: created.code.toLowerCase(),
    });
    clients[i].session = r;
  }
  await until('tous dans le salon', () => clients.every((c) => c.view?.players.length === inits.length));
  return clients;
}

function closeAll(cs: Client[]): void {
  for (const c of cs) c.socket.disconnect();
}

async function main(): Promise<void> {
  const health = await fetch(URL + '/health').then((r) => r.json() as Promise<{ ok: boolean }>);
  check(health.ok, 'le serveur répond sur /health');

  /* ---------- Partie 1 : tacles, anonymat, mineur protégé ---------- */
  console.log('\nPartie 1 : tacles, anonymat et mineur protégé');
  const g1 = await makeRoom([
    { name: 'Awa', sex: 'F', age: 22 },
    { name: 'Koffi', sex: 'M', age: 24 },
    { name: 'Sika', sex: 'F', age: 21 },
    { name: 'Dave', sex: 'M', age: 23 },
    { name: 'Tim', sex: 'M', age: 15 },
  ]);
  const [awa, koffi, sika, dave, tim] = g1;
  check(awa.view?.me.isHost, 'le créateur est maître de la partie');
  check(awa.view?.minorNames?.join() === 'Tim', 'le maître connaît le mineur');
  check(koffi.view?.minorNames === undefined, 'les autres joueurs ne connaissent pas les mineurs');
  check(!koffi.view?.players.some((p) => 'minor' in p), 'aucun drapeau « mineur » envoyé aux autres');
  check(awa.view?.mode === 'adult', 'majorité de majeurs : mode adulte');

  check(!(await act(koffi, { type: 'open-menu' })).ok, 'un joueur ne peut pas lancer le menu');
  await act(awa, { type: 'settings', patch: { level: 2 } });
  check((await act(awa, { type: 'open-menu' })).ok, 'le maître ouvre le menu');
  check((await act(awa, { type: 'choose', game: 'tacle' })).ok, 'le maître lance les tacles');
  await until('phase de réponse', () => g1.every((c) => c.view?.phase === 'answer'));

  const idOf = (c: Client, name: string) => c.view!.answer!.targets!.find((t) => t.name === name)!.id;
  check(!(await act(koffi, { type: 'tacle:send', targetId: idOf(koffi, 'Tim'), prefix: 0, text: 'sexe', adult: true })).ok, 'un adulte ne peut pas viser un mineur avec du contenu adulte');
  check((await act(koffi, { type: 'tacle:send', targetId: idOf(koffi, 'Sika'), prefix: 1, text: 'tu es vraiment sexy', adult: true })).ok, 'un tacle adulte entre adultes passe');
  check((await act(sika, { type: 'tacle:send', targetId: idOf(sika, 'Dave'), prefix: 0, text: 'tu oublies toujours mon anniversaire', adult: false })).ok, 'un tacle tous publics passe');
  check(!(await act(tim, { type: 'tacle:send', targetId: idOf(tim, 'Awa'), prefix: 0, text: 'truc', adult: true })).ok, 'un mineur ne peut pas envoyer de contenu adulte');
  check(tim.view?.answer?.canAdult === false, 'le mineur n’a pas la case contenu adulte');
  for (const c of g1) await act(c, { type: 'done' });
  await until('dépouillement', () => g1.every((c) => c.view?.phase === 'reveal'));

  const seen = new Set<string>();
  for (let i = 0; i < 2; i++) {
    const rvTim = tim.view!.reveal!;
    const rvKoffi = koffi.view!.reveal!;
    const dump = JSON.stringify(g1.map((c) => c.view));
    check(!/authorId|Koffi.*auteur/.test(dump), 'aucun auteur dans les vues (carte ' + (i + 1) + ')');
    if (rvTim.item?.kind === 'masked') {
      seen.add('masked');
      check(rvKoffi.item?.kind === 'tacle', 'la carte adulte est masquée pour le mineur et visible pour les adultes');
      check(!JSON.stringify(tim.view).includes('sexy'), 'le texte adulte n’a jamais été envoyé au mineur');
    } else {
      seen.add('plain');
      check(rvTim.item?.kind === 'tacle', 'la carte tous publics est visible pour le mineur');
    }
    check(!(await act(koffi, { type: 'reveal:next' })).ok, 'seul le maître fait défiler');
    await act(awa, { type: 'reveal:next' });
    await sleep(80);
  }
  check(seen.has('masked') && seen.has('plain'), 'les deux types de cartes ont été vus');
  await until('entre deux tours', () => awa.view?.phase === 'between');
  check(awa.view?.phase === 'between', 'fin du dépouillement : écran entre deux tours');
  await act(awa, { type: 'end' });
  await until('fin', () => dave.view?.phase === 'ended');
  check(dave.view?.phase === 'ended', 'le maître termine la partie');
  closeAll(g1);

  /* ---------- Partie 2 : sondage (dingueries) et classement ---------- */
  console.log('\nPartie 2 : sondage, classement et reconnexion');
  const g2 = await makeRoom([
    { name: 'Ama', sex: 'F', age: 20 },
    { name: 'Bao', sex: 'M', age: 20 },
    { name: 'Cyr', sex: 'M', age: 20 },
    { name: 'Dia', sex: 'F', age: 20 },
  ]);
  const [ama, bao, cyr, dia] = g2;
  await act(ama, { type: 'open-menu' });
  await act(ama, { type: 'choose', game: 'ding' });
  // Un tour de dingueries sur trois environ est un sondage : on enchaîne les tours jusqu'à en voir un.
  let poll = false;
  for (let i = 0; i < 60 && !poll; i++) {
    await until('manche de dingueries', () => g2.every((c) => c.view?.phase === 'answer'));
    if (g2.some((c) => c.view?.answer?.pollVote)) {
      poll = true;
      break;
    }
    for (const c of g2) await act(c, { type: 'ding:answer', text: 'réponse de test' });
    await until('dépouillement', () => ama.view?.phase === 'reveal');
    while (ama.view?.phase === 'reveal') {
      await act(ama, { type: 'reveal:next' });
      await sleep(30);
    }
    await until('entre deux manches', () => ama.view?.phase === 'between');
    await act(ama, { type: 'again' });
  }
  check(poll, 'un sondage apparaît');
  const voters = g2.filter((c) => c.view?.answer?.pollVote).map((c) => c.name);
  check(voters.length >= 2, 'les votants reçoivent le sondage en même temps (' + voters.join(', ') + ')');
  const sameQuestion = new Set(g2.filter((c) => voters.includes(c.name)).map((c) => c.view!.answer!.question));
  check(sameQuestion.size === 1, 'tous les votants ont la même question');
  check(
    g2.filter((c) => voters.includes(c.name)).every((c) => !c.view!.answer!.targets!.some((t) => t.id === c.view!.me.id)),
    'on ne peut pas se voter soi-même',
  );
  check(
    g2.filter((c) => !voters.includes(c.name)).every((c) => !c.view!.answer!.pollVote && !!c.view!.answer!.question),
    'les autres répondent à une question normale',
  );

  // Bao perd sa connexion avant de répondre, puis revient avec son jeton.
  const saved = bao.session!;
  bao.socket.disconnect();
  await sleep(150);
  check(ama.view!.players.find((p) => p.name === 'Bao')?.connected === false, 'un joueur coupé apparaît hors ligne');
  const baoBack = await connect('Bao');
  const resumed = await call<Result>(baoBack, 'room:resume', saved);
  check(resumed.ok, 'reconnexion avec le jeton');
  await until('retour de Bao', () => baoBack.view?.phase === 'answer');
  check(baoBack.view?.me.name === 'Bao', 'Bao retrouve sa place');
  const bad = await call<Result>(baoBack, 'room:resume', { ...saved, token: 'faux' });
  check(!bad.ok, 'un faux jeton est refusé');

  const cur = [ama, baoBack, cyr, dia];
  for (const c of cur) {
    const a = c.view!.answer!;
    if (a.pollVote) await act(c, { type: 'vote:cast', targetId: a.targets![0].id });
    else await act(c, { type: 'ding:answer', text: 'ma réponse' });
  }
  await until('classement', () => ama.view?.phase === 'reveal');
  type PollView = { kind: string; voters: number; ranks: { shown: boolean; names: string[]; votes: number }[] };
  const pollItem = () => cyr.view!.reveal!.item as unknown as PollView;
  check(pollItem().kind === 'poll' && pollItem().ranks.every((r) => !r.shown), 'classement du sondage caché au départ');
  check(pollItem().voters === voters.length, 'dénominateur = nombre de votants');
  for (let i = 0; i < 6 && pollItem().kind === 'poll' && pollItem().ranks.some((r) => !r.shown); i++) {
    await act(ama, { type: 'reveal:next' });
    await sleep(60);
  }
  check(pollItem().kind === 'poll' && pollItem().ranks.every((r) => r.shown), 'classement entièrement dévoilé');
  closeAll([ama, baoBack, cyr, dia]);
  bao.socket.disconnect();

  /* ---------- Partie 3 : dingueries, défis, départ du maître ---------- */
  console.log('\nPartie 3 : dingueries, défis et départ du maître');
  const g3 = await makeRoom([
    { name: 'Eli', sex: 'M', age: 25 },
    { name: 'Fay', sex: 'F', age: 25 },
    { name: 'Gus', sex: 'M', age: 25 },
  ]);
  const [eli, fay, gus] = g3;
  await act(eli, { type: 'settings', patch: { together: true, deferred: true, level: 1 } });
  await act(eli, { type: 'open-menu' });
  await act(eli, { type: 'choose', game: 'ding' });
  await until('dingueries', () => g3.every((c) => c.view?.phase === 'answer'));
  check(g3.every((c) => !!c.view!.answer!.question), 'chaque joueur reçoit une question');
  // Un tour peut être un sondage : les votants choisissent une carte, les autres écrivent.
  const respond = async (c: Client, text: string) => {
    const a = c.view!.answer!;
    if (a.pollVote) await act(c, { type: 'vote:cast', targetId: a.targets![0].id });
    else await act(c, { type: 'ding:answer', text });
  };
  await respond(eli, 'ma réponse à moi');
  await respond(fay, 'ma réponse à elle');
  await respond(gus, 'ma réponse à lui');
  await until('dépouillement', () => eli.view?.phase === 'reveal');
  // Le classement d'un éventuel sondage passe en premier : on le fait défiler.
  for (let i = 0; i < 8 && eli.view?.phase === 'reveal' && fay.view?.reveal?.item?.kind === 'poll'; i++) {
    await act(eli, { type: 'reveal:next' });
    await sleep(60);
  }
  const q = fay.view!.reveal?.item;
  check(eli.view?.phase !== 'reveal' || (q?.kind === 'ding' && !!q.q && !!q.text), 'la carte montre la question et la réponse');
  for (let i = 0; i < 6 && eli.view?.phase === 'reveal'; i++) {
    await act(eli, { type: 'reveal:next' });
    await sleep(60);
  }
  await until('entre deux tours', () => eli.view?.phase === 'between');
  await act(eli, { type: 'menu' });
  await act(eli, { type: 'choose', game: 'defi' });
  await until('défi', () => fay.view?.phase === 'reveal' && fay.view?.reveal?.item?.kind === 'defi');
  check(fay.view?.reveal?.item?.kind === 'defi', 'un défi s’affiche pour tout le monde');
  await act(eli, { type: 'defi:result', result: 'skip' });
  await until('entre deux défis', () => eli.view?.phase === 'between');
  check(eli.view?.phase === 'between', 'le défi passé mène à l’écran entre deux tours');
  await act(eli, { type: 'menu' });

  // Le maître part : le rôle passe au joueur suivant.
  eli.socket.emit('room:leave', {});
  await until('nouveau maître', () => fay.view?.me.isHost === true);
  check(fay.view?.me.isHost, 'le rôle de maître passe au joueur suivant');
  await act(fay, { type: 'end' });
  closeAll(g3);

  console.log(failures === 0 ? '\nTout est bon.' : `\n${failures} vérification(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
