# Changelog design

**Modifiés**
- `src/styles.css` — réécrit : tokens light/dark, composants, signature « ruban », cohérence avec les classes du JSX (9 classes jusque-là sans style).
- `src/App.tsx` — ajout du bloc décoratif `.seals` (aria-hidden) sur l'accueil. Aucune logique touchée.
- `index.html` — police Syne → Bricolage Grotesque, `theme-color`.
- `public/favicon.svg`, `public/manifest.webmanifest` — nouvelle couleur de fond, nouvelle icône.
- `public/sw.js` — cache `tov-shell-v1` → `v2` pour que les installations existantes reçoivent la nouvelle coque.

**Créés** : `design/*`.
**Dépendances ajoutées** : aucune.
**Commandes** : `npm install`, `npm run dev` (http://localhost:5173), `npm run typecheck`, `npm test`, `npm run build`.
**Vérifié** : typecheck OK, 22 tests du moteur OK, build web OK, contrastes calculés.
**Non vérifié** : rendu visuel (aucun navigateur disponible ici, donc pas de captures 390 / 768 / 1440), mode clair à l'œil, `npm run smoke` (serveur non lancé).

**Passe de textes** (`App.tsx`, `LocalGame.tsx`, `OnlineGame.tsx`, `screens.tsx`)
- Corrigé : phrase fautive du mode un téléphone (« le lecture des cartes »).
- Harmonisé : « Envoyer ma réponse » partout, « Preuve demandée » pour les défis média, ton direct et complice, tutoiement conservé.
- Supprimé : redondances (« Rien n’est enregistré » ne reste que là où il rassure), jargon (« hôte » devenu « celui qui crée le salon », « passe son tour » devenu « Carte réservée aux adultes »).
- Non touché : messages du moteur et du serveur (vérifiés par les tests), contenu des cartes.

---

## 2ᵉ passe — 6 nov. 2026 (sur la version avec guides)

**Dépendances (dev, embarquées par Vite)** : `lucide-react`, `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/dm-sans`, `qrcode-generator`. Aucune dépendance serveur ajoutée (le `Dockerfile` n'est pas affecté).
**Commandes** : `npm install` puis `npm run dev` (ou `npm run build`).

**Créés** : `src/fx.ts` (préférences, vibrations, sons), `src/styles/{tokens,base,components,game,guide,motion}.css`, `public/{apple-touch-icon,icon-192,icon-512,icon-maskable-512}.png`.
**Modifiés** : `src/styles.css` (simple point d'entrée), `src/main.tsx`, `index.html` (polices locales, script de thème, balises Open Graph texte), `src/ui.tsx`, `src/screens.tsx`, `src/App.tsx`, `src/OnlineGame.tsx`, `public/manifest.webmanifest` (icônes PNG), `public/sw.js` (cache v3), `package.json`.
**Logique** : seul changement de flux UI — la feuille d'écriture se ferme 700 ms après l'envoi (tampon). Aucun changement de moteur, de socket ni de contrat.

**Vérifié** : `tsc --noEmit` OK, 26 tests moteur OK, `npm run build` OK (JS ≈ 110 Ko gzip, CSS ≈ 9 Ko gzip), parcours complet « un téléphone » rejoué dans Chromium (390 px sombre et clair, 1280 px) avec captures.
**Non vérifié** : vibrations et sons sur appareil réel ; salon en ligne à deux navigateurs (seul le lobby a été conçu, pas rejoué) ; QR code scanné avec un vrai téléphone ; lecteur d'écran réel ; Open Graph avec image (nécessite l'URL publique absolue).
