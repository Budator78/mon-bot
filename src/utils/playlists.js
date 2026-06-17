const fs = require('fs');
const path = require('path');

// Même fichier que celui géré par la commande /playlist.
const FILE = path.join(__dirname, '../data/playlists.json');

function readDb() {
    if (!fs.existsSync(FILE)) return {};
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch { return {}; }
}
function saveDb(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Playlists d'un utilisateur sous la forme { nom: [tracks] }.
function userPlaylists(userId) {
    const db = readDb();
    return db[userId] || {};
}

// Ajoute un titre (au format stocké) à une playlist existante de l'utilisateur.
// Renvoie false si la playlist n'existe pas.
function addTrack(userId, name, track) {
    const db = readDb();
    if (!db[userId] || !db[userId][name]) return false;
    db[userId][name].push(track);
    saveDb(db);
    return true;
}

module.exports = { readDb, saveDb, userPlaylists, addTrack };
