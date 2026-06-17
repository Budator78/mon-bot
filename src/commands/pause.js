const { SlashCommandBuilder } = require('discord.js');
const musicCommand = require('./music'); // On réutilise la logique de music.js

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause') // Le nom de la commande directe
        .setDescription('Met la musique en pause'),

    async execute(interaction, client) {
        // Astuce : On fait croire au bot qu'on a cliqué sur le bouton "pause"
        interaction.customId = "music_pause"; 
        return musicCommand.handleInteraction(interaction, client);
    }
};