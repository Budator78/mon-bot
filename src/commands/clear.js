const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription("Vide la file d'attente (garde le titre en cours)"),

    async execute(interaction, client) {
        // On simule un clic sur l'action "clear" du lecteur.
        interaction.customId = "music_clear";
        return musicCommand.handleInteraction(interaction, client);
    }
};
