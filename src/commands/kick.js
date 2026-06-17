const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ok, ko, COLORS } = require('../utils/embeds');
const { requirePerm, logModAction, EPH } = require('../utils/mod');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulse un membre du serveur')
        .addUserOption(o => o.setName('membre').setDescription('Le membre à expulser').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison de l\'expulsion').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.KickMembers, 'Expulser des membres')) return;

        const member = interaction.options.getMember('membre');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

        if (!member) return interaction.reply(ko('Membre introuvable sur le serveur.', EPH));
        if (member.id === interaction.user.id) return interaction.reply(ko('Tu ne peux pas t\'expulser toi-même.', EPH));
        if (!member.kickable) return interaction.reply(ko('Impossible d\'expulser ce membre (son rôle est trop haut ou il me manque la permission).', EPH));

        await member.user.send(`Tu as été **expulsé** de **${interaction.guild.name}**.\nRaison : ${reason}`).catch(() => {});

        try {
            await member.kick(reason);
        } catch (e) {
            return interaction.reply(ko('Échec de l\'expulsion : ' + e.message, EPH));
        }

        await interaction.reply(ok(`👢 **${member.user.username}** a été expulsé.\nRaison : ${reason}`));
        logModAction(interaction.guild, {
            title: '👢 Expulsion',
            color: COLORS.warning,
            target: `${member.user.username} (\`${member.id}\`)`,
            moderator: `${interaction.user.username}`,
            reason,
        });
    }
};
