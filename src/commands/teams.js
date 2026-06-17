const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { base, COLORS, ko } = require('../utils/embeds');

function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Répartit les joueurs du vocal en équipes aléatoires')
        .addIntegerOption(o => o.setName('equipes').setDescription("Nombre d'équipes (défaut : 2)").setMinValue(2).setMaxValue(5).setRequired(false)),

    async execute(interaction, client) {
        const vc = interaction.member.voice.channel;
        if (!vc) return interaction.reply(ko('Tu dois être en vocal !', { flags: MessageFlags.Ephemeral }));

        const members = shuffle([...vc.members.values()].filter(m => !m.user.bot));
        if (members.length < 2) return interaction.reply(ko('Il faut au moins 2 joueurs dans le vocal.', { flags: MessageFlags.Ephemeral }));

        const n = Math.min(interaction.options.getInteger('equipes') || 2, members.length);
        const teams = Array.from({ length: n }, () => []);
        members.forEach((m, i) => teams[i % n].push(m));

        const emojis = ['🔵', '🔴', '🟢', '🟡', '🟣'];
        const embed = base(COLORS.brand).setTitle(`👥 Équipes aléatoires · ${members.length} joueurs`);
        teams.forEach((t, i) => embed.addFields({
            name: `${emojis[i]} Équipe ${i + 1}`,
            value: t.map(m => `• ${m.user.username}`).join('\n') || '_vide_',
            inline: true
        }));

        return interaction.reply({ embeds: [embed] });
    }
};
