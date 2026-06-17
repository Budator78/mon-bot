const fs = require('fs');
const path = require('path');

// Avertissements : { guildId: { userId: [ { reason, moderator, timestamp } ] } }
const FILE = path.join(__dirname, '../data/warnings.json');

function read() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch { return {}; }
}
function write(d) {
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

function add(guildId, userId, entry) {
    const d = read();
    if (!d[guildId]) d[guildId] = {};
    if (!d[guildId][userId]) d[guildId][userId] = [];
    d[guildId][userId].push(entry);
    write(d);
    return d[guildId][userId].length; // nombre total après ajout
}
function list(guildId, userId) {
    const d = read();
    return (d[guildId] && d[guildId][userId]) || [];
}
function clear(guildId, userId) {
    const d = read();
    if (d[guildId] && d[guildId][userId]) {
        const n = d[guildId][userId].length;
        delete d[guildId][userId];
        write(d);
        return n;
    }
    return 0;
}

module.exports = { add, list, clear };
