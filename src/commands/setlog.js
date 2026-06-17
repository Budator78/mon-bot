const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { ok, COLORS, base } = require('../utils/embeds');
const { requirePerm, EPH } = require('../utils/mod');
const { setLogChannel, getLogChannel } = require('../utils/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlog')
        .setDescription('Définit le salon où seront envoyés les logs du serveur')
        .addChannelOption(o => o.setName('salon')
            .setDescription('Le salon de logs (laisse vide pour voir le salon actuel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.ManageGuild, 'Gérer le serveur')) return;

        const channel = interaction.options.getChannel('salon');

        if (!channel) {
            const current = getLogChannel(interaction.guild.id);
            const embed = base(COLORS.brand)
                .setTitle('📋 Salon de logs')
                .setDescription(current ? `Actuellement : <#${current}>` : 'Aucun salon de logs défini. Utilise `/setlog salon:#ton-salon`.');
            return interaction.reply({ embeds: [embed], ...EPH });
        }

        setLogChannel(interaction.guild.id, channel.id);

        // Petit message de confirmation directement dans le salon de logs.
        channel.send({ embeds: [base(COLORS.success).setTitle('📋 Salon de logs configuré').setDescription('Les logs du serveur arriveront ici.')] }).catch(() => {});

        return interaction.reply(ok(`Salon de logs défini sur ${channel}.`, EPH));
    }
};
