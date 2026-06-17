const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ok, ko, warn, COLORS } = require('../utils/embeds');
const { requirePerm, logModAction, EPH } = require('../utils/mod');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Supprime en masse des messages du salon')
        .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages à supprimer (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .addUserOption(o => o.setName('membre').setDescription('Ne supprimer que les messages de ce membre').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.ManageMessages, 'Gérer les messages')) return;

        const count = interaction.options.getInteger('nombre');
        const targetUser = interaction.options.getUser('membre');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let messages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages) return interaction.editReply(ko('Impossible de récupérer les messages.'));

        const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
        const tooOld = Date.now() - TWO_WEEKS;

        let toDelete = [...messages.values()];
        if (targetUser) toDelete = toDelete.filter(m => m.author && m.author.id === targetUser.id);
        // Discord interdit la suppression en masse des messages de +14 jours : on les écarte.
        toDelete = toDelete.filter(m => m.createdTimestamp > tooOld).slice(0, count);

        if (toDelete.length === 0) {
            return interaction.editReply(warn(targetUser
                ? `Aucun message récent (moins de 14 jours) de **${targetUser.username}** dans les 100 derniers messages.`
                : 'Aucun message récent à supprimer (les messages de +14 jours ne sont pas supprimables en masse).'));
        }

        let n = 0;
        try {
            if (toDelete.length === 1) {
                await toDelete[0].delete(); // bulkDelete exige ≥2 messages : suppression unitaire
                n = 1;
            } else {
                const deleted = await interaction.channel.bulkDelete(toDelete, true);
                n = deleted.size;
            }
        } catch (e) {
            return interaction.editReply(ko('Échec de la suppression : ' + e.message));
        }

        await interaction.editReply(ok(`🧹 **${n}** message(s) supprimé(s)${targetUser ? ` de **${targetUser.username}**` : ''}.`));
        logModAction(interaction.guild, {
            title: '🧹 Purge de messages',
            color: COLORS.brand,
            moderator: `${interaction.user.username}`,
            fields: [
                { name: '🗑️ Supprimés', value: `${n}`, inline: true },
                { name: '📺 Salon', value: `${interaction.channel}`, inline: true },
                ...(targetUser ? [{ name: '👤 Cible', value: `${targetUser.username}`, inline: true }] : []),
            ],
        });
    }
};
