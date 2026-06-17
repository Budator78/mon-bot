@echo off
title Mon Bot Discord Launcher

echo ==========================================
echo 1. Lancement du serveur Lavalink...
echo ==========================================

:: Cette ligne ouvre une NOUVELLE fenetre pour Lavalink
:: Elle va dans le dossier 'Lavalink' et lance le jar
start "Serveur Lavalink" cmd /c "cd Lavalink && java -jar Lavalink.jar"

echo Lavalink demarre dans une autre fenetre.
echo Attente de 25 secondes pour le chargement...
echo ==========================================

:: On attend 25 secondes le temps que Lavalink s'allume.
:: /nobreak = impossible de sauter la pause en appuyant sur une touche.
timeout /t 25 /nobreak

echo.
echo ==========================================
echo 2. Lancement du Bot Node.js...
echo ==========================================

:: Lance ton bot
nodemon src/index.js

:: Si le bot crash, la fenetre reste ouverte pour lire l'erreur
pause