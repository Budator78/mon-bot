const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Reprend la musique'),

    async execute(interaction, client) {
        interaction.customId = "music_resume";
        return musicCommand.handleInteraction(interaction, client);
    }
};