/**
 * Gestion des salons en mémoire. Rien n'est écrit sur disque ni en base :
 * quand un salon se ferme (ou que le serveur redémarre), tout disparaît.
 */
import { randomBytes } from 'node:crypto';
import {
  act,
  addPlayer,
  autoAgain,
  forceEndAnswer,
  newRoom,
  now,
  removePlayer,
  setConnected,
  transferHost,
  viewFor,
} from '../shared/engine';
import type { Action, PlayerInit, Room, View } from '../shared/types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 500;
/** Marge accordée après la fin du chrono, pour laisser arriver les dernières réponses. */
const GRACE_MS = 2000;
const HOST_GRACE_MS = 20_000;
const EMPTY_ROOM_MS = 10 * 60_000;
const ENDED_ROOM_MS = 2 * 60_000;
const MAX_ROOM_AGE_MS = 6 * 60 * 60_000;

interface Runtime {
  room: Room;
  tokens: Map<string, string>;
  sockets: Map<string, string>;
  timer?: NodeJS.Timeout;
  hostTimer?: NodeJS.Timeout;
  emptySince: number | null;
  endedAt: number | null;
}

export interface Joined {
  code: string;
  playerId: string;
  token: string;
}

type Emit = (socketId: string, event: 'state' | 'closed', payload?: View) => void;

export class RoomManager {
  private rooms = new Map<string, Runtime>();
  private sweeper: NodeJS.Timeout;

  constructor(private emit: Emit) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  count(): number {
    return this.rooms.size;
  }

  stop(): void {
    clearInterval(this.sweeper);
    for (const rt of this.rooms.values()) this.clearTimers(rt);
  }

  private newCode(): string {
    for (let tries = 0; tries < 50; tries++) {
      const bytes = randomBytes(5);
      let code = '';
      for (const b of bytes) code += CODE_CHARS[b % CODE_CHARS.length];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Impossible de créer un code.');
  }

  create(init: PlayerInit, socketId: string): Joined | { error: string } {
    if (this.rooms.size >= MAX_ROOMS) return { error: 'Le serveur est plein, réessaie dans quelques minutes.' };
    const token = randomBytes(16).toString('hex');
    let room: Room;
    try {
      room = newRoom(this.newCode(), init);
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Création impossible.' };
    }
    const playerId = room.hostId;
    const rt: Runtime = {
      room,
      tokens: new Map([[playerId, token]]),
      sockets: new Map([[playerId, socketId]]),
      emptySince: null,
      endedAt: null,
    };
    this.rooms.set(room.code, rt);
    this.changed(rt);
    return { code: room.code, playerId, token };
  }

  join(codeRaw: string, init: PlayerInit, socketId: string): Joined | { error: string } {
    const rt = this.rooms.get(normalize(codeRaw));
    if (!rt) return { error: 'Ce salon n’existe pas ou n’existe plus.' };
    const res = addPlayer(rt.room, init);
    if ('error' in res) return res;
    const token = randomBytes(16).toString('hex');
    rt.tokens.set(res.player.id, token);
    rt.sockets.set(res.player.id, socketId);
    rt.emptySince = null;
    this.changed(rt);
    return { code: rt.room.code, playerId: res.player.id, token };
  }

  resume(codeRaw: string, playerId: string, token: string, socketId: string): Joined | { error: string } {
    const rt = this.rooms.get(normalize(codeRaw));
    if (!rt || rt.tokens.get(playerId) !== token || !rt.room.players.some((p) => p.id === playerId)) {
      return { error: 'Impossible de revenir dans ce salon.' };
    }
    rt.sockets.set(playerId, socketId);
    rt.emptySince = null;
    setConnected(rt.room, playerId, true);
    if (rt.room.hostId === playerId && rt.hostTimer) {
      clearTimeout(rt.hostTimer);
      rt.hostTimer = undefined;
    }
    this.changed(rt);
    return { code: rt.room.code, playerId, token };
  }

  act(code: string, playerId: string, action: Action): string | null {
    const rt = this.rooms.get(code);
    if (!rt) return 'Ce salon n’existe plus.';
    const before = new Set(rt.room.players.map((p) => p.id));
    const error = act(rt.room, playerId, action);
    this.dropRemoved(rt, before);
    this.changed(rt);
    return error;
  }

  /** Le joueur quitte volontairement (bouton « Quitter »). */
  leave(code: string, playerId: string): void {
    const rt = this.rooms.get(code);
    if (!rt) return;
    const before = new Set(rt.room.players.map((p) => p.id));
    removePlayer(rt.room, playerId);
    rt.sockets.delete(playerId);
    rt.tokens.delete(playerId);
    this.dropRemoved(rt, before);
    if (rt.room.players.length === 0) {
      this.destroy(code);
      return;
    }
    this.changed(rt);
  }

  /** La connexion d'un joueur s'est coupée : on le garde, il pourra revenir avec son jeton. */
  disconnect(code: string, playerId: string, socketId: string): void {
    const rt = this.rooms.get(code);
    if (!rt) return;
    if (rt.sockets.get(playerId) !== socketId) return; // il s'est déjà reconnecté ailleurs
    rt.sockets.delete(playerId);
    setConnected(rt.room, playerId, false);
    if (!rt.room.players.some((p) => p.connected)) rt.emptySince = now();
    if (rt.room.hostId === playerId && !rt.hostTimer) {
      rt.hostTimer = setTimeout(() => {
        rt.hostTimer = undefined;
        const host = rt.room.players.find((p) => p.id === rt.room.hostId);
        if (host && !host.connected && transferHost(rt.room)) this.changed(rt);
      }, HOST_GRACE_MS);
    }
    this.changed(rt);
  }

  /* ---------- interne ---------- */

  private dropRemoved(rt: Runtime, before: Set<string>): void {
    const present = new Set(rt.room.players.map((p) => p.id));
    for (const id of before) {
      if (present.has(id)) continue;
      const sid = rt.sockets.get(id);
      if (sid) this.emit(sid, 'closed');
      rt.sockets.delete(id);
      rt.tokens.delete(id);
    }
  }

  private changed(rt: Runtime): void {
    const { room } = rt;
    if (room.phase === 'ended' && rt.endedAt === null) rt.endedAt = now();
    this.schedule(rt);
    this.broadcast(rt);
  }

  private broadcast(rt: Runtime): void {
    for (const p of rt.room.players) {
      const sid = rt.sockets.get(p.id);
      if (sid) this.emit(sid, 'state', viewFor(rt.room, p.id));
    }
  }

  private clearTimers(rt: Runtime): void {
    if (rt.timer) clearTimeout(rt.timer);
    if (rt.hostTimer) clearTimeout(rt.hostTimer);
    rt.timer = undefined;
    rt.hostTimer = undefined;
  }

  private schedule(rt: Runtime): void {
    if (rt.timer) clearTimeout(rt.timer);
    rt.timer = undefined;
    const { room } = rt;
    if (room.phase === 'answer' && room.round?.deadline) {
      const delay = Math.max(0, room.round.deadline - now()) + GRACE_MS;
      rt.timer = setTimeout(() => {
        rt.timer = undefined;
        forceEndAnswer(room);
        this.changed(rt);
      }, delay);
    } else if (room.phase === 'between' && room.betweenDeadline) {
      const delay = Math.max(0, room.betweenDeadline - now());
      rt.timer = setTimeout(() => {
        rt.timer = undefined;
        autoAgain(room);
        this.changed(rt);
      }, delay);
    }
    if (rt.timer) rt.timer.unref?.();
  }

  private destroy(code: string): void {
    const rt = this.rooms.get(code);
    if (!rt) return;
    this.clearTimers(rt);
    for (const sid of rt.sockets.values()) this.emit(sid, 'closed');
    this.rooms.delete(code);
  }

  private sweep(): void {
    const t = now();
    for (const [code, rt] of this.rooms) {
      const tooOld = t - rt.room.created > MAX_ROOM_AGE_MS;
      const abandoned = rt.emptySince !== null && t - rt.emptySince > EMPTY_ROOM_MS;
      const finished = rt.endedAt !== null && t - rt.endedAt > ENDED_ROOM_MS;
      if (tooOld || abandoned || finished) this.destroy(code);
    }
  }
}

function normalize(code: string): string {
  return String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
