# 04 — Écrans (v2)

| Écran | Action primaire | Nouveautés v2 |
|---|---|---|
| Accueil (`App.tsx`) | Choisir « Un seul téléphone » / « Salon en ligne » | Trois enveloppes interactives (`SealDemo`), titre avec ruban surligné, tuiles à icône, 3 étapes, mention « rien n'est enregistré », bouton guide |
| Profil / joueurs (`ui.tsx`) | Ajouter ce joueur / Rejoindre | Monogrammes sur papier, pastille de présence, cases et radios sur mesure (cible 44 px) |
| Salon (`OnlineGame.tsx`) | Inviter / lancer | Code en tuiles de jeu, partage natif (Web Share) si disponible, copie du lien, QR code local (`qrcode-generator`) |
| Menu des jeux (`MenuScreen`) | Lancer un jeu | Deux groupes (« À écrire », « À jouer en direct »), icône par jeu, état verrouillé, « ? » des guides conservé |
| Passage de téléphone (`PassScreen`) | « C'est moi, X » | Enveloppe papier + nom sur ruban |
| Réponse (`AnswerScreen`) | Envoyer / J'ai fini | Chrono en anneau (tension et « tic » dans les 5 dernières secondes), cartes papier avec ruban, feuille lignée avec compteur 0/400, `Escape` + piège de focus + retour de focus, tampon « Scellé » |
| Dingueries / vote | Envoyer / Voter | Question sur carte papier ; noms avec monogramme et coche |
| Dépouillement (`RevealScreen`) | Suivant | Pile des cartes restantes, ruban à bord arraché qui se décolle, vibration + son optionnels |
| Fin (`EndScreen`) | Retour à l'accueil | Enveloppe papier + tampon « Effacé » |
| Préférences (`ui.tsx`) | — | Menu discret : thème auto/sombre/clair, sons, vibrations |
| Guides (`Guide.tsx`) | Fermer | Inchangés ; passent sur la matière papier ; « ? » rond 44 px |

États couverts : vide, chargement (statut en direct), erreur (`role="alert"`), succès (tampon), survol (seulement `@media (hover: hover)`), focus visible, désactivé.
Responsive : 390 / 768 / 1280 vérifiés ; en-tête sur une ligne dès 390 px.
