@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Tacle ou Verite — lancement local
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe.
  echo Telecharge-le sur https://nodejs.org ^(version 20 ou plus^), puis relance ce fichier.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Premiere fois : installation des dependances ^(1 a 3 minutes^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Echec de npm install. Verifie ta connexion internet.
    pause
    exit /b 1
  )
  echo Installation terminee.
  echo.
)

echo Demarrage en cours...
echo   Interface : http://localhost:5173
echo   Pour arreter : ferme cette fenetre ou Ctrl+C
echo.

rem Ouvre le navigateur apres un court delai pendant que Vite demarre
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:5173"

call npm run dev
echo.
pause
