const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { base, ok, ko, COLORS } = require('../utils/embeds');
const { requirePerm, logModAction, EPH } = require('../utils/mod');
const warnings = require('../utils/warnings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Gère les avertissements des membres')
        .addSubcommand(s => s.setName('add').setDescription('Avertir un membre')
            .addUserOption(o => o.setName('membre').setDescription('Le membre à avertir').setRequired(true))
            .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('Voir les avertissements d\'un membre')
            .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true)))
        .addSubcommand(s => s.setName('clear').setDescription('Effacer les avertissements d\'un membre')
            .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client) {
        if (!await requirePerm(interaction, PermissionFlagsBits.ModerateMembers, 'Modérer les membres')) return;

        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('membre');
        const gid = interaction.guild.id;

        if (sub === 'add') {
            const reason = interaction.options.getString('raison');
            const total = warnings.add(gid, user.id, {
                reason,
                moderator: interaction.user.username,
                timestamp: Date.now(),
            });

            await user.send(`⚠️ Tu as reçu un **avertissement** sur **${interaction.guild.name}**.\nRaison : ${reason}\nTu as maintenant **${total}** avertissement(s).`).catch(() => {});

            await interaction.reply(ok(`⚠️ **${user.username}** a été averti (total : **${total}**).\nRaison : ${reason}`));
            logModAction(interaction.guild, {
                title: '⚠️ Avertissement',
                color: COLORS.warning,
                target: `${user.username} (\`${user.id}\`)`,
                moderator: `${interaction.user.username}`,
                reason,
                fields: [{ name: '🔢 Total', value: `${total}`, inline: true }],
            });
            return;
        }

        if (sub === 'list') {
            const list = warnings.list(gid, user.id);
            if (list.length === 0) return interaction.reply(ok(`**${user.username}** n'a aucun avertissement. 👼`, EPH));

            const desc = list.map((w, i) =>
                `**${i + 1}.** ${w.reason}\n   *par ${w.moderator} — <t:${Math.floor(w.timestamp / 1000)}:R>*`
            ).join('\n\n').substring(0, 4000);

            const embed = base(COLORS.warning)
                .setTitle(`⚠️ Avertissements de ${user.username} (${list.length})`)
                .setDescription(desc);
            return interaction.reply({ embeds: [embed], ...EPH });
        }

        if (sub === 'clear') {
            const n = warnings.clear(gid, user.id);
            if (n === 0) return interaction.reply(ko(`**${user.username}** n'avait aucun avertissement.`, EPH));
            await interaction.reply(ok(`🧽 **${n}** avertissement(s) effacé(s) pour **${user.username}**.`));
            logModAction(interaction.guild, {
                title: '🧽 Avertissements effacés',
                color: COLORS.success,
                target: `${user.username} (\`${user.id}\`)`,
                moderator: `${interaction.user.username}`,
                fields: [{ name: '🔢 Effacés', value: `${n}`, inline: true }],
            });
            return;
        }
    }
};
