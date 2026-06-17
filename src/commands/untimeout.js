const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ok, ko, COLORS } = require('../utils/embeds');
const { requirePerm, logModAction, EPH } = require('../utils/mod');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Retire le mute (timeout) d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Le membre à démuter').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.ModerateMembers, 'Rendre muet (timeout)')) return;

        const member = interaction.options.getMember('membre');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

        if (!member) return interaction.reply(ko('Membre introuvable.', EPH));
        if (!member.isCommunicationDisabled()) return interaction.reply(ko('Ce membre n\'est pas muet.', EPH));

        try {
            await member.timeout(null, reason);
        } catch (e) {
            return interaction.reply(ko('Échec : ' + e.message, EPH));
        }

        await interaction.reply(ok(`🔊 **${member.user.username}** n'est plus muet.`));
        logModAction(interaction.guild, {
            title: '🔊 Mute retiré',
            color: COLORS.success,
            target: `${member.user.username} (\`${member.id}\`)`,
            moderator: `${interaction.user.username}`,
            reason,
        });
    }
};
