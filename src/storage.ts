/**
 * Petites commodités gardées dans le navigateur de chaque joueur (jamais envoyées au serveur) :
 *  - le profil (prénom, sexe, âge) pour ne pas tout retaper ;
 *  - la session du salon en cours, pour revenir après une coupure réseau.
 * Tout est entouré de try/catch : en navigation privée, le stockage peut être indisponible.
 */
import type { Sex } from '../shared/types';

export interface Profile {
  name: string;
  sex: Sex;
  age: string;
}

export interface Session {
  code: string;
  playerId: string;
  token: string;
}

const PROFILE_KEY = 'tov-profile';
const SESSION_KEY = 'tov-session';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      return {
        name: typeof p.name === 'string' ? p.name : '',
        sex: p.sex === 'M' ? 'M' : 'F',
        age: typeof p.age === 'string' ? p.age : '',
      };
    }
  } catch {
    /* stockage indisponible */
  }
  return { name: '', sex: 'F', age: '' };
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible */
  }
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Session>;
      if (s.code && s.playerId && s.token) return s as Session;
    }
  } catch {
    /* stockage indisponible */
  }
  return null;
}

export function saveSession(s: Session): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible */
  }
}
