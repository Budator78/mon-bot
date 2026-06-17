const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Active ou désactive la boucle'),

    async execute(interaction, client) {
        interaction.customId = "music_loop";
        return musicCommand.handleInteraction(interaction, client);
    }
};