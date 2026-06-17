const { EmbedBuilder } = require('discord.js');

// === IDENTITÉ VISUELLE COMMUNE DU BOT ===
// Une seule palette pour tout le bot (fini les couleurs dispersées).
const COLORS = {
    brand:   0x5865F2, // Blurple : couleur de marque / info
    success: 0x57F287, // Vert
    error:   0xED4245, // Rouge
    warning: 0xFEE75C, // Jaune
    music:   0x5865F2, // Lecteur musique
    // Couleurs par jeu (commande /pute)
    valorant:  0xFF4655,
    overwatch: 0xF99E1A,
    rl:        0x1F8FFF,
};

function base(color) {
    return new EmbedBuilder().setColor(color).setTimestamp();
}

const successEmbed = (text) => base(COLORS.success).setDescription(`✅ ${text}`);
const errorEmbed   = (text) => base(COLORS.error).setDescription(`❌ ${text}`);
const warnEmbed    = (text) => base(COLORS.warning).setDescription(`⚠️ ${text}`);
const infoEmbed    = (text) => base(COLORS.brand).setDescription(text);

// Réponses rapides prêtes à l'emploi (renvoient un objet { embeds: [...] }).
const ok    = (text, extra = {}) => ({ embeds: [successEmbed(text)], ...extra });
const ko    = (text, extra = {}) => ({ embeds: [errorEmbed(text)], ...extra });
const warn  = (text, extra = {}) => ({ embeds: [warnEmbed(text)], ...extra });
const info  = (text, extra = {}) => ({ embeds: [infoEmbed(text)], ...extra });

// === BARRE DE PROGRESSION TEXTUELLE ===
// progressBar(72000, 215000) -> "🔵▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬"
function progressBar(position, total, size = 18) {
    if (!total || total <= 0 || isNaN(total)) return '🔘' + '▬'.repeat(size);
    const ratio = Math.min(Math.max(position / total, 0), 1);
    const filled = Math.round(ratio * size);
    return '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(size - filled, 0));
}

module.exports = {
    COLORS, base,
    successEmbed, errorEmbed, warnEmbed, infoEmbed,
    ok, ko, warn, info,
    progressBar,
};
