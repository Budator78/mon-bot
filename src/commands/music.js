const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, MessageFlags, ActivityType } = require('discord.js');
const { base, COLORS, info, ok, ko, warn, progressBar } = require('../utils/embeds');
const playlistsUtil = require('../utils/playlists');

const musicQueues = new Map();

// Référence au client, pour mettre à jour le statut du bot.
let botClient = null;

// Statut du bot : "Écoute <titre>" pendant la lecture, sinon présence par défaut.
function setPresence(title) {
    if (!botClient || !botClient.user) return;
    try {
        botClient.user.setActivity({
            name: title ? title.substring(0, 120) : '/help 🎵',
            type: ActivityType.Listening
        });
    } catch (e) {}
}

// Arrête la boucle de rafraîchissement de la barre de progression.
function stopProgressLoop(d) {
    if (d && d.npInterval) { clearInterval(d.npInterval); d.npInterval = null; }
}

// Branche tous les événements d'un player (fin de titre, démarrage + barre
// de progression live, et diagnostics). Partagé par /play et /playlist.
function wirePlayerEvents(player, guildId) {
    player.on('end', async () => {
        const d = musicQueues.get(guildId);
        if (!d) return;
        d.lastPlayed = d.queue[0] || d.lastPlayed; // mémorise le titre qui vient de finir
        if (!d.loop) d.queue.shift();
        if (d.queue.length > 0) {
            const nextTrackCode = d.queue[0].encoded || d.queue[0].track;
            d.player.playTrack({ track: { encoded: nextTrackCode } });
            // La carte se rafraîchira via l'événement 'start'.
        } else if (d.autoplay) {
            console.log('[Autoplay] 🔄 File vide -> recherche d\'un titre similaire...');
            await autoplayNext(d, guildId); // enchaîne un titre similaire
        } else {
            console.log('[Autoplay] File vide, autoplay désactivé -> arrêt.');
            stopProgressLoop(d); // plus rien à jouer
            setPresence(null); // retour au statut par défaut
        }
    });

    player.on('start', () => {
        const d = musicQueues.get(guildId);
        if (!d) return;
        console.log('[Player START] ✅ Lecture démarrée côté Lavalink');
        setPresence(d.queue[0] && d.queue[0].info.title); // statut "Écoute <titre>"
        module.exports.updateMusicMessage(guildId, d.channel);
        stopProgressLoop(d);
        d.npInterval = setInterval(() => {
            const dd = musicQueues.get(guildId);
            if (!dd || !dd.player || !dd.player.track) return stopProgressLoop(dd);
            if (dd.player.paused) return; // inutile de rafraîchir en pause
            module.exports.updateMusicMessage(guildId, dd.channel);
        }, 8000);
    });

    player.on('exception', (e) => console.error('[Player EXCEPTION] ❌', JSON.stringify(e)));
    player.on('stuck', (e) => console.error('[Player STUCK] ⚠️', JSON.stringify(e)));
    player.on('closed', (e) => console.error('[Voice CLOSED] 🔌 Discord a fermé le vocal:', JSON.stringify(e)));
}

// Rejoint le vocal, crée l'état de file et branche les événements. Renvoie l'objet data.
async function createPlayerData(client, guildId, voiceChannelId, textChannel) {
    botClient = client; // mémorise le client pour le statut du bot
    const player = await client.shoukaku.joinVoiceChannel({ guildId, channelId: voiceChannelId, shardId: 0 });
    const data = { player, queue: [], loop: false, volume: 100, autoplay: false, lastPlayed: null, recent: [], npMessage: null, npInterval: null, aloneTimer: null, channel: textChannel, voiceChannelId };
    musicQueues.set(guildId, data);
    wirePlayerEvents(player, guildId);
    return data;
}

// Déconnexion auto : appelé à chaque changement d'état vocal. Si le salon du bot
// n'a plus d'humain, on lance un compte à rebours avant de quitter.
function handleVoiceUpdate(client, oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    const data = musicQueues.get(guild.id);
    if (!data || !data.voiceChannelId) return;

    const channel = guild.channels.cache.get(data.voiceChannelId);
    const humans = channel ? channel.members.filter(m => !m.user.bot).size : 0;

    if (humans > 0) {
        // Quelqu'un est (re)venu : on annule un éventuel compte à rebours.
        if (data.aloneTimer) { clearTimeout(data.aloneTimer); data.aloneTimer = null; }
        return;
    }

    // Plus personne : on programme la déconnexion (si pas déjà programmée).
    if (data.aloneTimer) return;
    data.aloneTimer = setTimeout(() => {
        const d = musicQueues.get(guild.id);
        if (!d) return;
        const ch = guild.channels.cache.get(d.voiceChannelId);
        const stillEmpty = !ch || ch.members.filter(m => !m.user.bot).size === 0;
        d.aloneTimer = null;
        if (!stillEmpty) return;

        stopProgressLoop(d);
        if (d.npMessage) d.npMessage.delete().catch(() => {});
        try { d.player.stopTrack(); } catch (e) {}
        try { client.shoukaku.leaveVoiceChannel(guild.id); } catch (e) {}
        musicQueues.delete(guild.id);
        setPresence(null);
        if (d.channel) d.channel.send(info('👋 Plus personne dans le vocal, je me déconnecte.')).catch(() => {});
    }, 60000); // 60 secondes
}

// Normalise la réponse de resolve() en tableau de tracks (search / playlist / single).
function extractTracks(res) {
    if (!res) return [];
    const data = res.data;
    if (Array.isArray(data)) return data;                       // recherche
    if (data && Array.isArray(data.tracks)) return data.tracks; // playlist (radio Mix)
    if (Array.isArray(res.tracks)) return res.tracks;           // ancien format
    if (data) return [data];                                    // titre unique
    return [];
}

// Autoplay : file vide -> enchaîne un VRAI titre similaire via la radio "Mix" de YouTube.
async function autoplayNext(d, guildId) {
    try {
        const last = d.lastPlayed;
        if (!last || !d.player || !d.player.node) {
            console.log('[Autoplay] ⚠️ Abandon : pas de dernier titre ou de nœud.');
            return stopProgressLoop(d);
        }

        // On évite de rejouer le titre qui vient de passer.
        d.recent = d.recent || [];
        const seedId = last.info && last.info.identifier;
        if (seedId && !d.recent.includes(seedId)) d.recent.push(seedId);

        let pool = [];

        // 1. Radio "Mix" YouTube (playlist RD<id>) = vrais titres similaires et variés.
        const isYt = last.info && (last.info.sourceName === 'youtube' || (last.info.uri || '').includes('youtu'));
        if (seedId && isYt) {
            const radio = `https://www.youtube.com/watch?v=${seedId}&list=RD${seedId}`;
            pool = extractTracks(await d.player.node.rest.resolve(radio));
        }

        // 2. Repli : recherche par artiste si la radio n'a rien donné (ou source non-YouTube).
        if (pool.length === 0) {
            pool = extractTracks(await d.player.node.rest.resolve(`ytsearch:${last.info.author || ''} ${last.info.title || ''}`));
        }

        // On retire le titre source et tout ce qui a été joué récemment.
        pool = pool.filter(t => t && t.info && t.info.identifier && !d.recent.includes(t.info.identifier));
        if (pool.length === 0) {
            console.log('[Autoplay] ⚠️ Aucun titre similaire trouvé.');
            return stopProgressLoop(d);
        }

        // On pioche parmi les 10 premiers (les plus pertinents) pour garder de la variété.
        const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 10))];
        pick.autoplay = true;
        d.queue.push(pick);
        d.recent.push(pick.info.identifier);
        if (d.recent.length > 30) d.recent.shift();

        console.log('[Autoplay] ✅ Ajout :', pick.info.title, '—', pick.info.author);
        d.player.playTrack({ track: { encoded: pick.encoded } });
    } catch (e) {
        console.error('[Autoplay] ❌', e.message);
        stopProgressLoop(d);
    }
}

// --- FONCTIONS UTILITAIRES ---
function formatTime(ms) {
    if (!ms || isNaN(ms) || ms < 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function getThumbnail(track) {
    if (track.info.artworkUrl) return track.info.artworkUrl;
    if (track.info.sourceName === 'youtube' || track.info.uri.includes('youtube') || track.info.uri.includes('youtu.be')) {
        return `https://img.youtube.com/vi/${track.info.identifier}/hqdefault.jpg`;
    }
    return null;
}
// -----------------------------

const musicCommand = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Joue de la musique')
        .addStringOption(option => option.setName('query').setDescription('Lien ou recherche').setRequired(true)),

    async execute(interaction, client) {
        await this.handlePlay(interaction, client, interaction.options.getString('query'));
    },

    async updateMusicMessage(guildId, channel, forcePauseState = null) {
        const data = musicQueues.get(guildId);
        if (!data || !data.player || data.queue.length === 0) return;

        const currentTrack = data.queue[0];
        const artworkUrl = getThumbnail(currentTrack);
        const isPaused = forcePauseState !== null ? forcePauseState : data.player.paused;

        const length = Number(currentTrack.info.length) || 0;
        const position = Math.min(Number(data.player.position) || 0, length);
        const requester = currentTrack.autoplay ? '🤖 Autoplay'
            : (currentTrack.requester ? `<@${currentTrack.requester.id}>` : 'Inconnu');

        const embed = base(COLORS.music)
            .setAuthor({ name: isPaused ? '⏸️  En pause' : '🎵  Lecture en cours' })
            .setTitle((currentTrack.info.title || 'Titre inconnu').substring(0, 256))
            .setURL(currentTrack.info.uri || null)
            .setDescription(`\`${formatTime(position)}\` ${progressBar(position, length)} \`${formatTime(length)}\``)
            .addFields(
                { name: '👤 Artiste', value: `${currentTrack.info.author || 'Inconnu'}`, inline: true },
                { name: '🙋 Demandé par', value: requester, inline: true },
                { name: '📜 En file', value: `${data.queue.length - 1} titre(s)`, inline: true },
                { name: '🔁 Boucle', value: data.loop ? 'Activée' : 'Désactivée', inline: true },
            );

        if (artworkUrl) embed.setThumbnail(artworkUrl);
        if (data.autoplay) embed.setFooter({ text: '🤖 Autoplay activé' });

        const pauseResumeBtn = new ButtonBuilder()
            .setCustomId(isPaused ? 'music_resume' : 'music_pause')
            .setLabel(isPaused ? 'Reprendre' : 'Pause')
            .setEmoji(isPaused ? '▶️' : '⏸️')
            .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(
            pauseResumeBtn,
            new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('music_loop').setLabel('Loop').setEmoji(data.loop ? '🔁' : '➡️').setStyle(data.loop ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_mix').setLabel('Mix').setEmoji('🔀').setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_rewind').setLabel('-10s').setEmoji('⏪').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_forward').setLabel('+10s').setEmoji('⏩').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_queue').setLabel('Liste').setEmoji('📜').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_clear').setLabel('Vider').setEmoji('🗑️').setStyle(ButtonStyle.Secondary)
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_autoplay').setLabel('Autoplay').setEmoji('🤖').setStyle(data.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_addpl').setLabel('Ajouter à une playlist').setEmoji('➕').setStyle(ButtonStyle.Secondary)
        );

        const payload = { embeds: [embed], components: [row1, row2, row3] };

        // On ÉDITE le message existant (au lieu de supprimer + renvoyer) :
        // la carte reste en place et la barre de progression avance.
        try {
            if (data.npMessage) {
                await data.npMessage.edit(payload);
                return;
            }
        } catch (e) {
            data.npMessage = null; // message supprimé entre-temps : on en renvoie un neuf
        }
        try {
            data.npMessage = await (channel || data.channel).send(payload);
        } catch (error) {
            console.error("Erreur update:", error.message);
        }
    },

    async handlePlay(interaction, client, query) {
        // On accuse réception TOUT DE SUITE (avant toute logique) pour éviter
        // l'erreur 10062 "Unknown interaction" (Discord coupe au bout de 3 s).
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        } catch (e) {
            return; // Interaction déjà expirée : on abandonne proprement.
        }

        if (!interaction.member.voice.channel) return interaction.editReply(ko('Tu dois être en vocal !'));

        const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
        if (!node) return interaction.editReply(ko('Lavalink non disponible.'));

        const isUrl = query.startsWith('http');
        const search = isUrl ? query : `ytsearch:${query}`;

        const result = await node.rest.resolve(search);
        
        if (!result || result.loadType === 'empty' || result.loadType === 'error') {
            return interaction.editReply(ko('Rien trouvé ! (Essaie un lien direct si la recherche échoue)'));
        }

        let tracks = [];
        const type = result.loadType.toLowerCase();
        const rawData = result.tracks || result.data; 

        if (type === 'playlist' || type === 'playlist_loaded') {
            tracks = Array.isArray(rawData) ? rawData : rawData.tracks;
            const playlistName = result.playlistInfo ? result.playlistInfo.name : "Playlist Inconnue";
            await interaction.editReply(ok(`Playlist chargée : **${playlistName}** (${tracks.length} sons)`));
        } 
        else if (type === 'search' || type === 'search_result') {
            const searchResults = Array.isArray(rawData) ? rawData : rawData;
            const top3 = searchResults.slice(0, 3);
            
            // CORRECTION ICI : 'music_select' devient 'search_select'
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('search_select') 
                .setPlaceholder('Choisis une musique')
                .addOptions(top3.map((track, i) => ({
                    label: track.info.title ? track.info.title.substring(0, 100) : "Sans titre",
                    description: track.info.author ? track.info.author.substring(0, 100) : "Inconnu",
                    value: i.toString()
                })));
            
            const msg = await interaction.editReply({ content: 'Choisis parmi ces 3 résultats :', components: [new ActionRowBuilder().addComponents(selectMenu)] });
            
            try {
                const filter = i => i.user.id === interaction.user.id;
                const selection = await msg.awaitMessageComponent({ filter, time: 30000, componentType: ComponentType.StringSelect });
                
                await selection.deferUpdate().catch(() => {}); 
                
                const index = parseInt(selection.values[0]);
                tracks = [top3[index]];

                await interaction.editReply(ok(`Ajouté : **${tracks[0].info.title}**`, { content: null, components: [] }));

            } catch (e) {
                if (e.code === 'InteractionCollectorError' || (e.message && e.message.includes('time'))) {
                    return interaction.editReply(warn('Temps écoulé !', { content: null, components: [] }));
                }
                return;
            }

        } else {
            tracks = [Array.isArray(rawData) ? rawData[0] : rawData];
            await interaction.editReply(ok(`Ajouté : **${tracks[0].info.title}**`));
        }

        if (!tracks || tracks.length === 0) return;

        const guildId = interaction.guild.id;
        const userChannelId = interaction.member.voice.channel.id;
        let data = musicQueues.get(guildId);
        
        if (data && data.player && data.voiceChannelId !== userChannelId) {
            data.player = await client.shoukaku.joinVoiceChannel({
                guildId: guildId,
                channelId: userChannelId,
                shardId: 0
            });
            data.voiceChannelId = userChannelId;
            data.channel = interaction.channel;
        }

        if (!data) {
            data = await createPlayerData(client, guildId, userChannelId, interaction.channel);
        }

        // On retient qui a demandé chaque titre.
        // wasEmpty = rien dans la file AVANT l'ajout => il faut démarrer la lecture.
        // (Plus fiable que data.player.track qui peut rester "occupé" après une fin de piste.)
        const wasEmpty = data.queue.length === 0;
        for (const track of tracks) { track.requester = interaction.user; data.queue.push(track); }

        if (wasEmpty) {
            const trackCode = data.queue[0].encoded || data.queue[0].track;
            if (!trackCode) return interaction.channel.send(ko('Erreur de format de la playlist.'));

            data.player.playTrack({ track: { encoded: trackCode } });
            // La carte s'affiche via l'événement 'start'.
        } else {
            this.updateMusicMessage(guildId, interaction.channel); // déjà en lecture : on rafraîchit la file
        }
    },

    async handleInteraction(interaction, client) {
        const isButton = interaction.isButton();
        try {
            if (isButton) await interaction.deferUpdate();
            else await interaction.reply({ content: 'Chargement...', flags: MessageFlags.Ephemeral });
        } catch (error) { return; }

        const gid = interaction.guild.id;
        const data = musicQueues.get(gid);
        const action = interaction.customId.replace('music_', '');

        // Réponse côté commande slash uniquement (le clic bouton met déjà la carte à jour).
        const slashReply = (payload) => { if (!isButton) interaction.editReply(payload).catch(() => {}); };
        // Réponse dans tous les cas (slash = editReply, bouton = message éphémère discret).
        const anyReply = (payload) => {
            if (isButton) interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
            else interaction.editReply(payload).catch(() => {});
        };

        if (!data) return anyReply(ko('Aucune musique en cours.'));

        switch (action) {
            case 'pause':
                data.player.setPaused(true);
                this.updateMusicMessage(gid, interaction.channel, true);
                return slashReply(info('⏸️ Musique mise en pause.'));

            case 'resume':
                data.player.setPaused(false);
                this.updateMusicMessage(gid, interaction.channel, false);
                return slashReply(info('▶️ Lecture reprise.'));

            case 'skip':
                if (data.loop) data.queue.shift();
                data.player.stopTrack(); // déclenche 'end' -> titre suivant -> 'start' rafraîchit la carte
                return slashReply(info('⏭️ Titre passé.'));

            case 'stop':
                stopProgressLoop(data);
                if (data.aloneTimer) clearTimeout(data.aloneTimer);
                if (data.npMessage) data.npMessage.delete().catch(() => {});
                data.queue = [];
                data.player.stopTrack();
                client.shoukaku.leaveVoiceChannel(gid);
                musicQueues.delete(gid);
                setPresence(null);
                return anyReply(info('⏹️ Lecture arrêtée, le bot quitte le vocal.'));

            case 'loop':
                data.loop = !data.loop;
                this.updateMusicMessage(gid, interaction.channel);
                return slashReply(info(data.loop ? '🔁 Boucle activée.' : '➡️ Boucle désactivée.'));

            case 'mix': {
                if (data.queue.length <= 2) return anyReply(warn("Pas assez de titres en file pour mélanger."));
                const rest = data.queue.slice(1);
                for (let i = rest.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [rest[i], rest[j]] = [rest[j], rest[i]];
                }
                data.queue = [data.queue[0], ...rest];
                this.updateMusicMessage(gid, interaction.channel);
                return slashReply(info("🔀 File d'attente mélangée."));
            }

            case 'volup':
            case 'voldown': {
                const cur = data.volume ?? 100;
                const next = Math.min(150, Math.max(0, cur + (action === 'volup' ? 10 : -10)));
                data.volume = next;
                try { await data.player.setGlobalVolume(next); } catch (e) {}
                this.updateMusicMessage(gid, interaction.channel);
                return slashReply(info(`🔊 Volume réglé à ${next}%`));
            }

            case 'rewind':
            case 'forward': {
                const length = Number(data.queue[0] && data.queue[0].info.length) || 0;
                const cur = Number(data.player.position) || 0;
                let next = cur + (action === 'forward' ? 10000 : -10000);
                next = Math.max(0, length ? Math.min(next, length) : next);
                try { await data.player.seekTo(next); data.player.position = next; } catch (e) {}
                this.updateMusicMessage(gid, interaction.channel);
                return slashReply(info(`${action === 'forward' ? '⏩' : '⏪'} Position : ${formatTime(next)}`));
            }

            case 'autoplay':
                data.autoplay = !data.autoplay;
                this.updateMusicMessage(gid, interaction.channel);
                return slashReply(info(data.autoplay
                    ? "🤖 Autoplay activé — j'enchaînerai des sons similaires quand la file sera vide."
                    : "⏹️ Autoplay désactivé."));

            case 'clear': {
                if (data.queue.length <= 1) return anyReply(warn("La file d'attente est déjà vide."));
                const removed = data.queue.length - 1;
                data.queue = [data.queue[0]];
                this.updateMusicMessage(gid, interaction.channel);
                return anyReply(info(`🗑️ File vidée — ${removed} titre(s) retiré(s).`));
            }

            case 'addpl': {
                const current = data.queue[0];
                if (!current) return anyReply(ko('Aucun titre en cours.'));

                const pls = playlistsUtil.userPlaylists(interaction.user.id);
                const names = Object.keys(pls);
                if (names.length === 0) return anyReply(ko("Tu n'as aucune playlist. Crée-en une avec `/playlist create`."));

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('addpl_select')
                    .setPlaceholder('Choisis une playlist')
                    .addOptions(names.slice(0, 25).map(n => ({
                        label: n.substring(0, 100),
                        description: `${pls[n].length} titre(s)`,
                        value: n
                    })));

                const prompt = await interaction.followUp({
                    content: `➕ Ajouter **${(current.info.title || 'ce titre').substring(0, 80)}** à quelle playlist ?`,
                    components: [new ActionRowBuilder().addComponents(menu)],
                    flags: MessageFlags.Ephemeral
                });

                try {
                    const sel = await prompt.awaitMessageComponent({
                        filter: i => i.user.id === interaction.user.id,
                        time: 30000,
                        componentType: ComponentType.StringSelect
                    });
                    const name = sel.values[0];
                    const stored = {
                        title: current.info.title, uri: current.info.uri, author: current.info.author,
                        encoded: current.encoded, identifier: current.info.identifier,
                        sourceName: current.info.sourceName, length: current.info.length
                    };
                    const added = playlistsUtil.addTrack(interaction.user.id, name, stored);
                    await sel.update({
                        content: null,
                        embeds: [added
                            ? base(COLORS.success).setDescription(`✅ **${current.info.title}** ajouté à **${name}** !`)
                            : base(COLORS.error).setDescription("❌ Échec : playlist introuvable.")],
                        components: []
                    });
                } catch (e) {
                    interaction.webhook.editMessage(prompt.id, { content: '⏱️ Temps écoulé.', components: [] }).catch(() => {});
                }
                return;
            }

            case 'queue': {
                const current = data.queue[0];
                const nextSongs = data.queue.slice(1, 11);
                const totalDuration = data.queue.reduce((acc, t) => acc + (Number(t.info.length) || 0), 0);
                const length = Number(current.info.length) || 0;
                const position = Math.min(Number(data.player.position) || 0, length);

                const queueEmbed = base(COLORS.music)
                    .setTitle(`📜 File d'attente · ${data.queue.length} titre(s)`)
                    .setDescription(
                        `**En cours :**\n[${current.info.title}](${current.info.uri})\n` +
                        `\`${formatTime(position)}\` ${progressBar(position, length)} \`${formatTime(length)}\``
                    )
                    .setFooter({ text: `Durée totale : ${formatTime(totalDuration)}` });

                const thumb = getThumbnail(current);
                if (thumb) queueEmbed.setThumbnail(thumb);

                let listString = "_Rien à suivre — ajoutez des sons !_";
                if (nextSongs.length > 0) {
                    listString = nextSongs.map((t, i) =>
                        `**${i + 1}.** [${(t.info.title || 'Sans titre').substring(0, 45)}](${t.info.uri}) · \`${formatTime(t.info.length)}\``
                    ).join('\n');
                }
                queueEmbed.addFields({ name: '⏭️ À suivre', value: String(listString).substring(0, 1024) });

                return anyReply({ embeds: [queueEmbed] });
            }
        }
    }
};

module.exports = musicCommand;
module.exports.musicQueues = musicQueues;
module.exports.getThumbnail = getThumbnail;
module.exports.formatTime = formatTime;
module.exports.createPlayerData = createPlayerData;
module.exports.handleVoiceUpdate = handleVoiceUpdate;
module.exports.setPresence = setPresence;