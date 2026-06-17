const { MessageFlags } = require('discord.js');
const { base, COLORS, ko } = require('./embeds');
const { sendLog } = require('./logger');

const EPH = { flags: MessageFlags.Ephemeral };

// Vérifie une permission. Si absente, répond (éphémère) et renvoie false.
async function requirePerm(interaction, perm, label) {
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(perm)) {
        await interaction.reply(ko(`Tu n'as pas la permission requise (**${label}**).`, EPH)).catch(() => {});
        return false;
    }
    return true;
}

// Construit + envoie un embed de log d'action de modération dans le salon de logs.
function logModAction(guild, { title, color = COLORS.warning, target, moderator, reason, fields = [] }) {
    const e = base(color).setTitle(title);
    const f = [];
    if (target) f.push({ name: '👤 Membre', value: target, inline: true });
    if (moderator) f.push({ name: '🛡️ Modérateur', value: moderator, inline: true });
    if (reason) f.push({ name: '📝 Raison', value: String(reason).substring(0, 1024) });
    f.push(...fields);
    if (f.length) e.addFields(...f);
    sendLog(guild, e);
}

module.exports = { requirePerm, logModAction, EPH };
