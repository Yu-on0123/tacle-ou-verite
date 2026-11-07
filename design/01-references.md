# 01 — Références (2ᵉ passe)

Pages réellement ouvertes lors de cette passe. Aucun design copié : on en tire des principes.

| # | Référence | URL | Catégorie | Principe retenu | Non retenu |
|---|---|---|---|---|---|
| 1 | Linear — « Behind the latest design refresh » | https://linear.app/now/behind-the-latest-design-refresh | Produit | Réduire le bruit, hiérarchie par le contraste plutôt que par la couleur, cohérence stricte | Densité « outil de travail » : le jeu est contemplatif |
| 2 | Linear — « How we redesigned the Linear UI » | https://linear.app/now/how-we-redesigned-the-linear-ui | Produit / fondations | Peu de variables, thèmes dérivés d'un petit jeu de tokens, alignements soignés | Génération LCH automatique (surdimensionné ici) |
| 3 | Emil Kowalski — règles d'animation (résumé tiers) | https://agent-skills.md/skills/pproenca/dot-skills/emilkowal-animations | Motion | Ease-out marqué, retour au toucher en `scale(~.97)`, ne jamais partir de `scale(0)`, animer `transform`/`opacity` | Résumé de seconde main : à relire à la source si besoin |
| 4 | web.dev — Animations (guide de performance) | https://web.dev/articles/animations-guide | Motion / perf | `transform` + `opacity` seulement, `will-change` avec parcimonie | — |
| 5 | web.dev — `prefers-reduced-motion` | https://web.dev/articles/prefers-reduced-motion | Accessibilité | Réduire plutôt que supprimer : garder fondus et états, retirer les déplacements décoratifs | — |
| 6 | MDN — `navigator.vibrate` | https://developer.mozilla.org/es/docs/Web/API/Navigator/vibrate | Composant | Motifs courts en tableau, nécessite une activation utilisateur, non supporté sur iOS → amélioration progressive, jamais indispensable | Vibration longue ou répétée |
| 7 | Laws of UX — Peak-End Rule | https://lawsofux.com/articles/2020/peak-end-rule | UX | On retient le pic et la fin : soigner le dépouillement (pic) et l'écran final (fin) | — |
| 8 | Radix Colors — « Understanding the scale » | https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale | Fondations | Rôles par étape (fond, composant, bordure, plein, texte) pour nommer les tokens ; texte lisible sur fond de l'échelle | Échelles à 12 étapes complètes (un seul accent suffit) |
| 9 | Endship — refonte UX d'un jeu où l'on « roast » ses amis | https://medium.com/psynamic/endship-ux-redesign-for-a-game-where-you-roast-your-friends-2f6ebcba1d2b | Genre | Lu pour le genre (anonymat, révélation) ; aucun chiffre ni composant repris | — |
| 10 | Contra — UX d'un jeu de cartes immersif | https://contra.com/p/bOAqsl3Z-innovative-ux-design-for-immersive-card-game-app-experience | Genre | Seule info exploitable : « UI sombre premium, mobile-first pour longues sessions » | Page trop succincte : pas d'autre apport |

**Non ouvertes (accès refusé)** : Apple HIG (haptiques), Raycast, Vercel Geist, Material 3 motion, Designspells, Refactoring UI. Aucune conclusion n'en est tirée.
