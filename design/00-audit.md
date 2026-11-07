# 00 — Audit

**Produit** : Tacle ou Vérité, jeu de défis, tacles et confessions pour couples et groupes d'amis, dans le navigateur (PWA). Aucun stockage de partie.

**Stack** : React 18 + Vite 5 + TypeScript, CSS pur (`src/styles.css`, pas de Tailwind), serveur Express + Socket.IO (`server/`), moteur partagé (`shared/engine.ts`). Pas de shadcn/ui, pas de bibliothèque d'icônes. Polices Google Fonts (Syne + DM Sans).

**Écrans** (tous dans `src/screens.tsx`, orchestrés par `LocalGame.tsx` / `OnlineGame.tsx`)
| Écran | Fichier | Données |
|---|---|---|
| Accueil (choix un téléphone / salon) | `App.tsx` | aucune |
| Création / jonction de salon, profil | `OnlineGame.tsx`, `ui.tsx` (`ProfileForm`) | socket `create` / `join` |
| Salon d'attente (code, lien, joueurs, réglages) | `OnlineGame.tsx`, `screens.tsx` (`SettingsPanel`) | `View` |
| Menu des jeux | `screens.tsx` `MenuScreen` | `view.players`, `view.settings` |
| Réponse : tacles (cartes), dingueries, vote, action ou vérité | `AnswerScreen` + variantes | `view.answer` |
| Dépouillement, classement | `RevealScreen`, `VoteReveal` | `view.reveal` |
| Entre deux jeux, fin, passage de téléphone | `BetweenScreen`, `EndScreen`, `PassScreen` | `view` |

**Existant visuel** : thème sombre or/teal, glassmorphism (`backdrop-filter` partout), bruit SVG plein écran, titre d'accueil en dégradé de texte, boutons en dégradé. Mode clair via `prefers-color-scheme`. Aucun bascule manuelle.

**Points faibles constatés**
1. **Classes sans styles** : `.plist`, `.prow`, `.cardgrid`, `.formrow`, `.linkrow`, `.big-code`, `.big-name`, `.iconbtn`, `.code-input`, `.seg.two` sont utilisées dans le JSX mais absentes du CSS (le CSS définissait `.players` et `.cards`). Liste des joueurs, grille de cartes, code du salon et formulaire de profil n'avaient donc pas leur mise en page.
2. **Champs sans style** : les sélecteurs `input[type='text']` ne ciblent pas les `<input>` sans attribut `type` (prénom, code, lien).
3. **Survols collants sur mobile** : `:hover` actif au toucher (jeu 100 % mobile).
4. Cibles tactiles < 44 px (boutons `.mini` 36 px, cases à cocher 18 px).
5. Effets coûteux sur mobile : `backdrop-filter` sur chaque panneau, calque de bruit plein écran.
6. Rendu « générique » : dégradé sur le titre, double dégradé or sur les boutons, aucune signature liée au concept (secret, anonymat, dévoilement).
7. Pas de `:focus-visible` global ; focus des champs seulement par bordure.
8. Hiérarchie plate sur le menu des jeux (cartes identiques sans repère).

**Contrats à préserver** (non modifiés) : messages socket (`create`, `join`, `choose`, `settings`, `reveal:next`, `defi:result`, `cap:result`, `jacques:done`, `kick`, `end`), `id` des champs (`msg`, `secs`, ids générés par `useId`), `aria-*`, noms de classes (toutes conservées), textes et clés `localStorage` (`storage.ts`), route `?salon=CODE`, `shared/*`, `server/*`.

---

## Addendum — 2ᵉ passe (6 nov. 2026)

**Point de départ** : version à jour fournie le 6 nov. (ajoute les guides : `src/Guide.tsx`, `src/guides.ts`, boutons « ? » dans le menu). La refonte « Scellé » v1 n'était plus dans le code livré : elle est reconstruite ici et poussée plus loin.

**Constats de la v1 (CSS monolithique de 1 400 lignes)**
1. Les cartes et le dépouillement restaient des surfaces sombres : l'objet « message » n'avait pas de présence physique.
2. Aucun retour sensoriel (vibration, son) alors que le jeu se joue sur téléphone, à plusieurs.
3. Polices chargées depuis Google Fonts : non mises en cache hors ligne par le service worker, dépendance externe.
4. Feuille d'écriture sans `Escape`, sans piège de focus, sans retour de focus ; envoi sans moment « fort ».
5. Pas de bascule de thème manuelle ; `prefers-reduced-motion` coupait tout (`animation: none`).
6. Pas d'icônes (menu de 7 jeux sans repère visuel), pas de partage natif ni de QR code dans le salon.
7. `apple-touch-icon` et icônes PNG absents du manifest (installation Android incertaine).

**Contraintes de compatibilité retenues** : public visé = Android d'entrée de gamme. Donc pas de `light-dark()`, de `color-mix()`, de `backdrop-filter` ni d'animation de `filter`/`box-shadow`. Animations sur `transform` et `opacity` uniquement.

**Contrats préservés** : messages socket, `shared/*`, `server/*`, ids (`msg`, `secs`, `useId`), classes existantes, clés `localStorage`/`sessionStorage` (`tov-profile`, `tov-session`), route `?salon=CODE`, props publiques. Seul changement de flux UI : la feuille d'écriture se ferme elle-même 700 ms après l'envoi (le temps du tampon) au lieu de se fermer immédiatement ; l'action `tacle:send` est inchangée.
