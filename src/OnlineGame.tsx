import { Check, Copy, QrCode as QrIcon, Share2 } from 'lucide-react';
import { useState } from 'react';
import type { View } from '../shared/types';
import { copyText } from './hooks';
import {
  AnswerScreen,
  BetweenScreen,
  EndScreen,
  MenuScreen,
  ModeStatus,
  RevealScreen,
  SettingsPanel,
  SettingsSummary,
  type Send,
} from './screens';
import { GuideButton } from './Guide';
import { PlayerList, ProfileForm, QrCode, Shell } from './ui';
import { useOnline, type Status } from './useOnline';

function statusBanner(status: Status, inRoom: boolean): string {
  if (status === 'online') return '';
  if (status === 'connecting') return 'Connexion au serveur… Le premier démarrage peut prendre une minute.';
  return inRoom ? 'Connexion perdue. Reconnexion en cours : ta place est gardée.' : 'Serveur injoignable, nouvelle tentative…';
}

function Lobby({ view, send }: { view: View; send: Send }) {
  const [copied, setCopied] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [err, setErr] = useState('');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const host = view.me.isHost;
  const link = `${location.origin}/?salon=${view.code}`;

  async function copy() {
    const ok = await copyText(link);
    setCopied(ok ? 'Lien copié.' : 'Copie impossible : sélectionne le lien à la main.');
    setTimeout(() => setCopied(''), 3000);
  }

  async function share() {
    try {
      await navigator.share({ title: 'Tacle ou Vérité', text: `Rejoins mon salon : ${view.code}`, url: link });
    } catch {
      /* annulé par l’utilisateur : rien à faire */
    }
  }

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Code du salon</p>
        <div className="codetiles" role="img" aria-label={`Code ${view.code.split('').join(' ')}`}>
          {view.code.split('').map((c, i) => (
            <span key={i} aria-hidden="true">
              {c}
            </span>
          ))}
        </div>
        <div className="share-row">
          {canShare && (
            <button type="button" className="btn primary" onClick={() => void share()}>
              <Share2 size={18} aria-hidden="true" />
              Inviter
            </button>
          )}
          <button type="button" className="btn" onClick={() => void copy()}>
            {copied.startsWith('Lien copié') ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            Copier le lien
          </button>
          <button type="button" className="btn" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
            <QrIcon size={18} aria-hidden="true" />
            QR code
          </button>
        </div>
        {showQr && <QrCode value={link} label={`QR code du salon ${view.code}`} />}
        <div className="linkrow">
          <input readOnly value={link} aria-label="Lien d’invitation" onFocus={(e) => e.currentTarget.select()} />
        </div>
        <p className="muted small" role="status">
          {copied}
        </p>
        <p className="muted small">Partage le lien ou le code. Chacun entre son prénom et rejoint la partie.</p>
      </section>
      <section className="panel">
        <p className="eyebrow">Joueurs ({view.players.length})</p>
        <PlayerList
          view={view}
          showOffline
          onRemove={host ? (id) => void send({ type: 'kick', playerId: id }) : undefined}
        />
      </section>
      <section className="panel">
        {host ? (
          <>
            <SettingsPanel view={view} send={send} online />
            <ModeStatus view={view} />
            {err && (
              <p className="err" role="alert">
                {err}
              </p>
            )}
            <button
              type="button"
              className="btn primary block"
              disabled={view.players.length < 2}
              onClick={async () => {
                const r = await send({ type: 'open-menu' });
                setErr(r.ok ? '' : (r.error ?? ''));
              }}
            >
              {view.players.length < 2 ? 'Il faut au moins 2 joueurs' : 'Choisir un jeu'}
            </button>
          </>
        ) : (
          <>
            <SettingsSummary view={view} />
            <p className="lead">En attente du lancement…</p>
          </>
        )}
        <GuideButton label="Comment ça marche ? Lire le guide" />
      </section>
    </>
  );
}

function OnlineHome({
  initialCode,
  notice,
  onCreate,
  onJoin,
  onBack,
  banner,
}: {
  initialCode: string;
  notice: string;
  onCreate: (init: Parameters<ReturnType<typeof useOnline>['create']>[0]) => Promise<string | null>;
  onJoin: (code: string, init: Parameters<ReturnType<typeof useOnline>['create']>[0]) => Promise<string | null>;
  onBack: () => void;
  banner: string;
}) {
  const [tab, setTab] = useState<'create' | 'join'>(initialCode ? 'join' : 'create');
  return (
    <Shell view={null} banner={banner} onQuit={onBack} quitLabel="Accueil">
      <section className="panel">
        <div>
          <p className="eyebrow">Salon en ligne</p>
          <h1>{tab === 'create' ? 'Créer un salon' : 'Rejoindre un salon'}</h1>
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <div className="seg two" role="tablist" aria-label="Choix">
          <button type="button" role="tab" aria-selected={tab === 'create'} aria-pressed={tab === 'create'} onClick={() => setTab('create')}>
            Créer
          </button>
          <button type="button" role="tab" aria-selected={tab === 'join'} aria-pressed={tab === 'join'} onClick={() => setTab('join')}>
            Rejoindre
          </button>
        </div>
        {tab === 'create' ? (
          <ProfileForm key="create" persist submitLabel="Créer le salon" onSubmit={(init) => onCreate(init)} />
        ) : (
          <ProfileForm
            key="join"
            persist
            withCode
            initialCode={initialCode}
            submitLabel="Rejoindre"
            onSubmit={(init, code) => onJoin(code, init)}
          />
        )}
        <p className="muted small">Celui qui crée le salon mène la partie. Rien n’est enregistré.</p>
        <GuideButton label="Comment ça marche ? Lire le guide" />
      </section>
    </Shell>
  );
}

export function OnlineGame({ initialCode, onExit }: { initialCode: string; onExit: () => void }) {
  const O = useOnline();
  const { view } = O;
  const banner = statusBanner(O.status, !!view);

  const quit = async () => {
    await O.leave();
    onExit();
  };

  if (!view) {
    return (
      <OnlineHome
        initialCode={initialCode}
        notice={O.notice}
        banner={banner}
        onBack={onExit}
        onCreate={async (init) => {
          const r = await O.create(init);
          return r.ok ? null : (r.error ?? 'Impossible de créer le salon. Réessaie.');
        }}
        onJoin={async (code, init) => {
          const r = await O.join(code, init);
          return r.ok ? null : (r.error ?? 'Impossible de rejoindre ce salon. Vérifie le code.');
        }}
      />
    );
  }

  const props = { view, send: O.send, offset: O.offset, local: false };
  let body;
  switch (view.phase) {
    case 'lobby':
      body = <Lobby view={view} send={O.send} />;
      break;
    case 'menu':
      body = <MenuScreen {...props} />;
      break;
    case 'answer':
      body = <AnswerScreen {...props} />;
      break;
    case 'reveal':
      body = <RevealScreen {...props} />;
      break;
    case 'between':
      body = <BetweenScreen {...props} />;
      break;
    default:
      body = <EndScreen view={view} onExit={() => void quit()} />;
  }
  return (
    <Shell view={view} banner={banner} onQuit={() => void quit()} quitLabel="Quitter">
      {body}
    </Shell>
  );
}
