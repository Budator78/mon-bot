const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hymne1')
        .setDescription('Lance l\'hymne des plots'),

    async execute(interaction, client) {
        // On réutilise la fonction de lecture de music.js
        return musicCommand.handlePlay(interaction, client, config.hymne1);
    }
};