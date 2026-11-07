/**
 * Mode « salon en ligne » : chaque joueur est sur son téléphone, le serveur fait foi.
 * La session (code, identifiant, jeton) est gardée dans l'onglet pour revenir
 * automatiquement dans le salon après une coupure réseau ou un rechargement.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Action, PlayerInit, Result, View } from '../shared/types';
import { clearSession, loadSession, saveSession } from './storage';

export type Status = 'connecting' | 'online' | 'offline';

interface JoinResult extends Result {
  code?: string;
  playerId?: string;
  token?: string;
}

export function useOnline() {
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const resume = () => {
      const session = loadSession();
      if (!session) return;
      socket.timeout(8000).emit('room:resume', session, (err: Error | null, res: JoinResult) => {
        if (err) return; // le serveur ne répond pas : on réessaiera à la prochaine connexion
        if (!res?.ok) {
          clearSession();
          setView(null);
          setNotice('Ta partie n’existe plus ou tu en as été retiré(e).');
        }
      });
    };

    socket.on('connect', () => {
      setStatus('online');
      resume();
    });
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', () => setStatus('offline'));
    socket.on('state', (v: View) => {
      setOffset(v.serverNow - Date.now());
      setView(v);
    });
    socket.on('closed', () => {
      clearSession();
      setView(null);
      setNotice('Tu n’es plus dans ce salon.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emit = useCallback(<T extends Result>(event: string, payload: unknown): Promise<T> => {
    return new Promise((resolve) => {
      const s = socketRef.current;
      if (!s || !s.connected) {
        resolve({ ok: false, error: 'Pas de connexion au serveur. Patiente un instant.' } as T);
        return;
      }
      s.timeout(8000).emit(event, payload, (err: Error | null, res: T) => {
        resolve(err ? ({ ok: false, error: 'Le serveur ne répond pas.' } as T) : res);
      });
    });
  }, []);

  const remember = (res: JoinResult): Result => {
    if (res.ok && res.code && res.playerId && res.token) {
      saveSession({ code: res.code, playerId: res.playerId, token: res.token });
      setNotice('');
    }
    return { ok: res.ok, error: res.error };
  };

  const create = useCallback(
    async (init: PlayerInit): Promise<Result> => remember(await emit<JoinResult>('room:create', init)),
    [emit],
  );

  const join = useCallback(
    async (code: string, init: PlayerInit): Promise<Result> =>
      remember(await emit<JoinResult>('room:join', { ...init, code })),
    [emit],
  );

  const send = useCallback((action: Action): Promise<Result> => emit<Result>('act', action), [emit]);

  const leave = useCallback(async () => {
    await emit<Result>('room:leave', {});
    clearSession();
    setView(null);
  }, [emit]);

  return { view, status, offset, notice, setNotice, create, join, send, leave };
}
