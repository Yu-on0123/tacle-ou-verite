import { useEffect, useRef, useState } from 'react';
import { GAME_GUIDES, GAME_ORDER, GENERAL_GUIDE, type GameGuide, type GuideFocus } from './guides';

function GameBody({ g }: { g: GameGuide }) {
  return (
    <div className="stack">
      <p className="lead">{g.tagline}</p>
      {g.needs && <p className="notice">{g.needs}</p>}
      <div>
        <h3 className="ghead">Comment ça se joue</h3>
        <ol className="gsteps">
          {g.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
      {g.tips.length > 0 && (
        <div>
          <h3 className="ghead">À savoir</h3>
          <ul className="gtips">
            {g.tips.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Fenêtre de guide : le guide général (avec tous les jeux) ou la fiche d'un seul jeu. */
export function GuideSheet({ focus, onClose }: { focus: GuideFocus; onClose: () => void }) {
  const [view, setView] = useState<GuideFocus>(focus);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [view]);

  const game = view === 'general' ? null : GAME_GUIDES[view];

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="face guide" ref={bodyRef}>
        <div className="guide-head">
          <div>
            <p className="eyebrow">{game ? 'Règles du jeu' : 'Guide'}</p>
            <h2 id="guide-title">{game ? game.title : 'Comment ça marche'}</h2>
          </div>
          <button type="button" className="mini" ref={closeRef} onClick={onClose}>
            Fermer
          </button>
        </div>

        {game ? (
          <>
            <GameBody g={game} />
            <button type="button" className="btn" onClick={() => setView('general')}>
              Voir le guide général
            </button>
          </>
        ) : (
          <div className="stack">
            <p className="lead">{GENERAL_GUIDE.intro}</p>
            {GENERAL_GUIDE.sections.map((s) => (
              <section key={s.title}>
                <h3 className="ghead">{s.title}</h3>
                <ul className="gtips">
                  {s.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </section>
            ))}
            <section>
              <h3 className="ghead">Les jeux</h3>
              <div className="gamelinks">
                {GAME_ORDER.map((id) => (
                  <button key={id} type="button" className="btn" onClick={() => setView(id)}>
                    {GAME_GUIDES[id].title}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Bouton + fenêtre de guide.
 * - variant « btn » : bouton pleine largeur (« Comment ça marche ? ») ;
 * - variant « icon » : petit « ? » à côté d'un jeu, pour lire ses règles avant de le lancer.
 */
export function GuideButton({
  focus = 'general',
  variant = 'btn',
  label = 'Comment ça marche ?',
}: {
  focus?: GuideFocus;
  variant?: 'btn' | 'icon';
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const title = focus === 'general' ? 'le jeu' : GAME_GUIDES[focus].title;
  return (
    <>
      {variant === 'icon' ? (
        <button type="button" className="rules" aria-label={`Règles : ${title}`} onClick={() => setOpen(true)}>
          <span aria-hidden="true">?</span>
        </button>
      ) : (
        <button type="button" className="btn block" onClick={() => setOpen(true)}>
          {label}
        </button>
      )}
      {open && <GuideSheet focus={focus} onClose={() => setOpen(false)} />}
    </>
  );
}
