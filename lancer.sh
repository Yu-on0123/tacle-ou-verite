#!/usr/bin/env bash
# Double-clique ou : ./lancer.sh
# Lance le serveur + l'interface dans le navigateur (Mac / Linux).

cd "$(dirname "$0")"

echo "========================================"
echo "  Tacle ou Vérité — lancement local"
echo "========================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé."
  echo "Télécharge-le sur https://nodejs.org (version 20 ou plus), puis relance ce script."
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 20 ] 2>/dev/null; then
  echo "Node.js $NODE_MAJOR détecté. Il faut la version 20 ou plus : https://nodejs.org"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Première fois : installation des dépendances (1 à 3 minutes)..."
  npm install --no-audit --no-fund || {
    echo "Échec de npm install. Vérifie ta connexion internet."
    exit 1
  }
  echo "Installation terminée."
  echo
fi

# Ouvre le navigateur un peu après le démarrage de Vite
(
  sleep 3
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:5173" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173" 2>/dev/null || true
  fi
) &

echo "Démarrage en cours..."
echo "  → Interface : http://localhost:5173"
echo "  → Pour arrêter : Ctrl+C dans ce terminal"
echo

npm run dev
