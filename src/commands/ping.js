const { SlashCommandBuilder } = require('discord.js');
const { base, COLORS } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Affiche la latence du bot'),

    async execute(interaction, client) {
        const sent = await interaction.reply({ content: '🏓 Calcul en cours...', fetchReply: true });
        const rtt = sent.createdTimestamp - interaction.createdTimestamp;
        const ws = Math.round(client.ws.ping);

        const worst = Math.max(rtt, ws);
        const color = worst < 150 ? COLORS.success : worst < 350 ? COLORS.warning : COLORS.error;
        const quality = worst < 150 ? '🟢 Excellent' : worst < 350 ? '🟠 Correct' : '🔴 Élevé';

        const embed = base(color)
            .setTitle('🏓 Pong !')
            .addFields(
                { name: '📨 Latence message', value: `\`${rtt} ms\``, inline: true },
                { name: '🌐 WebSocket', value: `\`${ws < 0 ? 'N/A' : ws + ' ms'}\``, inline: true },
                { name: '📊 Qualité', value: quality, inline: true },
            );

        await interaction.editReply({ content: null, embeds: [embed] });
    }
};
