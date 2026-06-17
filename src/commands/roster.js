const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { base, COLORS, ok, ko, info } = require('../utils/embeds');
const roster = require('../utils/roster');

const EPH = { flags: MessageFlags.Ephemeral };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roster')
        .setDescription('Gère tes agents Valorant favoris (utilisés par /pute)')
        .addSubcommand(s => s.setName('set').setDescription('Définit tes agents favoris')
            .addStringOption(o => o.setName('agents').setDescription('Agents séparés par des virgules (ex: Jett, Reyna, Omen)').setRequired(true)))
        .addSubcommand(s => s.setName('show').setDescription("Affiche tes agents (ou ceux d'un autre joueur)")
            .addUserOption(o => o.setName('joueur').setDescription('Le joueur à consulter').setRequired(false)))
        .addSubcommand(s => s.setName('clear').setDescription('Efface tes agents favoris'))
        .addSubcommand(s => s.setName('agents').setDescription('Liste tous les agents disponibles')),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'agents') {
            const embed = base(COLORS.valorant)
                .setTitle('🎯 Agents Valorant disponibles')
                .setDescription(roster.VALORANT_AGENTS.map(a => `\`${a}\``).join(', '));
            return interaction.reply({ embeds: [embed], ...EPH });
        }

        if (sub === 'set') {
            const { valid, invalid } = roster.normalizeAgents(interaction.options.getString('agents'));
            if (valid.length === 0) return interaction.reply(ko('Aucun agent valide reconnu. Vois la liste avec `/roster agents`.', EPH));
            roster.setAgents(interaction.user.id, interaction.user.username, valid);
            let msg = `Tes agents favoris : ${valid.map(a => `**${a}**`).join(', ')}`;
            if (invalid.length) msg += `\n⚠️ Ignorés (inconnus) : ${invalid.map(a => `\`${a}\``).join(', ')}`;
            return interaction.reply(ok(msg, EPH));
        }

        if (sub === 'clear') {
            roster.clearUser(interaction.user.id);
            return interaction.reply(info('🗑️ Tes agents favoris ont été effacés.', EPH));
        }

        if (sub === 'show') {
            const target = interaction.options.getUser('joueur') || interaction.user;
            const agents = roster.getAgents(target.id);
            const embed = base(COLORS.valorant)
                .setTitle(`🎯 Agents de ${target.username}`)
                .setDescription(agents.length ? agents.map(a => `• **${a}**`).join('\n') : "_Aucun agent défini. Utilise `/roster set`._");
            return interaction.reply({ embeds: [embed], ...EPH });
        }
    }
};
