import { Lock, Smartphone, Users } from 'lucide-react';
import { useState } from 'react';
import { LocalGame } from './LocalGame';
import { OnlineGame } from './OnlineGame';
import { loadSession } from './storage';
import { GuideButton } from './Guide';
import { Shell } from './ui';

type Mode = 'home' | 'local' | 'online';

function readCode(): string {
  try {
    return (new URLSearchParams(location.search).get('salon') ?? '').toUpperCase().slice(0, 8);
  } catch {
    return '';
  }
}

function clearUrl(): void {
  try {
    history.replaceState(null, '', location.pathname);
  } catch {
    /* ignoré */
  }
}

/** Trois enveloppes scellées : on touche un ruban pour le décoller et lire un exemple. */
const SEALS = [
  { id: 's1', label: 'Pour toi', pre: 'Je ne te l’ai jamais dit mais…', text: 'ton rire change complètement ma journée.' },
  { id: 's2', label: 'Pour eux', pre: 'Moi au moins…', text: 'je ne regarde pas mon téléphone pendant que quelqu’un me parle.' },
  { id: 's3', label: 'Pour nous', pre: 'Cap ou pas cap ?', text: 'Écrire ce que tu préfères chez la personne à ta gauche, et le lire à voix haute.' },
] as const;

function SealDemo() {
  const [open, setOpen] = useState<string | null>(null);
  const cur = SEALS.find((x) => x.id === open);
  return (
    <>
      <div className="seals">
        {SEALS.map((x) => (
          <button
            key={x.id}
            type="button"
            className={'seal ' + x.id}
            aria-pressed={open === x.id}
            aria-label={`${x.label} : ${open === x.id ? 'refermer l’exemple' : 'décoller le ruban pour lire un exemple'}`}
            onClick={() => setOpen(open === x.id ? null : x.id)}
          >
            <i aria-hidden="true">{x.label}</i>
          </button>
        ))}
      </div>
      {cur ? (
        <p className="seal-cap paper" key={cur.id} role="status">
          <span className="pre">{cur.pre}</span>
          {cur.text}
        </p>
      ) : (
        <p className="seal-cap idle">Touche un ruban pour le décoller.</p>
      )}
    </>
  );
}

export default function App() {
  const [initialCode] = useState(readCode);
  const [mode, setMode] = useState<Mode>(() => (initialCode || loadSession() ? 'online' : 'home'));

  const exit = () => {
    clearUrl();
    setMode('home');
  };

  if (mode === 'local') return <LocalGame onExit={exit} />;
  if (mode === 'online') return <OnlineGame initialCode={initialCode} onExit={exit} />;

  return (
    <Shell view={null}>
      <section className="hero">
        <SealDemo />
        <p className="eyebrow">Pour couples et groupes d’amis</p>
        <h1>
          Dis ce que tu n’as <span className="hl">jamais osé</span> dire.
        </h1>
        <p className="lead">
          Tacles, confessions, vérités, défis : tu choisis le niveau, personne ne se défile. En groupe, l’auteur d’un
          message reste secret. À deux, on se regarde dans les yeux.
        </p>
      </section>
      <div className="gamelist">
        <button type="button" className="gamebtn mode" onClick={() => setMode('local')}>
          <span className="gi" aria-hidden="true">
            <Smartphone size={26} />
          </span>
          <b>Un seul téléphone</b>
          <span>Vous êtes ensemble : il passe de main en main.</span>
        </button>
        <button type="button" className="gamebtn mode" onClick={() => setMode('online')}>
          <span className="gi" aria-hidden="true">
            <Users size={26} />
          </span>
          <b>Salon en ligne</b>
          <span>Chacun son téléphone, à distance ou dans la même pièce. Un code suffit pour rejoindre.</span>
        </button>
      </div>
      <ol className="steps" aria-label="Comment ça marche">
        <li>Choisis un jeu et un niveau.</li>
        <li>Écris sans te cacher, ton nom reste secret.</li>
        <li>Le ruban se décolle, tout le monde lit.</li>
      </ol>
      <GuideButton label="Comment ça marche ? Lire le guide" />
      <p className="privacy">
        <Lock size={16} aria-hidden="true" />
        Rien n’est enregistré : à la fin, tout s’efface.
      </p>
    </Shell>
  );
}
