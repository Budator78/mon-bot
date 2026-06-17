# mon-bot 🎶🛡️

Bot Discord tout-en-un : **musique** (via Lavalink), **jeux entre potes**, **modération** et **logs serveur**.

## Fonctionnalités

- **Musique** : `/play` (recherche/lien/playlist), lecteur avec boutons (pause, skip, mix, seek ±10 s, autoplay radio, ajout à une playlist), file d'attente, filtres audio (`/filter`), playlists partagées (`/playlist`).
- **Jeux** : `/pute` (équipes + traître secret), `/teams`, `/roster` (agents Valorant), `/deadlock` (stats).
- **Modération** : `/kick` `/ban` `/unban` `/timeout` `/untimeout` `/purge` `/warn`.
- **Logs serveur** : arrivées/départs, messages supprimés/édités, vocal, salons, rôles, modération (`/setlog` pour choisir le salon).
- `/help` pour la liste complète.

## Prérequis

- [Node.js](https://nodejs.org/) 18+
- [Java 17](https://adoptium.net/) (pour Lavalink)

## Installation

```bash
git clone <url-du-repo>
cd mon-bot
npm install
```

1. Copie `config.example.json` en `config.json` et remplis ton **token**, `clientId`, `guildId`.
2. Télécharge **Lavalink** : place `Lavalink.jar` (v4.2.2+) dans le dossier `Lavalink/`.
   ```bash
   # exemple
   wget -P Lavalink https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar
   ```
3. Active les **intents privilégiés** dans le [portail développeur Discord](https://discord.com/developers/applications) (onglet Bot) : `SERVER MEMBERS` et `MESSAGE CONTENT`.

## Lancement

- **Windows (dev)** : `start_bot.bat` (lance Lavalink + le bot via nodemon).
- **Serveur 24/7 (Linux)** : avec [pm2](https://pm2.keymetrics.io/) → `pm2 start ecosystem.config.js`.


