const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Affiche la liste de lecture'),

    async execute(interaction, client) {
        interaction.customId = "music_queue";
        return musicCommand.handleInteraction(interaction, client);
    }
};