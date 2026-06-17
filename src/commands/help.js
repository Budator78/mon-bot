const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { base, COLORS } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche toutes les commandes du bot'),

    async execute(interaction, client) {
        const embed = base(COLORS.brand)
            .setTitle('📖 Commandes du bot')
            .setDescription('Voici tout ce que je sais faire :')
            .addFields(
                {
                    name: '🎵 Musique', value: [
                        '`/play <recherche>` — joue un son, un lien ou une playlist',
                        '`/pause` `/resume` `/skip` `/stop` — contrôles de base',
                        '`/queue` — file d\'attente · `/clear` — vide la file',
                        '`/loop` — boucle · `/autoplay` — enchaînement automatique',
                        '`/filter <type>` — bassboost, nightcore, 8d, slowed…',
                        '`/hymne1` `/hymne2` — les hymnes des plots',
                    ].join('\n')
                },
                {
                    name: '🎶 Playlists', value: [
                        '`/playlist create | add | remove | delete` — gérer tes playlists',
                        '`/playlist list` — voir · `/playlist play` — lancer',
                    ].join('\n')
                },
                {
                    name: '🎮 Jeux', value: [
                        '`/pute [simulation]` — équipes + traître secret',
                        '`/teams [equipes]` — répartit le vocal en équipes',
                        '`/roster set | show | clear | agents` — tes agents Valorant',
                        '`/deadlock <pseudo ou steamid>` — stats Deadlock',
                    ].join('\n')
                },
                {
                    name: '🛡️ Modération (admins)', value: [
                        '`/kick` `/ban` `/unban` — expulser / bannir',
                        '`/timeout` `/untimeout` — rendre muet temporairement',
                        '`/purge <n>` — supprimer des messages en masse',
                        '`/warn add | list | clear` — avertissements',
                        '`/setlog #salon` — définir le salon de logs',
                    ].join('\n')
                },
                { name: '🛠️ Divers', value: '`/ping` — latence du bot · `/help` — ce menu' },
            )
            .setFooter({ text: 'Astuce : la plupart des contrôles musique sont aussi des boutons sous le lecteur.' });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
