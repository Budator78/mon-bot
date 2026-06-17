const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ok, ko, COLORS } = require('../utils/embeds');
const { requirePerm, logModAction, EPH } = require('../utils/mod');

const MAX_MS = 28 * 24 * 60 * 60 * 1000; // limite Discord : 28 jours

// Parse "10s" / "10m" / "2h" / "1d" -> millisecondes. null si invalide.
function parseDuration(input) {
    const m = String(input).trim().match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
    return n * mult;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Rend un membre muet pendant une durée donnée')
        .addUserOption(o => o.setName('membre').setDescription('Le membre à rendre muet').setRequired(true))
        .addStringOption(o => o.setName('duree').setDescription('Durée : ex. 30s, 10m, 2h, 1d (max 28d)').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.ModerateMembers, 'Rendre muet (timeout)')) return;

        const member = interaction.options.getMember('membre');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
        const ms = parseDuration(interaction.options.getString('duree'));

        if (!member) return interaction.reply(ko('Membre introuvable.', EPH));
        if (ms === null) return interaction.reply(ko('Durée invalide. Exemples : `30s`, `10m`, `2h`, `1d`.', EPH));
        if (ms > MAX_MS) return interaction.reply(ko('La durée max est de 28 jours.', EPH));
        if (member.id === interaction.user.id) return interaction.reply(ko('Tu ne peux pas te rendre muet toi-même.', EPH));
        if (!member.moderatable) return interaction.reply(ko('Impossible de rendre ce membre muet (rôle trop haut ou permission manquante).', EPH));

        try {
            await member.timeout(ms, reason);
        } catch (e) {
            return interaction.reply(ko('Échec du timeout : ' + e.message, EPH));
        }

        const dureeLisible = interaction.options.getString('duree');
        await interaction.reply(ok(`🔇 **${member.user.username}** est muet pour **${dureeLisible}**.\nRaison : ${reason}`));
        logModAction(interaction.guild, {
            title: '🔇 Mute (timeout)',
            color: COLORS.warning,
            target: `${member.user.username} (\`${member.id}\`)`,
            moderator: `${interaction.user.username}`,
            reason,
            fields: [{ name: '⏳ Durée', value: dureeLisible, inline: true }],
        });
    }
};
