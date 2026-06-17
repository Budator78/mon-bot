const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const musicCommand = require('./music');
const { ok, ko } = require('../utils/embeds');

// Chaque filtre nettoie d'abord les filtres existants pour éviter de les cumuler.
const FILTERS = {
    bassboost: async (p) => { await p.clearFilters(); await p.setEqualizer([
        { band: 0, gain: 0.25 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.1 }
    ]); },
    nightcore: async (p) => { await p.clearFilters(); await p.setTimescale({ speed: 1.2, pitch: 1.2, rate: 1 }); },
    slowed:    async (p) => { await p.clearFilters(); await p.setTimescale({ speed: 0.85, pitch: 0.9, rate: 1 }); },
    '8d':      async (p) => { await p.clearFilters(); await p.setRotation({ rotationHz: 0.2 }); },
    reset:     async (p) => { await p.clearFilters(); },
};

const LABELS = {
    bassboost: '🔊 Bass Boost', nightcore: '⚡ Nightcore', slowed: '🐌 Slowed',
    '8d': '🎧 8D', reset: '♻️ Filtres réinitialisés',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Applique un filtre audio à la musique en cours')
        .addStringOption(o => o.setName('type').setDescription('Le filtre à appliquer').setRequired(true)
            .addChoices(
                { name: '🔊 Bass Boost', value: 'bassboost' },
                { name: '⚡ Nightcore', value: 'nightcore' },
                { name: '🐌 Slowed', value: 'slowed' },
                { name: '🎧 8D', value: '8d' },
                { name: '♻️ Reset (aucun)', value: 'reset' },
            )),

    async execute(interaction, client) {
        const data = musicCommand.musicQueues.get(interaction.guild.id);
        if (!data || !data.player) return interaction.reply(ko('Aucune musique en cours.', { flags: MessageFlags.Ephemeral }));

        const type = interaction.options.getString('type');
        await interaction.deferReply();
        try {
            await FILTERS[type](data.player);
        } catch (e) {
            console.error('[Filter] ❌', e.message);
            return interaction.editReply(ko("Impossible d'appliquer le filtre."));
        }
        return interaction.editReply(ok(`Filtre appliqué : **${LABELS[type]}**`));
    }
};
