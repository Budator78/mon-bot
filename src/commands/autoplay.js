const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const musicCommand = require('./music');
const { ko, info } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription("Active/désactive l'enchaînement automatique de titres similaires"),

    async execute(interaction, client) {
        const data = musicCommand.musicQueues.get(interaction.guild.id);
        if (!data) return interaction.reply(ko('Aucune musique en cours.', { flags: MessageFlags.Ephemeral }));

        data.autoplay = !data.autoplay;
        musicCommand.updateMusicMessage(interaction.guild.id, interaction.channel);

        return interaction.reply(info(data.autoplay
            ? "🤖 Autoplay **activé** — j'enchaînerai des sons similaires quand la file sera vide."
            : "⏹️ Autoplay **désactivé**."));
    }
};
