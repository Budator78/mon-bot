const fs = require('fs');
const path = require('path');

// Réglages par serveur (ex. salon de logs). Fichier dans src/data (ignoré par nodemon).
const FILE = path.join(__dirname, '../data/settings.json');

function read() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch { return {}; }
}
function write(d) {
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

function getLogChannel(guildId) {
    const d = read();
    return (d[guildId] && d[guildId].logChannel) || null;
}
function setLogChannel(guildId, channelId) {
    const d = read();
    if (!d[guildId]) d[guildId] = {};
    d[guildId].logChannel = channelId;
    write(d);
}

module.exports = { getLogChannel, setLogChannel };
