import { Monitor, Moon, SlidersHorizontal, Sun, X } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { LEVEL_NAMES, MIN_AGE, type PlayerInit, type Sex, type View } from '../shared/types';
import { canVibrate, setPrefs, sound, usePrefs, type Theme } from './fx';
import { loadProfile, saveProfile } from './storage';

/* ------------------------------------------------------------------ */
/* Petits éléments partagés                                            */
/* ------------------------------------------------------------------ */

/** Monogramme sur papier : une seule couleur d'accent dans toute l'interface. */
export function Avatar({ name, host, online, size }: { name: string; host?: boolean; online?: boolean; size?: number }) {
  const letter = [...name.trim()][0] ?? '?';
  return (
    <span
      className={'avatar' + (host ? ' host' : '')}
      style={size ? ({ '--av': `${size}px` } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {letter}
      {online !== undefined && <span className={'dot' + (online ? '' : ' off')} />}
    </span>
  );
}

/** QR code du lien d'invitation (généré ici, rien n'est envoyé nulle part). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const svg = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch {
      return '';
    }
  }, [value]);
  if (!svg) return null;
  return <div className="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ------------------------------------------------------------------ */
/* Préférences d'affichage : thème, sons, vibrations                   */
/* ------------------------------------------------------------------ */

const THEMES: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: 'auto', label: 'Auto', Icon: Monitor },
  { id: 'dark', label: 'Sombre', Icon: Moon },
  { id: 'light', label: 'Clair', Icon: Sun },
];

function PrefsMenu() {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="prefs-wrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="prefs-btn"
        aria-label="Affichage, sons et vibrations"
        aria-expanded={open}
        aria-controls={uid}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="prefs" id={uid} role="group" aria-label="Préférences d’affichage">
          <div className="field">
            <span className="lab">Thème</span>
            <div className="seg">
              {THEMES.map(({ id, label, Icon }) => (
                <button key={id} type="button" aria-pressed={prefs.theme === id} onClick={() => setPrefs({ theme: id })}>
                  <Icon size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.sound}
              onChange={(e) => {
                setPrefs({ sound: e.target.checked });
                if (e.target.checked) sound('seal');
              }}
            />
            <span>
              Sons
              <small className="muted">Le ruban qui se décolle, le tampon.</small>
            </span>
          </label>
          {canVibrate && (
            <label className="check">
              <input type="checkbox" checked={prefs.haptics} onChange={(e) => setPrefs({ haptics: e.target.checked })} />
              <span>
                Vibrations
                <small className="muted">Un léger retour sous le doigt.</small>
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coque commune : en-tête, bannière, bouton quitter                    */
/* ------------------------------------------------------------------ */

export function Shell({
  view,
  banner,
  onQuit,
  quitLabel = 'Quitter',
  children,
}: {
  view: View | null;
  banner?: string;
  onQuit?: () => void;
  quitLabel?: string;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <main className="app">
      <header className="top">
        <div className="brand" aria-label="Tacle ou Vérité">
          Tacle <span>ou</span> Vérité
        </div>
        <div className="top-right">
          {view && view.phase !== 'lobby' && (
            <div className="badges">
              <span className="badge">{LEVEL_NAMES[view.settings.level]}</span>
            </div>
          )}
          <PrefsMenu />
          {onQuit &&
            (confirming ? (
              <span className="confirm">
                <button type="button" className="mini danger" onClick={onQuit}>
                  Oui, {quitLabel.toLowerCase()}
                </button>
                <button type="button" className="mini" onClick={() => setConfirming(false)}>
                  Non
                </button>
              </span>
            ) : (
              <button type="button" className="mini" onClick={() => setConfirming(true)}>
                {quitLabel}
              </button>
            ))}
        </div>
      </header>
      {banner && (
        <p className="banner" role="status">
          {banner}
        </p>
      )}
      {children}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaire joueur : prénom, sexe, âge (et code du salon si besoin)  */
/* ------------------------------------------------------------------ */

export function ProfileForm({
  submitLabel,
  onSubmit,
  withCode = false,
  initialCode = '',
  persist = false,
}: {
  submitLabel: string;
  /** Retourne un message d'erreur, ou null/'' si tout s'est bien passé. */
  onSubmit: (init: PlayerInit, code: string) => Promise<string | null> | string | null;
  withCode?: boolean;
  initialCode?: string;
  /** Prérempli depuis le navigateur et mémorisé (mode salon en ligne). */
  persist?: boolean;
}) {
  const uid = useId();
  const saved = persist ? loadProfile() : { name: '', sex: 'F' as Sex, age: '' };
  const [name, setName] = useState(saved.name);
  const [sex, setSex] = useState<Sex>(saved.sex);
  const [age, setAge] = useState(saved.age);
  const [code, setCode] = useState(initialCode);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const parsed = parseInt(age, 10);
    const init: PlayerInit = { name: name.trim(), sex, age: Number.isNaN(parsed) ? NaN : parsed };
    const error = await onSubmit(init, code);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setErr('');
    if (persist) saveProfile({ name: init.name, sex, age });
    if (!persist) {
      setName('');
      setAge('');
    }
  }

  return (
    <form className="stack" onSubmit={submit} autoComplete="off">
      {withCode && (
        <div className="field">
          <label htmlFor={uid + 'code'}>Code du salon</label>
          <input
            id={uid + 'code'}
            className="code-input"
            value={code}
            maxLength={8}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
      )}
      <div className="formrow">
        <div className="field">
          <label htmlFor={uid + 'name'}>Vrai prénom</label>
          <input id={uid + 'name'} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={uid + 'sex'}>Sexe</label>
          <select id={uid + 'sex'} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="F">Fille</option>
            <option value="M">Garçon</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={uid + 'age'}>Âge</label>
          <input
            id={uid + 'age'}
            type="number"
            inputMode="numeric"
            min={MIN_AGE}
            max={99}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
      </div>
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
      <button type="submit" className="btn primary" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}

export function PlayerList({
  view,
  onRemove,
  showOffline = false,
}: {
  view: View;
  onRemove?: (id: string) => void;
  showOffline?: boolean;
}) {
  return (
    <ul className="plist">
      {view.players.map((p) => (
        <li className="prow" key={p.id}>
          <Avatar name={p.name} host={p.isHost} online={showOffline ? p.connected : undefined} />
          <span className="nm">{p.name}</span>
          {p.isHost && (
            <span className="tag host">{view.players.length === 2 ? 'Hôte' : 'Maître'}</span>
          )}
          {showOffline && !p.connected && <span className="tag">Hors ligne</span>}
          {onRemove && !p.isHost && (
            <button type="button" className="iconbtn" aria-label={`Retirer ${p.name}`} onClick={() => onRemove(p.id)}>
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
