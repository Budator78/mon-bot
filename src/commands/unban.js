const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ok, ko, COLORS } = require('../utils/embeds');
const { requirePerm, logModAction, EPH } = require('../utils/mod');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Débannit un utilisateur (par son ID)')
        .addStringOption(o => o.setName('user_id').setDescription('L\'ID Discord de l\'utilisateur à débannir').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.BanMembers, 'Bannir des membres')) return;

        const userId = interaction.options.getString('user_id').trim();
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

        if (!/^\d{17,20}$/.test(userId)) return interaction.reply(ko('ID invalide. Donne un ID Discord (17-20 chiffres).', EPH));

        try {
            await interaction.guild.bans.remove(userId, reason);
        } catch (e) {
            return interaction.reply(ko('Échec du débannissement (l\'utilisateur n\'est peut-être pas banni). ' + e.message, EPH));
        }

        await interaction.reply(ok(`♻️ L'utilisateur \`${userId}\` a été débanni.\nRaison : ${reason}`));
        logModAction(interaction.guild, {
            title: '♻️ Débannissement',
            color: COLORS.success,
            target: `\`${userId}\``,
            moderator: `${interaction.user.username}`,
            reason,
        });
    }
};
