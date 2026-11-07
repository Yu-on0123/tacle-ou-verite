import { useState } from 'react';
import { useLocal } from './useLocal';
import {
  AnswerScreen,
  BetweenScreen,
  EndScreen,
  MenuScreen,
  ModeStatus,
  PassScreen,
  RevealScreen,
  SettingsPanel,
} from './screens';
import { GuideButton } from './Guide';
import { PlayerList, ProfileForm, Shell } from './ui';

export function LocalGame({ onExit }: { onExit: () => void }) {
  const L = useLocal();
  const { view } = L;
  const [startErr, setStartErr] = useState('');

  if (!view || view.phase === 'lobby') {
    const count = view?.players.length ?? 0;
    return (
      <Shell view={null} onQuit={onExit} quitLabel="Accueil">
        <section className="panel">
          <div>
            <p className="eyebrow">Un seul téléphone</p>
            <h1>Qui joue ce soir ?</h1>
          </div>
          <ProfileForm
            submitLabel="Ajouter ce joueur"
            onSubmit={(init) => L.addLocal(init)}
          />
          {view && (
            <>
              <PlayerList view={view} onRemove={L.removeLocal} />
              <button type="button" className="btn" onClick={L.reset}>
                Vider la liste
              </button>
            </>
          )}
        </section>
        {view && (
          <section className="panel">
            <SettingsPanel view={view} send={L.send} online={false} />
            <ModeStatus view={view} />
            <GuideButton label="Comment ça marche ? Lire le guide" />
            {count < 2 && (
              <p className="muted">
                Ajoute au moins deux joueurs. Le premier ajouté garde le téléphone pour dévoiler les cartes.
              </p>
            )}
            {startErr && (
              <p className="err" role="alert">
                {startErr}
              </p>
            )}
            <button
              type="button"
              className="btn primary block"
              disabled={count < 2}
              onClick={async () => {
                const r = await L.send({ type: 'open-menu' });
                setStartErr(r.ok ? '' : (r.error ?? ''));
              }}
            >
              Lancer la partie
            </button>
            <p className="muted small">
              Rien n’est enregistré : tout disparaît quand tu fermes la page.
            </p>
          </section>
        )}
      </Shell>
    );
  }

  const props = { view, send: L.send, offset: 0, local: true };
  let body;
  switch (view.phase) {
    case 'menu':
      body = <MenuScreen {...props} />;
      break;
    case 'answer':
      body =
        L.step === 'play' ? (
          <AnswerScreen {...props} />
        ) : (
          <PassScreen
            title="Passe le téléphone à"
            name={L.passName}
            note={view.players.length === 2 ? 'L’autre détourne les yeux.' : 'Les autres détournent les yeux.'}
            button={`C’est moi, ${L.passName}`}
            onGo={L.startTurn}
          />
        );
      break;
    case 'reveal':
      body =
        L.step === 'passback' ? (
          <PassScreen
            title="Rends le téléphone à"
            name={L.passName}
            note={
              view.game === 'tacle' || view.game === 'ding'
                ? 'On lit les réponses ensemble.'
                : 'On regarde la carte ensemble.'
            }
            button="Continuer"
            onGo={L.revealStart}
          />
        ) : (
          <RevealScreen {...props} />
        );
      break;
    case 'between':
      body = <BetweenScreen {...props} />;
      break;
    default:
      body = <EndScreen view={view} onExit={onExit} />;
  }
  return (
    <Shell view={view} onQuit={onExit} quitLabel="Quitter">
      {body}
    </Shell>
  );
}
