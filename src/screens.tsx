/**
 * Écrans de jeu, communs au mode « un téléphone » et au mode « salon en ligne ».
 * Chaque écran reçoit une `View` (ce que CE joueur a le droit de voir) et une
 * fonction `send` pour agir. Aucune règle du jeu n'est décidée ici.
 */
import {
  Check,
  CircleHelp,
  Droplet,
  Flag,
  Flame,
  Lock,
  Mail,
  Megaphone,
  MessagesSquare,
  Swords,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import {
  COMPOSITION_NAMES,
  LEVEL_NAMES,
  type Action,
  type DefiTag,
  type GameKind,
  type Level,
  type Result,
  type Settings,
  type View,
} from '../shared/types';
import { haptic, sound } from './fx';
import { GuideButton } from './Guide';
import type { GameGuideId } from './guides';
import { useSecondsLeft } from './hooks';
import { Avatar } from './ui';

/** Contexte d’affichage : évite les phrases absurdes (groupe à 2, mineurs inexistants…). */
function isCouple(view: View): boolean {
  return view.players.length === 2;
}
function hostLabel(view: View): string {
  return isCouple(view) ? 'Hôte' : 'Maître de la partie';
}

export type Send = (a: Action) => Promise<Result>;

export interface ScreenProps {
  view: View;
  send: Send;
  offset: number;
  /** true quand un seul téléphone passe de main en main. */
  local: boolean;
}

/* ------------------------------------------------------------------ */
/* Petits outils                                                       */
/* ------------------------------------------------------------------ */

function useRunner(send: Send) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (a: Action): Promise<boolean> => {
    setBusy(true);
    const r = await send(a);
    setBusy(false);
    setErr(r.ok ? '' : (r.error ?? 'Une erreur est survenue.'));
    return r.ok;
  };
  return { err, setErr, busy, run };
}

export function Timer({
  deadline,
  offset,
  seconds,
  total,
}: {
  deadline: number | null;
  offset: number;
  seconds?: boolean;
  /** Durée totale en secondes : si fournie, le chrono s'affiche en anneau qui se vide. */
  total?: number;
}) {
  const left = useSecondsLeft(deadline, offset);
  // Les 5 dernières secondes : un petit « tic » (vibration / son, si activés)
  useEffect(() => {
    if (!seconds && left != null && left > 0 && left <= 5) {
      haptic('tick');
      sound('tick');
    }
  }, [left, seconds]);
  if (left == null) return null;
  const text = seconds ? String(left) : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const low = !seconds && left <= 10;
  if (!seconds && total && total > 0) {
    const frac = Math.min(1, Math.max(0, left / total));
    return (
      <span className={'timer ring' + (low ? ' low' : '')} role="timer">
        <svg viewBox="0 0 56 56" aria-hidden="true">
          <circle className="trk" cx="28" cy="28" r="24" />
          <circle className="bar-ring" cx="28" cy="28" r="24" style={{ '--p': frac } as CSSProperties} />
        </svg>
        <span>{text}</span>
      </span>
    );
  }
  return (
    <span className={'timer' + (low ? ' low' : '')} role="timer">
      {text}
    </span>
  );
}

const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

function ErrorLine({ text }: { text: string }) {
  return text ? (
    <p className="err" role="alert">
      {text}
    </p>
  ) : null;
}

function Waiting({ title, text }: { title: string; text: string }) {
  return (
    <section className="center" role="status">
      <p className="eyebrow live">{title}</p>
      <p className="lead">{text}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

const SECONDS = [60, 120, 180, 300, 600];

/** Plus aucun bandeau de mode : chacun découvre ses limites en jouant, discrètement. */
export function ModeStatus(_props: { view: View }) {
  return null;
}

export function SettingsPanel({ view, send, online }: { view: View; send: Send; online: boolean }) {
  const s = view.settings;
  const set = (patch: Partial<Settings>) => void send({ type: 'settings', patch });
  return (
    <div className="stack">
      <div className="field">
        <span className="lab">Niveau</span>
        <div className="seg">
          {LEVEL_NAMES.map((name, i) => (
            <button key={name} type="button" aria-pressed={s.level === i} onClick={() => set({ level: i as Level })}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">
        Groupe détecté : <b>{COMPOSITION_NAMES[s.composition]}</b>. Les cartes s’adaptent toutes seules.
      </p>
      <div className="field">
        <label htmlFor="secs">Durée maximale pour répondre</label>
        <select id="secs" value={s.answerSeconds} onChange={(e) => set({ answerSeconds: Number(e.target.value) })}>
          {SECONDS.map((v) => (
            <option key={v} value={v}>
              {v / 60} min
            </option>
          ))}
        </select>
      </div>
      {online && (
        <label className="check">
          <input type="checkbox" checked={s.together} onChange={(e) => set({ together: e.target.checked })} />
          <span>Nous sommes dans la même pièce (défis en face-à-face, Jacques a dit)</span>
        </label>
      )}
      {s.together && (
        <label className="check">
          <input type="checkbox" checked={s.aovVoice} onChange={(e) => set({ aovVoice: e.target.checked })} />
          <span>
            Les vérités se répondent à voix haute
            <small className="muted"> Rien n’est écrit : on lit la carte, on répond de vive voix.</small>
          </span>
        </label>
      )}
      {!s.together && (
        <label className="check">
          <input type="checkbox" checked={s.deferred} onChange={(e) => set({ deferred: e.target.checked })} />
          <span>
            Inclure les défis « bon pour plus tard »
            <small className="muted"> Recommandé pour 2 ou 3 joueurs qui se reverront.</small>
          </span>
        </label>
      )}
      {view.duo && (
        <div className="field">
          <span className="lab">Ambiance des cartes</span>
          <div className="radios">
            <label>
              <input
                type="radio"
                name="duo"
                checked={s.duoMode === 'ado'}
                onChange={() => set({ duoMode: 'ado' })}
              />
              Tout public
            </label>
            <label>
              <input
                type="radio"
                name="duo"
                checked={s.duoMode === 'adult'}
                onChange={() => set({ duoMode: 'adult' })}
              />
              Osée
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsSummary({ view }: { view: View }) {
  const parts = [
    COMPOSITION_NAMES[view.settings.composition],
    `niveau ${LEVEL_NAMES[view.settings.level]}`,
    `réponses ${view.settings.answerSeconds / 60} min`,
  ].filter(Boolean);
  return <p className="muted">{parts.join(' · ')}</p>;
}

/* ------------------------------------------------------------------ */
/* Carnet des dettes                                                   */
/* ------------------------------------------------------------------ */

export function Debts({ view }: { view: View }) {
  if (view.debts.length === 0) return null;
  return (
    <section className="panel">
      <p className="eyebrow">Carnet des dettes</p>
      <ul className="debts">
        {view.debts.map((d, i) => (
          <li key={i}>
            <strong>{d.who}</strong>
            <span>{d.text}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">À honorer à votre prochaine rencontre.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Menu des jeux                                                       */
/* ------------------------------------------------------------------ */

function guideId(kind: GameKind, variant?: 0 | 1): GameGuideId {
  return kind === 'tacle' ? (variant === 0 ? 'tacle-0' : 'tacle-1') : (kind as GameGuideId);
}

type Game = {
  kind: GameKind;
  variant?: 0 | 1;
  title: string;
  text: string;
  locked?: string;
  Icon: LucideIcon;
  group: 'write' | 'live';
};

function gameCatalog(view: View): Game[] {
  const playerCount = view.players.length;
  const couple = playerCount === 2;
  return [
    {
      kind: 'tacle',
      variant: 1,
      Icon: Mail,
      group: 'write',
      title: 'Je ne te l’ai jamais dit mais…',
      text: couple
        ? 'Tu complètes la phrase. Vous lisez tout ensemble.'
        : 'Tu complètes la phrase pour la personne de ton choix. Personne ne saura qui l’a écrite.',
    },
    {
      kind: 'tacle',
      variant: 0,
      Icon: Swords,
      group: 'write',
      title: 'Moi au moins…',
      text: couple
        ? 'Tu complètes la phrase pour le tacler. Vous lisez tout ensemble.'
        : 'Tu complètes la phrase pour tacler quelqu’un. Personne ne saura qui l’a écrite.',
    },
    {
      kind: 'ding',
      Icon: MessagesSquare,
      group: 'write',
      title: 'Dingueries',
      text: couple
        ? 'Une question chacun, des réponses cash. Vous lisez tout ensemble.'
        : 'Une question chacun, des réponses sans nom. Parfois un sondage : tout le monde vote en même temps, et le classement tombe.',
    },
    {
      kind: 'defi',
      Icon: Flame,
      group: 'live',
      title: 'Défis',
      text: 'Un défi, un joueur. Tout de suite, ou à rattraper plus tard.',
    },
    {
      kind: 'aov',
      Icon: CircleHelp,
      group: 'live',
      title: 'Action ou Vérité',
      text: couple
        ? 'À tour de rôle : action ou vérité, au choix. Pas d’échappatoire.'
        : 'Action ou vérité : le joueur choisit, le groupe regarde.',
    },
    {
      kind: 'cap',
      Icon: Flag,
      group: 'live',
      title: 'Cap ou Pas Cap',
      text: 'Cap ou pas cap ? Tu le fais, ou tu passes.',
    },
    {
      kind: 'jacques',
      Icon: Megaphone,
      group: 'live',
      title: 'Jacques a dit',
      text: 'Un ordre pour tous. Obéis seulement s’il commence par « Jacques a dit ».',
      locked:
        playerCount < 3
          ? 'À partir de 3 joueurs'
          : !view.settings.together
            ? 'Active « même pièce » dans les réglages'
            : undefined,
    },
  ];
}

export function MenuScreen({ view, send, local }: ScreenProps) {
  const { err, busy, run } = useRunner(send);
  const [showSettings, setShowSettings] = useState(false);
  const host = view.me.isHost;
  return (
    <>
      <section className="panel">
        <p className="eyebrow">{hostLabel(view)} : {view.players.find((p) => p.isHost)?.name}</p>
        <h1>{host ? 'Choisis un jeu' : `${hostLabel(view)} choisit le jeu`}</h1>
        {!host && <SettingsSummary view={view} />}
        <GuideButton label="Comment ça marche ? Lire le guide" />
      </section>
      {host ? (
        <>
          <div className="gamegroups">
            {(['write', 'live'] as const).map((group) => (
              <div className="gamelist" key={group}>
                <p className="eyebrow group-label">{group === 'write' ? 'À écrire' : 'À jouer en direct'}</p>
                {gameCatalog(view)
                  .filter((g) => g.group === group)
                  .map((g) => (
                    <div className="gameitem" key={g.kind + String(g.variant ?? '')}>
                      <button
                        type="button"
                        className="gamebtn"
                        disabled={busy || !!g.locked}
                        onClick={() => void run({ type: 'choose', game: g.kind, variant: g.variant })}
                      >
                        <span className="gi" aria-hidden="true">
                          {g.locked ? <Lock size={20} /> : <g.Icon size={22} />}
                        </span>
                        <b>{g.title}</b>
                        <span>{g.locked ?? g.text}</span>
                      </button>
                      <GuideButton variant="icon" focus={guideId(g.kind, g.variant)} />
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <ErrorLine text={err} />
          <section className="panel">
            <button type="button" className="btn" aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}>
              {showSettings ? 'Masquer les réglages' : 'Réglages'}
            </button>
            {showSettings && <SettingsPanel view={view} send={send} online={!local} />}
          </section>
        </>
      ) : (
        <Waiting title="En attente" text={`${hostLabel(view)} va lancer un jeu.`} />
      )}
      <Debts view={view} />
      {host && (
        <button type="button" className="btn" onClick={() => void run({ type: 'end' })}>
          Terminer la partie
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Phase de réponse                                                    */
/* ------------------------------------------------------------------ */

function AnswerHead({ view, offset, local }: ScreenProps) {
  return (
    <div className="turnbar">
      <div>
        <p className="eyebrow">{local ? 'Tour de' : 'À toi de jouer'}</p>
        <h2>{view.me.name}</h2>
      </div>
      <Timer deadline={view.deadline} offset={offset} total={view.settings.answerSeconds} />
    </div>
  );
}

function Finished({ view }: { view: View }) {
  const a = view.answer!;
  const wait =
    isCouple(view)
      ? a.doneCount >= a.total
        ? 'C’est bon, on dévoile…'
        : 'En attente de l’autre personne…'
      : `En attente des autres : ${a.doneCount} sur ${a.total} ont fini.`;
  return <Waiting title="C’est envoyé" text={wait} />;
}

function TacleSheet({
  name,
  prefix,
  canAdult,
  adultHint,
  onClose,
  onSend,
}: {
  name: string;
  prefix: string;
  canAdult: boolean;
  adultHint: string;
  onClose: () => void;
  onSend: (text: string, adult: boolean) => Promise<string>;
}) {
  const [text, setText] = useState('');
  const [adult, setAdult] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sealed, setSealed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const face = useRef<HTMLFormElement>(null);
  const closeTimer = useRef<number>();

  // Focus : on entre dans la feuille, on le rend à la carte à la fermeture ; le fond ne défile pas.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    area.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      window.clearTimeout(closeTimer.current);
      opener?.focus?.();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const error = await onSend(text, adult);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    // Le tampon « Scellé » se pose, puis la feuille se ferme
    setSealed(true);
    haptic('seal');
    sound('seal');
    closeTimer.current = window.setTimeout(onClose, 700);
  }

  // Échap ferme ; Tab reste dans la feuille
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!sealed) onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = face.current?.querySelectorAll<HTMLElement>('textarea, input, button:not(:disabled)');
    if (!f || f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`Carte de ${name}`} onKeyDown={onKeyDown}>
      <form ref={face} className={'face flipin' + (sealed ? ' sealed' : '')} onSubmit={submit}>
        <div className="center-text">
          <p className="eyebrow">Pour</p>
          <div className="target">{name}</div>
        </div>
        <div className="phrase">
          <label htmlFor="msg" className="lead-in">
            {prefix}
          </label>
          <textarea
            id="msg"
            ref={area}
            value={text}
            maxLength={400}
            rows={4}
            onChange={(e) => setText(e.target.value)}
          />
          <span className="count" aria-hidden="true">
            {text.length}/400
          </span>
        </div>
        {canAdult && (
          <label className="check">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>{adultHint}</span>
          </label>
        )}
        <ErrorLine text={err} />
        <div className="btn-row">
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn primary" disabled={busy || sealed}>
            Envoyer
          </button>
        </div>
        {sealed && (
          <>
            <p className="stamp" aria-hidden="true">
              Scellé
            </p>
            <p className="sr" role="status">
              Message scellé et envoyé.
            </p>
          </>
        )}
      </form>
    </div>
  );
}

function TacleAnswer(props: ScreenProps) {
  const { view, send } = props;
  const a = view.answer!;
  const [open, setOpen] = useState<string | null>(null);
  const { err, busy, run } = useRunner(send);
  const targets = a.targets ?? [];
  const cols = Math.min(4, Math.max(2, Math.ceil(targets.length / 2)));
  const current = targets.find((t) => t.id === open);

  if (a.done) return <Finished view={view} />;

  return (
    <>
      <section className="panel">
        <AnswerHead {...props} />
        <p className="muted">{a.prefix ? `« ${a.prefix} » Choisis le nom de quelqu’un, retourne sa carte, complète la phrase.` : 'Retourne une carte et complète la phrase.'} Tu peux en jouer autant que tu veux.</p>
        <div className="cardgrid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              className="card"
              disabled={t.sent}
              data-state={t.sent ? 'sent' : undefined}
              aria-label={`Carte de ${t.name}${t.sent ? ' (envoyée)' : ''}`}
              onClick={() => setOpen(t.id)}
            >
              <span className="label">{t.name}</span>
              {t.sent && (
                <span className="chk" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        <ErrorLine text={err} />
        <button type="button" className="btn primary block" disabled={busy} onClick={() => void run({ type: 'done' })}>
          J’ai fini d’écrire
        </button>
      </section>
      {current && (
        <TacleSheet
          key={current.id}
          name={current.name}
          prefix={a.prefix ?? 'Moi au moins…'}
          canAdult={!!a.canAdult}
          adultHint="Version osée"
          onClose={() => setOpen(null)}
          onSend={async (text, adult) => {
            const r = await send({ type: 'tacle:send', targetId: current.id, prefix: 0, text, adult });
            return r.ok ? '' : (r.error ?? 'Envoi impossible.');
          }}
        />
      )}
    </>
  );
}

function DingAnswer(props: ScreenProps) {
  const { view, send } = props;
  const a = view.answer!;
  const [text, setText] = useState('');
  const { err, busy, run } = useRunner(send);
  if (a.done) return <Finished view={view} />;
  return (
    <section className="panel">
      <AnswerHead {...props} />
      <div className="qcard">
        <p className="eyebrow">Ta question</p>
        <h2>{a.question}</h2>
      </div>
      <label className="sr" htmlFor="ans">
        Ta réponse
      </label>
      <textarea
        id="ans"
        value={text}
        maxLength={500}
        placeholder={view.players.length === 2 ? "Écris ta réponse…" : "Réponds sans filtre, ton nom restera caché"}
        onChange={(e) => setText(e.target.value)}
      />
      <ErrorLine text={err} />
      <button
        type="button"
        className="btn primary block"
        disabled={busy}
        onClick={() => void run({ type: 'ding:answer', text })}
      >
        Envoyer ma réponse
      </button>
    </section>
  );
}

function VoteAnswer(props: ScreenProps) {
  const { view, send } = props;
  const a = view.answer!;
  const [sel, setSel] = useState<string | null>(null);
  const { err, busy, run } = useRunner(send);
  if (a.done) return <Finished view={view} />;
  return (
    <section className="panel">
      <AnswerHead {...props} />
      <div>
        <p className="eyebrow">Sondage</p>
        <h2>{a.question}</h2>
      </div>
      <div className="namegrid">
        {(a.targets ?? []).map((t) => (
          <button
            key={t.id}
            type="button"
            className="namecard"
            aria-pressed={sel === t.id}
            onClick={() => setSel(sel === t.id ? null : t.id)}
          >
            <Avatar name={t.name} size={32} />
            <span className="nm">{t.name}</span>
            <Check className="tick" size={18} strokeWidth={3} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="muted small">
        {view.players.length === 2
          ? 'On ne vote pas pour soi-même.'
          : 'Ton vote reste secret. On ne vote pas pour soi-même.'}
      </p>
      <ErrorLine text={err} />
      <button
        type="button"
        className="btn primary block"
        disabled={busy || !sel}
        onClick={() => sel && void run({ type: 'vote:cast', targetId: sel })}
      >
        Confirmer mon vote
      </button>
    </section>
  );
}

function AovAnswer(props: ScreenProps) {
  const { view, send } = props;
  const a = view.answer!;
  const { err, busy, run } = useRunner(send);
  const [text, setText] = useState('');

  if (!a.soloMe) {
    const wait = a.aovAnswer
      ? `${a.soloWho ?? 'Un joueur'} répond à sa vérité…`
      : `${a.soloWho ?? 'Un joueur'} choisit Action ou Vérité…`;
    return <Waiting title="Action ou Vérité" text={wait} />;
  }

  // Réponse à une vérité
  if (a.aovAnswer) {
    return (
      <section className="panel">
        <p className="eyebrow">Ta vérité</p>
        <h2>{a.question}</h2>
        <p className="muted small">
          {isCouple(view)
            ? 'L’autre verra ta question et ta réponse.'
            : 'Tout le monde verra la question et ta réponse.'}
        </p>
        <textarea
          value={text}
          maxLength={500}
          placeholder="Ta réponse…"
          onChange={(e) => setText(e.target.value)}
        />
        <ErrorLine text={err} />
        <button
          type="button"
          className="btn primary block"
          disabled={busy}
          onClick={() => void run({ type: 'aov:answer', text })}
        >
          Envoyer ma réponse
        </button>
      </section>
    );
  }

  if (!a.aovChoice) {
    return <Waiting title="Action ou Vérité" text="Préparation de ta carte…" />;
  }

  return (
    <section className="panel">
      <p className="eyebrow">C’est ton tour</p>
      <h2>Action ou Vérité ?</h2>
      <p className="muted">
        {isCouple(view)
          ? 'L’autre verra toujours ta carte (et ta réponse si tu choisis Vérité).'
          : 'Tout le monde verra ta carte (et ta réponse si tu choisis Vérité).'}
      </p>
      <ErrorLine text={err} />
      <div className="gamelist">
        <button
          type="button"
          className="gamebtn"
          disabled={busy}
          onClick={() => void run({ type: 'aov:choose', choice: 'verite' })}
        >
          <span className="gi" aria-hidden="true">
            <CircleHelp size={22} />
          </span>
          <b>Vérité</b>
          <span>Tu réponds à une question ; la réponse est partagée.</span>
        </button>
        <button
          type="button"
          className="gamebtn"
          disabled={busy}
          onClick={() => void run({ type: 'aov:choose', choice: 'action' })}
        >
          <span className="gi" aria-hidden="true">
            <Zap size={22} />
          </span>
          <b>Action</b>
          <span>{isCouple(view) ? 'Tu relèves un défi ; l’autre le voit.' : 'Tu relèves un défi ; tout le monde le voit.'}</span>
        </button>
      </div>
    </section>
  );
}

export function AnswerScreen(props: ScreenProps) {
  const game = props.view.answer?.game;
  if (game === 'tacle') return <TacleAnswer {...props} />;
  if (game === 'ding') return props.view.answer?.pollVote ? <VoteAnswer {...props} /> : <DingAnswer {...props} />;
  if (game === 'aov') return <AovAnswer {...props} />;
  return null;
}

/* ------------------------------------------------------------------ */
/* Dépouillement                                                       */
/* ------------------------------------------------------------------ */

const TAG_LABEL: Record<DefiTag, string> = {
  now: 'À faire tout de suite',
  physical: 'En face-à-face',
  later: 'Bon pour plus tard',
};

function RevealBody({ view }: { view: View }) {
  const item = view.reveal?.item;
  if (!item) return null;
  if (item.kind === 'masked') {
    return (
      <div className="rcard">
        <h2>Carte réservée aux adultes</h2>
        <p className="muted">Elle reste cachée pour toi. On passe à la suivante.</p>
      </div>
    );
  }
  if (item.kind === 'tacle') {
    return (
      <div className="rcard">
        <span className="eyebrow">Pour</span>
        <div className="target">{item.target}</div>
        <p className="msg">
          <span className="pre">{item.prefix}</span> {item.text}
        </p>
      </div>
    );
  }
  if (item.kind === 'ding') {
    return (
      <div className="rcard">
        <span className="eyebrow">Question</span>
        <h2>{item.q}</h2>
        <div className="answer">
          <span className="eyebrow">{view.players.length === 2 ? 'Réponse' : 'Réponse anonyme'}</span>
          <p className="msg">{item.text}</p>
        </div>
      </div>
    );
  }
  if (item.kind === 'poll') {
    return (
      <div className="rcard">
        <span className="eyebrow">Sondage</span>
        <h2>{item.q}</h2>
        <div className="ranks">
          {item.ranks.map((r, i) =>
            r.shown ? (
              <div className="rank" key={i}>
                <span className="pos">{ordinal(r.pos)}</span>
                <span className="nm">
                  {r.names.join(' et ')}
                  {r.names.length > 1 && <span className="tag"> ex æquo</span>}
                </span>
                <span className="pts">
                  {r.votes}/{item.voters} {r.votes > 1 ? 'votes' : 'vote'}
                </span>
                <span className="bar">
                  <i style={{ width: `${Math.round((r.votes / Math.max(1, item.voters)) * 100)}%` }} />
                </span>
              </div>
            ) : (
              <div className="rank hid" key={i}>
                <span className="pos">{ordinal(r.pos)}</span>
                <span className="nm">• • •</span>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }
  if (item.kind === 'jacques') {
    return (
      <div className="rcard">
        <span className="eyebrow">Jacques a dit</span>
        <div className="target">{item.who}</div>
        <p className="msg">{item.text}</p>
      </div>
    );
  }
  if (item.kind === 'aov') {
    const wa =
      item.media
        ? `https://wa.me/?text=${encodeURIComponent(`Action pour ${item.who} : ${item.text}`)}`
        : null;
    return (
      <div className="rcard">
        <span className="eyebrow">{item.choice === 'verite' ? 'Vérité' : 'Action'}</span>
        <div className="target">{item.who}</div>
        {item.tag && <span className="tag">{TAG_LABEL[item.tag]}</span>}
        {item.choice === 'verite' ? (
          <>
            <p className="msg">{item.text}</p>
            <div className="answer">
              <span className="eyebrow">Réponse</span>
              <p className="msg">{item.answer ?? 'À répondre à voix haute.'}</p>
            </div>
          </>
        ) : (
          <>
            <p className="msg">{item.text}</p>
            {item.tag === 'later' && (
              <p className="muted small">À faire la prochaine fois en face-à-face. {isCouple(view) ? 'L’autre a vu le défi.' : 'Tout le monde a vu le défi.'}</p>
            )}
            {wa && (
              <div className="answer">
                <p>
                  <strong>Preuve demandée.</strong>{' '}
                  {isCouple(view) ? 'Envoyez la preuve sur WhatsApp.' : 'Envoyez la preuve sur votre groupe WhatsApp.'}
                </p>
                <a className="btn" href={wa} target="_blank" rel="noopener noreferrer">
                  Ouvrir WhatsApp
                </a>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
  if (item.kind === 'cap') {
    const wa = item.media
      ? `https://wa.me/?text=${encodeURIComponent(`Cap pour ${item.who} : ${item.text}`)}`
      : null;
    return (
      <div className="rcard">
        <span className="eyebrow">Cap ou Pas Cap</span>
        <div className="target">{item.who}</div>
        <span className="tag">{TAG_LABEL[item.tag]}</span>
        <p className="msg">{item.text}</p>
        {item.accepted === true && <p className="muted">→ Cap ! On relève le défi.</p>}
        {item.accepted === false && <p className="muted">→ Pas Cap. On passe.</p>}
        {wa && item.accepted !== false && (
          <div className="answer">
            <p>
              <strong>Preuve demandée.</strong> {isCouple(view) ? 'Envoyez la preuve sur WhatsApp.' : 'Envoyez la preuve sur votre groupe WhatsApp.'}
            </p>
            <a className="btn" href={wa} target="_blank" rel="noopener noreferrer">
              Ouvrir WhatsApp
            </a>
          </div>
        )}
      </div>
    );
  }
  // defi
  const wa = `https://wa.me/?text=${encodeURIComponent(`Défi pour ${item.who} : ${item.text}`)}`;
  return (
    <div className="rcard">
      <span className="eyebrow">Défi pour</span>
      <div className="target">{item.who}</div>
      <span className="tag">{TAG_LABEL[item.tag]}</span>
      <p className="msg">{item.text}</p>
      {item.media && (
        <div className="answer">
          <p>
            <strong>Preuve demandée.</strong> {isCouple(view) ? 'Envoyez la preuve sur WhatsApp.' : 'Envoyez la preuve sur votre groupe WhatsApp.'} Rien n’est stocké ici.
          </p>
          <a className="btn" href={wa} target="_blank" rel="noopener noreferrer">
            Ouvrir WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

export function RevealScreen(props: ScreenProps) {
  const { view, send } = props;
  const rv = view.reveal!;
  const { err, busy, run } = useRunner(send);
  const [leaving, setLeaving] = useState(false);

  // Le moment fort : au décollage du ruban, un retour tactile et sonore (si activés)
  const itemKind = rv.item?.kind;
  useEffect(() => {
    if (rv.gate || !itemKind || itemKind === 'masked' || itemKind === 'poll') return;
    const id = window.setTimeout(() => {
      haptic('peel');
      sound('peel');
    }, 260);
    return () => window.clearTimeout(id);
  }, [rv.index, rv.gate, itemKind]);

  // Les cartes qui restent forment une pile sous celle qu'on lit
  const remaining = rv.game === 'tacle' || rv.game === 'ding' ? Math.max(0, rv.total - rv.index - 1) : 0;

  const next = async () => {
    setLeaving(true);
    await new Promise((r) => setTimeout(r, 240));
    await run({ type: 'reveal:next' });
    setLeaving(false);
  };

  if (rv.gate) {
    return (
      <section className="panel">
        <p className="eyebrow">
          {rv.index + 1} / {rv.total}
        </p>
        <h2>Carte sensible</h2>
        <p className="muted">
          Éloigne l’écran de <strong>{rv.gate.minors.join(', ')}</strong> avant de l’afficher.
        </p>
        <ErrorLine text={err} />
        {rv.isHost && (
          <div className="btn-row">
            <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'reveal:next' })}>
              Passer cette carte
            </button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'reveal:gate' })}>
              Afficher la carte
            </button>
          </div>
        )}
      </section>
    );
  }

  const item = rv.item;
  const soloLabel =
    rv.game === 'defi'
      ? 'Défi'
      : rv.game === 'aov'
        ? 'Action ou Vérité'
        : rv.game === 'cap'
          ? 'Cap ou Pas Cap'
          : rv.game === 'jacques'
            ? 'Jacques a dit'
            : `${rv.index + 1} / ${rv.total}`;

  return (
    <>
      <p className="progress">{soloLabel}</p>
      <div className="stage">
        <div className={'rstack' + (leaving ? ' leaving' : '')} data-depth={Math.min(2, remaining)} key={rv.index}>
          <RevealBody view={view} />
        </div>
      </div>
      <ErrorLine text={err} />
      {rv.game === 'defi' && item?.kind === 'defi' ? (
        rv.canResolve ? (
          <div className="btn-row">
            <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'skip' })}>
              Passer
            </button>
            {item.tag === 'later' ? (
              <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'later' })}>
                Noter pour plus tard
              </button>
            ) : (
              <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'done' })}>
                {item.media ? 'Preuve envoyée' : 'C’est fait'}
              </button>
            )}
          </div>
        ) : (
          <p className="muted center-text">{isCouple(view) ? `${item.who} relève le défi.` : `Tout le monde voit le défi. ${item.who} s’y colle.`}</p>
        )
      ) : rv.game === 'cap' && item?.kind === 'cap' && item.accepted === undefined ? (
        rv.canResolve ? (
          <div className="btn-row">
            <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'cap:result', result: 'pascap' })}>
              Pas Cap
            </button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'cap:result', result: 'cap' })}>
              Cap !
            </button>
          </div>
        ) : (
          <p className="muted center-text">Cap ou pas cap ? La réponse arrive…</p>
        )
      ) : rv.game === 'cap' && item?.kind === 'cap' && item.accepted === true ? (
        rv.canResolve ? (
          <div className="btn-row">
            <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'skip' })}>
              Abandonner
            </button>
            {rv.canLater && item.tag === 'later' ? (
              <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'later' })}>
                Noter pour plus tard
              </button>
            ) : (
              <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'done' })}>
                C’est fait
              </button>
            )}
          </div>
        ) : (
          <p className="muted center-text">Cap accepté — réalisation en cours.</p>
        )
      ) : rv.game === 'jacques' ? (
        rv.canResolve ? (
          <button type="button" className="btn primary block" disabled={busy} onClick={() => void run({ type: 'jacques:done' })}>
            C’est fait
          </button>
        ) : (
          <p className="muted center-text">{isCouple(view) ? 'L’ordre est visible.' : 'Ordre visible pour tout le monde.'}</p>
        )
      ) : rv.game === 'aov' && item?.kind === 'aov' ? (
        rv.canResolve ? (
          item.choice === 'verite' ? (
            <button type="button" className="btn primary block" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'done' })}>
              Continuer
            </button>
          ) : (
            <div className="btn-row">
              {item.tag === 'later' && rv.canLater ? (
                <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'later' })}>
                  Noter pour plus tard
                </button>
              ) : null}
              <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'defi:result', result: 'done' })}>
                {item.tag === 'later' ? 'OK, on continue' : item.media ? 'Preuve envoyée' : 'C’est fait'}
              </button>
            </div>
          )
        ) : (
          <p className="muted center-text">
            {item.choice === 'verite'
              ? isCouple(view)
                ? 'La question est posée : réponds de vive voix ou lis la réponse.'
                : 'Question et réponse visibles pour tout le monde.'
              : isCouple(view)
                ? `${item.who} doit réaliser l’action.`
                : `${item.who} doit réaliser l’action (tout le monde l’a vue).`}
          </p>
        )
      ) : rv.game === 'tacle' || rv.game === 'ding' ? (
        rv.isHost ? (
          item?.kind === 'poll' && item.ranks.some((r) => !r.shown) ? (
            <button type="button" className="btn primary block" disabled={busy} onClick={() => void run({ type: 'reveal:next' })}>
              {item.ranks.every((r) => !r.shown) ? 'Dévoiler le classement' : 'Dévoiler la suite'}
            </button>
          ) : (
            <button type="button" className="btn primary block" disabled={busy || leaving} onClick={() => void next()}>
              Suivant
            </button>
          )
        ) : (
          <p className="muted center-text">{hostLabel(view)} fait défiler les cartes.</p>
        )
      ) : rv.isHost ? (
        <button type="button" className="btn primary block" disabled={busy || leaving} onClick={() => void next()}>
          Suivant
        </button>
      ) : (
        <p className="muted center-text">{hostLabel(view)} continue.</p>
      )}
    </>
  );
}

export function BetweenScreen({ view, send, offset }: ScreenProps) {
  const { err, busy, run } = useRunner(send);
  const host = view.me.isHost;
  if (view.dry) {
    return (
      <>
        <section className="center">
          <div className="emblem" aria-hidden="true">
            <Droplet size={28} />
          </div>
          <p className="eyebrow">Plus rien à dire</p>
          <h1>Le flux de vérités s’est tari.</h1>
          <p className="muted">Personne n’a visé personne pendant ce tour.</p>
        </section>
        <ErrorLine text={err} />
        {host ? (
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'again' })}>
              Relancer un tour
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'menu' })}>
              Changer de jeu
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'end' })}>
              Terminer la partie
            </button>
          </div>
        ) : (
          <p className="muted center-text">{hostLabel(view)} décide de la suite.</p>
        )}
      </>
    );
  }
  return (
    <>
      <section className="center">
        <p className="eyebrow">
          {view.game === 'tacle' || view.game === 'ding'
            ? 'Fin du tour'
            : 'Tour terminé'}
        </p>
        <h1>
          Prochain tour dans <Timer deadline={view.deadline} offset={offset} seconds />
        </h1>
      </section>
      <Debts view={view} />
      <ErrorLine text={err} />
      {host ? (
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: 'again' })}>
            Nouveau tour
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'menu' })}>
            Changer de jeu
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void run({ type: 'end' })}>
            Terminer
          </button>
        </div>
      ) : (
        <p className="muted center-text">{hostLabel(view)} décide de la suite.</p>
      )}
    </>
  );
}

export function EndScreen({ view, onExit }: { view: View; onExit: () => void }) {
  const title =
    view.endReason === 'tari'
      ? 'Le flux de vérités s’est tari.'
      : view.endReason === 'alone'
        ? 'Il ne reste pas assez de joueurs.'
        : 'Fin de la partie';
  // Le tampon tombe : la promesse « rien n'est enregistré » devient un geste visible
  useEffect(() => {
    const id = window.setTimeout(() => {
      haptic('seal');
      sound('seal');
    }, 880);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <>
      <section className="center endcard">
        <div className="envelope erased">
          <p className="eyebrow">{view.endReason === 'tari' ? 'Plus rien à dire' : 'Merci d’avoir joué'}</p>
          <h1>{title}</h1>
          <p className="muted">Tout est effacé. Rien n’est conservé.</p>
          <p className="stamp" aria-hidden="true">
            Effacé
          </p>
        </div>
      </section>
      <Debts view={view} />
      <button type="button" className="btn primary block" onClick={onExit}>
        Retour à l’accueil
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cartes « passe le téléphone » (mode un téléphone)                    */
/* ------------------------------------------------------------------ */

export function PassScreen({
  title,
  name,
  note,
  button,
  onGo,
}: {
  title: string;
  name: string;
  note: string;
  button: string;
  onGo: () => void;
}) {
  return (
    <section className="center pass">
      <div className="envelope">
        <Lock size={20} aria-hidden="true" style={{ color: 'var(--ink-accent)' }} />
        <p className="eyebrow">{title}</p>
        <div className="big-name">{name}</div>
      </div>
      <p className="muted">{note}</p>
      <button type="button" className="btn primary block" onClick={onGo}>
        {button}
      </button>
    </section>
  );
}
