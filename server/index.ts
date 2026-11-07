import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import { RoomManager } from './rooms';
import type { Action, PlayerInit } from '../shared/types';

const PORT = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
// En production, le serveur compilé (dist/server.js) est à côté du dossier dist/web.
const webDir = path.join(here, 'web');

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10_000,
  pingTimeout: 15_000,
  maxHttpBufferSize: 20_000,
});

const manager = new RoomManager((socketId, event, payload) => {
  io.to(socketId).emit(event, payload);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: manager.count() });
});

if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use(
    '/assets',
    express.static(path.join(webDir, 'assets'), { maxAge: '365d', immutable: true }),
  );
  app.use(express.static(webDir, { maxAge: '10m', index: false }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(webDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text').send('Serveur de salons actif. En développement, ouvre l’interface sur http://localhost:5173');
  });
}

/* ---------- Socket.IO ---------- */

type Ack = (res: unknown) => void;
interface Session {
  code: string;
  playerId: string;
}

function asInit(v: unknown): PlayerInit {
  const o = (v ?? {}) as Record<string, unknown>;
  return { name: String(o.name ?? ''), sex: o.sex as PlayerInit['sex'], age: Number(o.age) };
}

function safeAck(ack: unknown): Ack {
  return typeof ack === 'function' ? (ack as Ack) : () => undefined;
}

io.on('connection', (socket: Socket) => {
  let session: Session | null = null;
  let windowStart = Date.now();
  let count = 0;

  /** Anti-abus : au plus 40 messages par tranche de 10 secondes et par connexion. */
  const allowed = (): boolean => {
    const t = Date.now();
    if (t - windowStart > 10_000) {
      windowStart = t;
      count = 0;
    }
    return ++count <= 40;
  };

  const attach = (res: { code: string; playerId: string; token: string }, ack: Ack) => {
    session = { code: res.code, playerId: res.playerId };
    ack({ ok: true, ...res });
  };

  socket.on('room:create', (init: unknown, ack: unknown) => {
    const reply = safeAck(ack);
    if (!allowed()) return reply({ ok: false, error: 'Trop de requêtes, patiente un instant.' });
    if (session) manager.disconnect(session.code, session.playerId, socket.id);
    const res = manager.create(asInit(init), socket.id);
    if ('error' in res) return reply({ ok: false, error: res.error });
    attach(res, reply);
  });

  socket.on('room:join', (payload: unknown, ack: unknown) => {
    const reply = safeAck(ack);
    if (!allowed()) return reply({ ok: false, error: 'Trop de requêtes, patiente un instant.' });
    const o = (payload ?? {}) as Record<string, unknown>;
    const res = manager.join(String(o.code ?? ''), asInit(o), socket.id);
    if ('error' in res) return reply({ ok: false, error: res.error });
    attach(res, reply);
  });

  socket.on('room:resume', (payload: unknown, ack: unknown) => {
    const reply = safeAck(ack);
    if (!allowed()) return reply({ ok: false, error: 'Trop de requêtes, patiente un instant.' });
    const o = (payload ?? {}) as Record<string, unknown>;
    const res = manager.resume(String(o.code ?? ''), String(o.playerId ?? ''), String(o.token ?? ''), socket.id);
    if ('error' in res) return reply({ ok: false, error: res.error });
    attach(res, reply);
  });

  socket.on('act', (action: unknown, ack: unknown) => {
    const reply = safeAck(ack);
    if (!session) return reply({ ok: false, error: 'Tu n’es dans aucun salon.' });
    if (!allowed()) return reply({ ok: false, error: 'Trop de requêtes, patiente un instant.' });
    if (!action || typeof action !== 'object' || typeof (action as Action).type !== 'string') {
      return reply({ ok: false, error: 'Action invalide.' });
    }
    const error = manager.act(session.code, session.playerId, action as Action);
    reply(error ? { ok: false, error } : { ok: true });
  });

  socket.on('room:leave', (_payload: unknown, ack: unknown) => {
    const reply = safeAck(ack);
    if (session) manager.leave(session.code, session.playerId);
    session = null;
    reply({ ok: true });
  });

  socket.on('disconnect', () => {
    if (session) manager.disconnect(session.code, session.playerId, socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tacle ou Vérité : serveur prêt sur le port ${PORT}`);
});

function shutdown(): void {
  manager.stop();
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
