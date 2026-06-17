const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Passe à la musique suivante'),

    async execute(interaction, client) {
        // On simule un clic sur le bouton skip
        interaction.customId = "music_skip";
        return musicCommand.handleInteraction(interaction, client);
    }
};