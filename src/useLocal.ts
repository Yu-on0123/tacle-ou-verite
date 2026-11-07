/**
 * Mode « un seul téléphone » : le moteur du jeu tourne dans le navigateur, sans serveur.
 * Le téléphone passe de main en main pendant la phase de réponse ; le lecture des cartes
 * se fait sur l'écran du maître de la partie.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { act, addPlayer, autoAgain, newRoom, removePlayer, validateInit, viewFor } from '../shared/engine';
import type { Action, Phase, PlayerInit, Result, Room, View } from '../shared/types';

export type LocalStep = 'pass' | 'play' | 'passback' | 'shared';

/** Actions faites par le joueur qui tient le téléphone ; toutes les autres sont celles du maître. */
const PLAYER_ACTIONS = new Set<string>(['tacle:send', 'ding:answer', 'vote:cast', 'done', 'aov:choose', 'aov:answer', 'defi:result', 'jacques:done', 'cap:result']);

interface Ui {
  turn: number;
  step: LocalStep;
  deadline: number | null;
}

/** Décide quel écran afficher sur l'unique téléphone après un changement d'état. */
function afterChange(room: Room, prev: Phase, ui: Ui): void {
  if (room.phase === 'answer' && room.round) {
    // Action ou Vérité : un seul joueur choisit puis éventuellement répond
    if (room.round.game === 'aov' && room.round.aov) {
      const idx = room.players.findIndex((p) => p.id === room.round!.aov!.playerId);
      ui.turn = idx >= 0 ? idx : 0;
      if (prev !== 'answer') {
        ui.step = 'pass';
        ui.deadline = null;
        return;
      }
      // Toujours en answer : choix ou réponse vérité — même joueur garde le téléphone
      if (room.round.aov.choice === 'verite' && room.round.aov.answer === undefined) {
        ui.step = 'play'; // reste sur le joueur pour répondre
        ui.deadline = room.round.deadline;
        return;
      }
      if (!room.round.aov.choice) {
        ui.step = 'play';
        return;
      }
      return;
    }
    if (prev !== 'answer') {
      ui.turn = 0;
      ui.step = 'pass';
      ui.deadline = null;
      return;
    }
    const cur = room.players[ui.turn];
    if (!cur || room.round.done.includes(cur.id)) {
      ui.turn++;
      ui.step = 'pass';
      ui.deadline = null;
    }
    return;
  }
  ui.step = room.phase === 'reveal' && prev === 'answer' ? 'passback' : 'shared';
  ui.deadline = null;
}

export function useLocal() {
  const roomRef = useRef<Room | null>(null);
  const ui = useRef<Ui>({ turn: 0, step: 'shared', deadline: null });
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const send = useCallback(async (action: Action): Promise<Result> => {
    const room = roomRef.current;
    if (!room) return { ok: false, error: 'Aucune partie en cours.' };
    const prev = room.phase;
    // Pendant le tour de réponse (téléphone en main) : actions du joueur courant.
    // Sinon (révélation / menu) : hôte, sauf validation d’un défi par le joueur concerné → hôte OK aussi.
    let actor = room.hostId;
    if (room.phase === 'answer' && PLAYER_ACTIONS.has(action.type)) {
      actor = room.players[ui.current.turn]?.id ?? room.hostId;
    }
    if (!actor) return { ok: false, error: 'Joueur introuvable.' };
    const error = act(room, actor, action);
    if (!error) afterChange(room, prev, ui.current);
    bump();
    return error ? { ok: false, error } : { ok: true };
  }, []);

  const addLocal = useCallback((init: PlayerInit): string | null => {
    const room = roomRef.current;
    if (!room) {
      const bad = validateInit(init);
      if (bad) return bad;
      const fresh = newRoom('LOCAL', init);
      fresh.settings.together = true;
      roomRef.current = fresh;
      bump();
      return null;
    }
    const res = addPlayer(room, init);
    bump();
    return 'error' in res ? res.error : null;
  }, []);

  const removeLocal = useCallback((id: string) => {
    const room = roomRef.current;
    if (!room) return;
    removePlayer(room, id);
    if (room.players.length === 0) roomRef.current = null;
    bump();
  }, []);

  const startTurn = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    ui.current.step = 'play';
    ui.current.deadline = Date.now() + room.settings.answerSeconds * 1000;
    bump();
  }, []);

  const revealStart = useCallback(() => {
    ui.current.step = 'shared';
    bump();
  }, []);

  const reset = useCallback(() => {
    roomRef.current = null;
    ui.current = { turn: 0, step: 'shared', deadline: null };
    bump();
  }, []);

  const room = roomRef.current;
  const u = ui.current;

  /* Chrono du tour de chaque joueur : à zéro, son tour se termine tout seul. */
  const playing = u.step === 'play';
  const deadline = u.deadline;
  const turn = u.turn;
  useEffect(() => {
    if (!playing || deadline == null) return;
    const id = setTimeout(() => void send({ type: 'done' }), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
  }, [playing, deadline, turn, send]);

  /* Les 5 secondes entre deux tours, puis relance automatique. */
  const betweenAt = room && room.phase === 'between' ? room.betweenDeadline : null;
  useEffect(() => {
    if (!betweenAt) return;
    const id = setTimeout(() => {
      const r = roomRef.current;
      if (!r || r.phase !== 'between') return;
      const prev = r.phase;
      autoAgain(r);
      afterChange(r, prev, ui.current);
      bump();
    }, Math.max(0, betweenAt - Date.now()));
    return () => clearTimeout(id);
  }, [betweenAt]);

  let view: View | null = null;
  let passName = '';
  if (room && room.players.length > 0) {
    if (room.phase === 'answer' && u.step === 'play') {
      view = { ...viewFor(room, room.players[u.turn].id), deadline: u.deadline };
    } else {
      view = viewFor(room, room.hostId, { shared: true });
    }
    if (room.phase === 'answer') passName = room.players[u.turn]?.name ?? '';
    if (u.step === 'passback') passName = room.players.find((p) => p.id === room.hostId)?.name ?? '';
  }

  return { view, step: u.step, passName, send, addLocal, removeLocal, startTurn, revealStart, reset };
}
