const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hymne2')
        .setDescription('Lance l\'hymne des plots n°2'),

    async execute(interaction, client) {
        return musicCommand.handlePlay(interaction, client, config.hymne2);
    }
};