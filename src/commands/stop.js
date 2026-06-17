const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Arrête la musique et déconnecte le bot'),

    async execute(interaction, client) {
        // On simule un clic sur le bouton "Stop"
        interaction.customId = "music_stop";
        return musicCommand.handleInteraction(interaction, client);
    }
};