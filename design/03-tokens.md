# 03 — Tokens

Fichiers : `src/styles/tokens.css` (tokens), `base.css`, `components.css`, `game.css`, `guide.css`, `motion.css`, assemblés par `src/styles.css`. Thème : sombre par défaut ; clair via `prefers-color-scheme` ou `data-theme="light"` ; forçage sombre via `data-theme="dark"`. Choix manuel dans le menu d'affichage (clé `tov-prefs`).

| Rôle | Sombre | Clair |
|---|---|---|
| `--bg` / `--surface` / `--surface-raised` | #0b0a09 / #161411 / #1e1b17 | #f6f2ea / #ffffff / #fbf8f2 |
| `--text` / `--text-muted` / `--text-subtle` | #f4efe6 / #aaa397 / #8c857a | #17130e / #5a5347 / #655e51 |
| `--accent` (ruban) / `--accent-ink` (texte accent) | #ffb224 / #ffc24d | #f4a300 / #8a5a00 |
| `--danger` / `--success` / `--info` | #ff6b5a / #4ade80 / #5eead4 | #c73a27 / #15803d / #0f766e |
| Papier `--paper` / `--ink` / `--ink-muted` / `--ink-accent` | #f3ebda / #1b160d / #594e3b / #7a4f00 | #fffcf3 / idem / idem / idem |

- **Typo** : Bricolage Grotesque (titres, 700–800) + DM Sans (texte), variables, **auto-hébergées** via `@fontsource-variable` (plus de Google Fonts). Échelle `--fs-xs … --fs-3xl`.
- **Espacement** base 4 (`--sp-1…7`) ; **rayons** 10 / 14 / 20 / pilule.
- **Motion** : `--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-sheet`, `--ease-stamp` (léger rebond) ; durées 120 / 150 / 200 / 300 / 500 ms. Retour au toucher `scale(.97–.98)`.
- **Profondeur** : `--shadow-paper` (reflet + arête + ombre portée), `--shadow-key` (touche ambre).
- **Papier** : la classe `.paper` (et `.rcard`, `.qcard`, `.envelope`, `.sheet .face`) **réécrit les tokens** (`--text`, `--border`, `--accent-ink`…) pour que tout enfant reste lisible sur fond crème.
- **Z** : prefs 40, feuille 70, toast 80.
