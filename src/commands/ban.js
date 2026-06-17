const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ok, ko, COLORS } = require('../utils/embeds');
const { requirePerm, logModAction, EPH } = require('../utils/mod');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un membre du serveur')
        .addUserOption(o => o.setName('membre').setDescription('Le membre à bannir').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(false))
        .addIntegerOption(o => o.setName('purge_jours').setDescription('Supprimer les messages des N derniers jours (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.BanMembers, 'Bannir des membres')) return;

        const user = interaction.options.getUser('membre');
        const member = interaction.options.getMember('membre'); // null si pas sur le serveur
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
        const days = interaction.options.getInteger('purge_jours') || 0;

        if (user.id === interaction.user.id) return interaction.reply(ko('Tu ne peux pas te bannir toi-même.', EPH));
        if (member && !member.bannable) return interaction.reply(ko('Impossible de bannir ce membre (rôle trop haut ou permission manquante).', EPH));

        if (member) await user.send(`Tu as été **banni** de **${interaction.guild.name}**.\nRaison : ${reason}`).catch(() => {});

        try {
            await interaction.guild.bans.create(user.id, { reason, deleteMessageSeconds: days * 86400 });
        } catch (e) {
            return interaction.reply(ko('Échec du bannissement : ' + e.message, EPH));
        }

        await interaction.reply(ok(`🔨 **${user.username}** a été banni.\nRaison : ${reason}`));
        logModAction(interaction.guild, {
            title: '🔨 Bannissement',
            color: COLORS.error,
            target: `${user.username} (\`${user.id}\`)`,
            moderator: `${interaction.user.username}`,
            reason,
        });
    }
};
