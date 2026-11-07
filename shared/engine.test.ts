import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  addPlayer,
  autoAgain,
  computeMode,
  forceEndAnswer,
  newRoom,
  removePlayer,
  setClock,
  setConnected,
  setRandom,
  viewFor,
} from './engine';
import type { Room, Sex } from './types';
import { speak } from './speak';
import { GAME_GUIDES, GAME_ORDER, GENERAL_GUIDE } from '../src/guides';
import { POLLS, AOV_ACTION_ALL, AOV_VERITE_ALL, CAP_ALL, DEFIS_ALL, DING_ALL, JACQUES } from './cards';

function make(ages: number[], settings: Partial<Room['settings']> = {}): Room {
  const mk = (i: number) => ({ name: 'J' + i, sex: (i % 2 ? 'F' : 'M') as Sex, age: ages[i] });
  const room = newRoom('ABCDE', mk(0), 'p0');
  for (let i = 1; i < ages.length; i++) {
    const res = addPlayer(room, mk(i), 'p' + i);
    assert.ok('player' in res, 'ajout du joueur ' + i);
  }
  act(room, 'p0', { type: 'settings', patch: settings });
  return room;
}

test('règle des 60 % et duo majeur/mineur', () => {
  assert.equal(computeMode(make([20, 21, 22, 16, 15])), 'adult'); // 3/5 = 60 %
  assert.equal(computeMode(make([20, 21, 16, 15, 14])), 'ado'); // 2/5
  assert.equal(computeMode(make([16, 15, 14])), 'ado');
  assert.equal(computeMode(make([20, 21])), 'adult');
  assert.equal(computeMode(make([20, 16])), 'ado'); // duo : choix du maître, par défaut Ado
  assert.equal(computeMode(make([20, 16], { duoMode: 'adult' })), 'adult');
});

test('validation des joueurs', () => {
  const room = make([20, 21]);
  assert.ok('error' in addPlayer(room, { name: 'X', sex: 'M', age: 12 }));
  assert.ok('error' in addPlayer(room, { name: '', sex: 'M', age: 20 }));
  assert.ok('error' in addPlayer(room, { name: 'j0', sex: 'M', age: 20 })); // doublon
  assert.ok('player' in addPlayer(room, { name: 'Nouveau', sex: 'F', age: 13 }));
});

test('tacles : l’auteur ne apparaît jamais, le dépouillement suit le maître', () => {
  const room = make([20, 21, 22]);
  act(room, 'p0', { type: 'open-menu' });
  assert.equal(act(room, 'p0', { type: 'choose', game: 'tacle' }), null);
  assert.equal(room.phase, 'answer');
  assert.equal(act(room, 'p1', { type: 'tacle:send', targetId: 'p2', prefix: 0, text: 'tu ronfles', adult: false }), null);
  assert.equal(act(room, 'p1', { type: 'tacle:send', targetId: 'p2', prefix: 0, text: 'encore', adult: false }), 'Tu as déjà joué la carte de J2.');
  assert.ok(act(room, 'p1', { type: 'tacle:send', targetId: 'p1', prefix: 0, text: 'moi', adult: false }));
  act(room, 'p0', { type: 'done' });
  act(room, 'p1', { type: 'done' });
  assert.equal(room.phase, 'answer');
  act(room, 'p2', { type: 'done' });
  assert.equal(room.phase, 'reveal');
  const json = JSON.stringify(viewFor(room, 'p2'));
  assert.ok(json.includes('tu ronfles'));
  assert.ok(!json.includes('authorId'));
  const v = viewFor(room, 'p2');
  assert.equal(v.reveal?.item?.kind, 'tacle');
  assert.equal(act(room, 'p1', { type: 'reveal:next' }), 'Seul le maître de la partie fait défiler les cartes.');
  act(room, 'p0', { type: 'reveal:next' });
  assert.equal(room.phase, 'between');
});

test('mineurs : jamais de contenu adulte reçu, envoyé ou visé', () => {
  const room = make([20, 21, 22, 23, 15]); // 4/5 adultes, un mineur (p4)
  assert.equal(room.mode, 'adult');
  act(room, 'p0', { type: 'open-menu' });
  act(room, 'p0', { type: 'settings', patch: { level: 2 } });
  act(room, 'p0', { type: 'choose', game: 'tacle' });
  // cible mineure
  assert.match(String(act(room, 'p1', { type: 'tacle:send', targetId: 'p4', prefix: 0, text: 'sexe', adult: false })), /cette personne/);
  // expéditeur mineur
  assert.match(String(act(room, 'p4', { type: 'tacle:send', targetId: 'p1', prefix: 0, text: 'truc', adult: true })), /mineurs/);
  // adulte vers adulte
  assert.equal(act(room, 'p1', { type: 'tacle:send', targetId: 'p2', prefix: 1, text: 'tu es sexy', adult: false }), null);
  assert.equal(act(room, 'p1', { type: 'tacle:send', targetId: 'p3', prefix: 0, text: 'tu oublies tout', adult: false }), null);
  for (const id of ['p0', 'p1', 'p2', 'p3', 'p4']) act(room, id, { type: 'done' });
  assert.equal(room.phase, 'reveal');
  // trouver la carte adulte : mineur => masquée, adulte en ligne => visible
  let seenMasked = false;
  for (let i = 0; i < 2; i++) {
    const minorView = viewFor(room, 'p4');
    const adultView = viewFor(room, 'p2');
    const item = room.round!.reveal!.items[room.round!.reveal!.index];
    if (item.adult) {
      seenMasked = true;
      assert.equal(minorView.reveal?.item?.kind, 'masked');
      assert.notEqual(adultView.reveal?.item?.kind, 'masked');
      assert.ok(!JSON.stringify(minorView).includes('sexy'));
      // écran partagé : le maître doit confirmer
      const shared = viewFor(room, 'p0', { shared: true });
      assert.deepEqual(shared.reveal?.gate?.minors, ['J4']);
      assert.equal(shared.reveal?.item, undefined);
      act(room, 'p0', { type: 'reveal:gate' });
      assert.equal(viewFor(room, 'p0', { shared: true }).reveal?.item?.kind, 'tacle');
    }
    act(room, 'p0', { type: 'reveal:next' });
  }
  assert.ok(seenMasked);
});

test('dingueries : les mineurs ne reçoivent que des questions tous publics', () => {
  const room = make([20, 21, 22, 23, 15], { level: 2 });
  act(room, 'p0', { type: 'open-menu' });
  for (let k = 0; k < 40; k++) {
    act(room, 'p0', { type: 'choose', game: 'ding' }) ?? null;
    if (room.phase === 'menu') continue;
    const q = room.round!.questions['p4'];
    if (!q) {
      // Sondage : le mineur vote, et la carte du sondage ne doit pas être adulte.
      assert.ok(!room.round!.poll!.card.adult, 'sondage adulte reçu par un mineur');
    } else {
      assert.ok(!q.adult, 'question adulte reçue par un mineur : ' + q.q);
    }
    forceEndAnswer(room);
    room.phase = 'menu';
  }
});

test('sondage (dingueries) : votants simultanés, cartes filtrées par sexe, classement dévoilé du dernier au premier', () => {
  setRandom(() => 0); // force un sondage, et la première carte : « Qui est la plus belle ici ? »
  try {
    const room = make([20, 21, 22, 23, 24, 25, 26, 27]); // garçons p0 p2 p4 p6, filles p1 p3 p5 p7
    act(room, 'p0', { type: 'open-menu' });
    act(room, 'p0', { type: 'choose', game: 'ding' });
    assert.ok(room.round!.poll, 'la manche est un sondage');
    assert.equal(room.round!.poll!.card.q, 'Qui est la plus belle ici ?');
    for (const id of ['p0', 'p2', 'p4', 'p6']) {
      const a = viewFor(room, id).answer!;
      assert.ok(a.pollVote, 'les garçons votent en même temps');
      assert.equal(a.question, 'Qui est la plus belle ici ?');
      assert.deepEqual(a.targets!.map((x) => x.id).sort(), ['p1', 'p3', 'p5', 'p7'], 'seulement des filles à choisir');
    }
    for (const id of ['p1', 'p3', 'p5', 'p7']) {
      const a = viewFor(room, id).answer!;
      assert.ok(!a.pollVote && a.question, 'les filles répondent à une question normale');
    }
    assert.equal(act(room, 'p1', { type: 'vote:cast', targetId: 'p3' }), 'Tu ne votes pas pour ce sondage.');
    assert.equal(act(room, 'p0', { type: 'vote:cast', targetId: 'p2' }), 'Carte invalide.');
    assert.equal(act(room, 'p0', { type: 'vote:cast', targetId: 'p0' }), 'Carte invalide.');
    for (const [from, to] of [['p0', 'p1'], ['p2', 'p1'], ['p4', 'p3'], ['p6', 'p1']]) {
      assert.equal(act(room, from, { type: 'vote:cast', targetId: to }), null);
    }
    assert.equal(room.phase, 'answer', 'on attend encore les filles');
    for (const id of ['p1', 'p3', 'p5', 'p7']) assert.equal(act(room, id, { type: 'ding:answer', text: 'ma réponse' }), null);
    assert.equal(room.phase, 'reveal');
    type PollItem = { kind: string; voters: number; ranks: { shown: boolean; names: string[]; votes: number }[] };
    const item = () => viewFor(room, 'p3').reveal!.item as unknown as PollItem;
    assert.equal(item().kind, 'poll', 'le classement passe en premier');
    assert.equal(item().voters, 4);
    assert.deepEqual(item().ranks.map((r) => r.shown), [false, false]);
    act(room, 'p0', { type: 'reveal:next' });
    assert.deepEqual(item().ranks.map((r) => r.shown), [false, true]);
    assert.deepEqual(item().ranks[1].names, ['J3']);
    assert.deepEqual(item().ranks[0].names, []);
    act(room, 'p0', { type: 'reveal:next' });
    assert.deepEqual(item().ranks.map((r) => [r.names, r.votes]), [[['J1'], 3], [['J3'], 1]]);
    act(room, 'p0', { type: 'reveal:next' });
    assert.equal(viewFor(room, 'p3').reveal!.item!.kind, 'ding', 'puis les réponses des autres');
  } finally {
    setRandom(Math.random);
  }
});

test('sondage : jamais de carte adulte avec un mineur, jamais à deux joueurs, et il en sort', () => {
  const withMinor = make([20, 21, 22, 23, 15], { level: 2 });
  act(withMinor, 'p0', { type: 'open-menu' });
  let polls = 0;
  for (let k = 0; k < 300; k++) {
    act(withMinor, 'p0', { type: 'choose', game: 'ding' });
    const p = withMinor.round!.poll;
    if (p) {
      polls++;
      assert.ok(!p.card.adult, 'sondage adulte avec un mineur : ' + p.card.q);
    }
    withMinor.phase = 'menu';
  }
  assert.ok(polls > 20, 'des sondages sortent (' + polls + ')');
  const duo = make([20, 21], { level: 2 });
  act(duo, 'p0', { type: 'open-menu' });
  for (let k = 0; k < 100; k++) {
    act(duo, 'p0', { type: 'choose', game: 'ding' });
    assert.equal(duo.round!.poll, undefined, 'pas de sondage à deux');
    duo.phase = 'menu';
  }
});

test('fin du flux : plus aucun tacle envoyé → avertissement, le maître relance ou termine', () => {
  const room = make([20, 21, 22]);
  act(room, 'p0', { type: 'open-menu' });
  act(room, 'p0', { type: 'choose', game: 'tacle', variant: 1 });
  for (const id of ['p0', 'p1', 'p2']) act(room, id, { type: 'done' });
  assert.equal(room.phase, 'between');
  assert.equal(room.betweenDeadline, null); // pas de relance automatique
  assert.equal(viewFor(room, 'p1').dry, true);
  assert.equal(act(room, 'p1', { type: 'again' }), 'Seul le maître de la partie lance un nouveau tour.');
  // Relance : même jeu, même début de phrase.
  assert.equal(act(room, 'p0', { type: 'again' }), null);
  assert.equal(room.phase, 'answer');
  assert.equal(room.round!.prefix, 1);
  for (const id of ['p0', 'p1', 'p2']) act(room, id, { type: 'done' });
  assert.equal(act(room, 'p0', { type: 'end' }), null);
  assert.equal(room.phase, 'ended');
});

test('deux jeux distincts : « Moi au moins… » et « Je ne te l’ai jamais dit mais… »', () => {
  for (const [variant, expected] of [[0, 'Moi au moins…'], [1, 'Je ne te l’ai jamais dit mais…']] as const) {
    const room = make([20, 21, 22]);
    act(room, 'p0', { type: 'open-menu' });
    act(room, 'p0', { type: 'choose', game: 'tacle', variant });
    assert.equal(viewFor(room, 'p1').answer?.prefix, expected);
    // Le client peut demander l'autre début : le jeu choisi s'impose.
    act(room, 'p1', { type: 'tacle:send', targetId: 'p2', prefix: variant === 0 ? 1 : 0, text: 'tu ronfles', adult: false });
    for (const id of ['p0', 'p1', 'p2']) act(room, id, { type: 'done' });
    const item = viewFor(room, 'p0').reveal?.item;
    assert.equal(item?.kind, 'tacle');
    if (item?.kind === 'tacle') assert.equal(item.prefix, expected);
  }
});
test('chrono écoulé, joueurs déconnectés et relance automatique', () => {
  let t = 1_000_000;
  setClock(() => t);
  setRandom(() => 0.99); // jamais de sondage : ce test suit des réponses écrites
  const room = make([20, 21, 22]);
  act(room, 'p0', { type: 'open-menu' });
  act(room, 'p0', { type: 'choose', game: 'ding' });
  assert.equal(room.round!.deadline, t + 180_000);
  act(room, 'p0', { type: 'ding:answer', text: 'ma réponse' });
  setConnected(room, 'p2', false); // déconnecté : on n'attend pas
  assert.equal(room.phase, 'answer');
  act(room, 'p1', { type: 'ding:answer', text: 'autre réponse' });
  assert.equal(room.phase, 'reveal');
  act(room, 'p0', { type: 'reveal:next' });
  act(room, 'p0', { type: 'reveal:next' });
  assert.equal(room.phase, 'between');
  assert.equal(room.betweenDeadline, t + 5000);
  autoAgain(room);
  assert.equal(room.phase, 'answer');
  forceEndAnswer(room); // chrono écoulé sans aucune réponse : on enchaîne
  assert.equal(room.phase, 'between');
  setClock(() => Date.now());
  setRandom(Math.random);
});

test('départ du maître : le rôle passe, et moins de deux joueurs termine la partie', () => {
  const room = make([20, 21, 22]);
  act(room, 'p0', { type: 'open-menu' });
  removePlayer(room, 'p0');
  assert.equal(room.hostId, 'p1');
  removePlayer(room, 'p2');
  assert.equal(room.phase, 'ended');
  assert.equal(room.endReason, 'alone');
});

test('défis : cartes adaptées, carnet des dettes', () => {
  const room = make([20, 21], { level: 1, together: false, deferred: true });
  act(room, 'p0', { type: 'open-menu' });
  for (let k = 0; k < 30; k++) {
    assert.equal(act(room, 'p0', { type: 'choose', game: 'defi' }), null);
    const item = room.round!.reveal!.items[0];
    assert.ok(item.kind === 'defi' && item.tag !== 'physical');
    if (k === 0) {
      act(room, 'p0', { type: 'defi:result', result: 'later' });
      assert.equal(room.debts.length, 1);
    } else {
      act(room, 'p0', { type: 'defi:result', result: 'done' });
    }
    assert.equal(room.phase, 'between');
    act(room, 'p0', { type: 'menu' });
  }
  const sans = make([20, 21], { level: 1, deferred: false });
  act(sans, 'p0', { type: 'open-menu' });
  for (let k = 0; k < 30; k++) {
    act(sans, 'p0', { type: 'choose', game: 'defi' });
    const item = sans.round!.reveal!.items[0];
    assert.ok(item.kind === 'defi' && item.tag === 'now');
    sans.phase = 'menu';
  }
});

test('réglages : bornes et droits', () => {
  const room = make([20, 21]);
  assert.ok(act(room, 'p1', { type: 'settings', patch: { level: 2 } }));
  act(room, 'p0', { type: 'settings', patch: { answerSeconds: 5 } });
  assert.equal(room.settings.answerSeconds, 30);
  act(room, 'p0', { type: 'settings', patch: { answerSeconds: 9999 } });
  assert.equal(room.settings.answerSeconds, 600);
  // La composition n'est plus un réglage : elle suit les joueurs.
  act(room, 'p0', { type: 'settings', patch: { composition: 'guys' } });
  assert.equal(room.settings.composition, 'mixed');
});

test('composition : déduite du sexe des joueurs', () => {
  assert.equal(make([20, 21, 22]).settings.composition, 'mixed');
  const room = newRoom('ABCDE', { name: 'A', sex: 'M', age: 20 }, 'p0');
  addPlayer(room, { name: 'B', sex: 'M', age: 21 }, 'p1');
  assert.equal(room.settings.composition, 'guys');
  const f = newRoom('FGHIJ', { name: 'A', sex: 'F', age: 20 }, 'q0');
  addPlayer(f, { name: 'B', sex: 'F', age: 21 }, 'q1');
  assert.equal(f.settings.composition, 'girls');
});

test('Cap ou Pas Cap : accepter ou refuser', () => {
  const room = make([20, 21], { level: 1 });
  act(room, 'p0', { type: 'open-menu' });
  assert.equal(act(room, 'p0', { type: 'choose', game: 'cap' }), null);
  assert.equal(room.phase, 'reveal');
  assert.equal(room.round!.reveal!.items[0].kind, 'cap');
  assert.equal(act(room, 'p0', { type: 'cap:result', result: 'pascap' }), null);
  assert.equal(room.phase, 'between');
});

test('Jacques a dit : 3 joueurs minimum et même pièce', () => {
  const duo = make([20, 21], { together: true });
  act(duo, 'p0', { type: 'open-menu' });
  assert.match(String(act(duo, 'p0', { type: 'choose', game: 'jacques' })), /trois joueurs/);
  const room = make([20, 21, 22], { together: false });
  act(room, 'p0', { type: 'open-menu' });
  assert.match(String(act(room, 'p0', { type: 'choose', game: 'jacques' })), /même pièce/);
  act(room, 'p0', { type: 'settings', patch: { together: true } });
  assert.equal(act(room, 'p0', { type: 'choose', game: 'jacques' }), null);
  assert.equal(room.phase, 'reveal');
  const item = room.round!.reveal!.items[0];
  assert.equal(item.kind, 'jacques');
  if (item.kind === 'jacques') assert.doesNotMatch(item.text, /Piège|piège/);
  act(room, 'p0', { type: 'jacques:done' });
  assert.equal(room.phase, 'between');
});

test('Jacques a dit : l’ordre est dit une fois sur deux environ, sans jamais l’annoncer', () => {
  let said = 0;
  let notSaid = 0;
  for (let i = 0; i < 40; i++) {
    const room = make([20, 21, 22], { together: true });
    act(room, 'p0', { type: 'open-menu' });
    act(room, 'p0', { type: 'choose', game: 'jacques' });
    const item = room.round!.reveal!.items[0];
    if (item.kind !== 'jacques') throw new Error('mauvais type');
    if (item.text.startsWith('Jacques a dit')) said++;
    else notSaid++;
  }
  assert.ok(said > 0 && notSaid > 0, `dit ${said}, non dit ${notSaid}`);
});

test('Quiz : le jeu n’existe plus', () => {
  const room = make([20, 21]);
  act(room, 'p0', { type: 'open-menu' });
  assert.equal(act(room, 'p0', { type: 'choose', game: 'quiz' as never }), 'Jeu inconnu.');
});

test('attirance : jamais à deux du même sexe, ni sans deux personnes du sexe opposé', () => {
  // On tire beaucoup de vérités et on vérifie qu'aucune carte d'attirance de groupe ne sort si la condition manque.
  const attractRe = /Qui ici t’attire le plus/;
  const run = (players: { sex: Sex }[]) => {
    let seen = false;
    for (let i = 0; i < 400; i++) {
      const room = newRoom('ABCDE', { name: 'P0', sex: players[0].sex, age: 22 }, 'p0');
      players.slice(1).forEach((p, k) => addPlayer(room, { name: 'P' + (k + 1), sex: p.sex, age: 22 }, 'p' + (k + 1)));
      act(room, 'p0', { type: 'settings', patch: { level: 2 } });
      act(room, 'p0', { type: 'open-menu' });
      act(room, 'p0', { type: 'choose', game: 'aov' });
      const who = room.round!.aov!.playerId;
      act(room, who, { type: 'aov:choose', choice: 'verite' });
      const card = room.round!.aov?.card as { q?: string } | undefined;
      if (card?.q && attractRe.test(card.q)) seen = true;
    }
    return seen;
  };
  // La carte est tirée pour le premier joueur : il lui faut 2 joueurs du sexe opposé.
  assert.equal(run([{ sex: 'M' }, { sex: 'F' }]), false); // à deux : jamais
  assert.equal(run([{ sex: 'M' }, { sex: 'M' }, { sex: 'M' }]), false); // que des garçons
  assert.equal(run([{ sex: 'M' }, { sex: 'M' }, { sex: 'F' }]), false); // le garçon n'a qu'une fille en face
  assert.equal(run([{ sex: 'M' }, { sex: 'F' }, { sex: 'F' }]), true); // deux filles en face
  assert.equal(run([{ sex: 'F' }, { sex: 'M' }, { sex: 'M' }]), true); // deux garçons en face
});

test('textes : à deux, plus de « les autres », « tout le monde » ni « ici »', () => {
  const room = make([20, 21], { together: true, level: 2 });
  for (const game of ['ding', 'aov', 'cap', 'defi'] as const) {
    for (let i = 0; i < 60; i++) {
      const r = make([20, 21], { together: true, level: 2 });
      act(r, 'p0', { type: 'open-menu' });
      assert.equal(act(r, 'p0', { type: 'choose', game }), null);
      let text = '';
      if (game === 'ding') text = Object.values(r.round!.questions).map((c) => c.q).join(' | ');
      else if (game === 'aov') {
        const who = r.round!.aov!.playerId;
        act(r, who, { type: 'aov:choose', choice: i % 2 ? 'verite' : 'action' });
        const c = r.round!.aov!.card as { q?: string; t?: string };
        text = c.q ?? c.t ?? '';
      } else if (game === 'cap') text = (r.round!.solo!.card as { t: string }).t;
      else text = r.round!.defi!.card.t;
      assert.doesNotMatch(text, /les autres|tout le monde|le groupe|\bici\b|personne de ton choix|quelqu’un d’ici|\{|\[\[|\(e\)/i, game + ' : ' + text);
    }
  }
  assert.ok(room);
});

test('Action ou Vérité : vérité à voix haute, rien n’est écrit', () => {
  const room = make([20, 21, 22], { together: true, aovVoice: true });
  act(room, 'p0', { type: 'open-menu' });
  act(room, 'p0', { type: 'choose', game: 'aov' });
  const who = room.round!.aov!.playerId;
  assert.equal(act(room, who, { type: 'aov:choose', choice: 'verite' }), null);
  assert.equal(room.phase, 'reveal');
  const item = room.round!.reveal!.items[0];
  assert.equal(item.kind, 'aov');
  if (item.kind === 'aov') assert.equal(item.answer, undefined);
});

test('Action ou Vérité : vérité avec réponse partagée, action visible', () => {
  const room = make([20, 21, 22]);
  act(room, 'p0', { type: 'open-menu' });
  assert.equal(act(room, 'p0', { type: 'choose', game: 'aov' }), null);
  assert.equal(room.phase, 'answer');
  assert.ok(room.round!.aov);
  const target = room.round!.aov!.playerId;
  assert.ok(act(room, target === 'p0' ? 'p1' : 'p0', { type: 'aov:choose', choice: 'verite' }));
  assert.equal(act(room, target, { type: 'aov:choose', choice: 'verite' }), null);
  assert.equal(room.phase, 'answer'); // encore en réponse
  assert.equal(act(room, target, { type: 'aov:answer', text: 'ma vérité' }), null);
  assert.equal(room.phase, 'reveal');
  const item = room.round!.reveal!.items[0];
  assert.equal(item.kind, 'aov');
  if (item.kind === 'aov') {
    assert.equal(item.choice, 'verite');
    assert.equal(item.answer, 'ma vérité');
  }
  // le joueur ciblé peut valider
  assert.equal(act(room, target, { type: 'defi:result', result: 'done' }), null);
  assert.equal(room.phase, 'between');

  act(room, 'p0', { type: 'menu' });
  assert.equal(act(room, 'p0', { type: 'choose', game: 'aov' }), null);
  const t2 = room.round!.aov!.playerId;
  assert.equal(act(room, t2, { type: 'aov:choose', choice: 'action' }), null);
  assert.equal(room.phase, 'reveal');
  const it2 = room.round!.reveal!.items[0];
  assert.equal(it2.kind, 'aov');
  if (it2.kind === 'aov') assert.equal(it2.choice, 'action');
});

test('cartes : contenu retiré absent, niveaux valides, carte « garçon » jamais tirée pour une fille', () => {
  const all = [
    ...DING_ALL.map((c) => c.q),
    ...AOV_VERITE_ALL.map((c) => c.q),
    ...AOV_ACTION_ALL.map((c) => c.t),
    ...CAP_ALL.map((c) => c.t),
    ...DEFIS_ALL.map((c) => c.t),
    ...JACQUES.map((c) => c.t),
  ];
  for (const bad of ['un surnom pour', 'bourré', 'photos intimes', 'même sexe', 'relation secrète', '3 derniers messages']) {
    assert.equal(all.filter((s) => s.includes(bad)).length, 0, 'contenu retiré : ' + bad);
  }
  for (const c of [...DING_ALL, ...AOV_VERITE_ALL, ...AOV_ACTION_ALL, ...CAP_ALL, ...DEFIS_ALL, ...JACQUES]) {
    assert.ok([0, 1, 2, 3].includes(c.lv));
  }
  // Duo garçon/fille : « Combien de numéros de filles… » ne sort que pour le garçon.
  let boy = false;
  for (let i = 0; i < 600; i++) {
    for (const first of ['M', 'F'] as Sex[]) {
      const room = newRoom('ABCDE', { name: 'P0', sex: first, age: 22 }, 'p0');
      addPlayer(room, { name: 'P1', sex: first === 'M' ? 'F' : 'M', age: 22 }, 'p1');
      act(room, 'p0', { type: 'settings', patch: { level: 1 } });
      act(room, 'p0', { type: 'open-menu' });
      act(room, 'p0', { type: 'choose', game: 'aov' });
      act(room, room.round!.aov!.playerId, { type: 'aov:choose', choice: 'verite' });
      const q = (room.round!.aov?.card as { q?: string } | undefined)?.q ?? '';
      if (q.includes('numéros de filles')) {
        assert.equal(first, 'M', 'sortie pour une fille !');
        boy = true;
      }
    }
  }
  assert.ok(boy, 'la carte garçon doit pouvoir sortir');
});

test('niveaux : Débutant = que du Débutant, Extrême ne redescend jamais au Débutant', () => {
  const seen: Record<number, Set<number>> = { 0: new Set(), 1: new Set(), 2: new Set() };
  for (const level of [0, 1, 2] as const) {
    for (let i = 0; i < 300; i++) {
      const room = newRoom('ABCDE', { name: 'P0', sex: 'M', age: 22 }, 'p0');
      addPlayer(room, { name: 'P1', sex: 'F', age: 22 }, 'p1');
      addPlayer(room, { name: 'P2', sex: 'M', age: 22 }, 'p2');
      act(room, 'p0', { type: 'settings', patch: { level } });
      act(room, 'p0', { type: 'open-menu' });
      act(room, 'p0', { type: 'choose', game: 'aov' });
      act(room, room.round!.aov!.playerId, { type: 'aov:choose', choice: 'verite' });
      const card = room.round!.aov?.card as { lv?: number } | undefined;
      if (card && typeof card.lv === 'number') seen[level].add(card.lv);
    }
  }
  assert.deepEqual([...seen[0]], [0], 'Débutant ne tire que du niveau 0');
  assert.ok(![...seen[1]].includes(2), 'Moyen ne tire jamais de Extrême');
  assert.ok(![...seen[2]].includes(0), 'Extrême ne tire jamais de Débutant');
  assert.ok(seen[2].has(2) && seen[1].has(1), 'le niveau choisi sort bien');
});

test('contenu : au moins 20 cartes par niveau, avec et sans les cartes adultes, et « d’ici » devient « ici » en groupe', () => {
  const decks: Record<string, { lv: number; adult?: boolean }[]> = {
    Dingueries: DING_ALL,
    Vérité: AOV_VERITE_ALL,
    Action: AOV_ACTION_ALL,
    Défis: DEFIS_ALL,
    Cap: CAP_ALL,
    'Jacques a dit': JACQUES,
    Sondages: POLLS,
  };
  for (const [name, deck] of Object.entries(decks)) {
    for (const lv of [0, 1, 2]) {
      const own = deck.filter((c) => c.lv === lv);
      assert.ok(own.length >= 20, `${name}, niveau ${lv} : ${own.length} cartes`);
      const ado = own.filter((c) => !c.adult);
      assert.ok(ado.length >= 20, `${name}, niveau ${lv}, sans adultes : ${ado.length} cartes`);
    }
  }
  const group = speak('Cap de dire à quelqu’un d’ici ce que tu penses de lui/elle.', {
    who: { sex: 'M' },
    others: [{ name: 'Alex' }, { name: 'Bao' }],
  });
  assert.equal(group, 'Cap de dire à quelqu’un ici ce que tu penses de lui/elle.');
  const duo = speak('Cap de dire à quelqu’un d’ici ce que tu penses de lui/elle.', {
    who: { sex: 'M' },
    others: [{ name: 'Alex' }],
  });
  assert.equal(duo, 'Cap de dire à Alex ce que tu penses de lui/elle.');
});

test('guides : une fiche complète par jeu du menu, et un guide général', () => {
  assert.deepEqual([...GAME_ORDER].sort(), ['aov', 'cap', 'defi', 'ding', 'jacques', 'tacle-0', 'tacle-1']);
  for (const id of GAME_ORDER) {
    const g = GAME_GUIDES[id];
    assert.equal(g.id, id);
    assert.ok(g.title && g.tagline, id);
    assert.ok(g.steps.length >= 3, id + ' : au moins 3 étapes');
    assert.ok(g.tips.length >= 1, id + ' : au moins une astuce');
  }
  assert.ok(GENERAL_GUIDE.intro.length > 50);
  for (const title of ['Démarrer', 'Les trois niveaux', 'Âge et contenu', 'Anonymat']) {
    assert.ok(GENERAL_GUIDE.sections.some((s) => s.title === title && s.items.length > 0), title);
  }
});

test('Même pièce : les défis « bon pour plus tard » sont désactivés', () => {
  const room = make([20, 21, 22], { together: false, deferred: true });
  assert.equal(room.settings.deferred, true);
  act(room, 'p0', { type: 'settings', patch: { together: true } });
  assert.equal(room.settings.deferred, false);
  act(room, 'p0', { type: 'settings', patch: { deferred: true } });
  assert.equal(room.settings.deferred, false);
});
