const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/roster.json');

// Source unique de vérité pour la liste des agents (partagée par /pute et /roster).
const VALORANT_AGENTS = [
    "Jett", "Raze", "Iso", "Neon", "Reyna", "Yoru", "Phoenix",
    "Breach", "Fade", "Gekko", "KAY/O", "Skye", "Sova",
    "Omen", "Astra", "Brimstone", "Clove", "Harbor", "Viper",
    "Chamber", "Cypher", "Deadlock", "Killjoy", "Sage", "Vyse"
];

function read() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch { return {}; }
}
function write(d) {
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

// Stockage par ID Discord (fiable, contrairement au pseudo qui change).
function getAgents(userId) {
    const d = read();
    return (d[userId] && d[userId].agents) || [];
}
function setAgents(userId, pseudo, agents) {
    const d = read();
    d[userId] = { pseudo, agents };
    write(d);
}
function clearUser(userId) {
    const d = read();
    delete d[userId];
    write(d);
}

// Valide/normalise une saisie "Jett, reyna ,OMEN" -> { valid:["Jett","Reyna","Omen"], invalid:[] }
function normalizeAgents(input) {
    const valid = [], invalid = [];
    for (const raw of input.split(',').map(s => s.trim()).filter(Boolean)) {
        const match = VALORANT_AGENTS.find(a => a.toLowerCase() === raw.toLowerCase());
        if (match) { if (!valid.includes(match)) valid.push(match); }
        else invalid.push(raw);
    }
    return { valid, invalid };
}

module.exports = { VALORANT_AGENTS, read, getAgents, setAgents, clearUser, normalizeAgents };
