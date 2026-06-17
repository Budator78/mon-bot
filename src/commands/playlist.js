const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');
const { base, COLORS, ok, ko, warn, info } = require('../utils/embeds');
const fs = require('fs');
const path = require('path');
const musicCommand = require('./music');

const EPH = { flags: MessageFlags.Ephemeral };

const dbPath = path.join(__dirname, '../data/playlists.json');

function saveDb(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function readDb() {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath));
}

// Fonction pour mélanger (Fisher-Yates : vraiment uniforme,
// contrairement à l'ancien sort(() => Math.random() - 0.5) qui était biaisé)
function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// --- NOUVELLE FONCTION : Récupérer toutes les playlists de tout le monde ---
function getAllPlaylists(db) {
    let all = [];
    for (const userId in db) {
        for (const name in db[userId]) {
            all.push({
                name: name,
                ownerId: userId,
                tracks: db[userId][name]
            });
        }
    }
    return all;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Gère les playlists du serveur')
        .addSubcommand(s => s.setName('create').setDescription('Créer une playlist').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist').setRequired(true)))
        .addSubcommand(s => s.setName('delete').setDescription('Supprimer une playlist (A TOI)').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist (vide = choisir)').setRequired(false)))
        .addSubcommand(s => s.setName('add')
            .setDescription('Ajoute une musique à une playlist (A TOI)')
            .addStringOption(o => o.setName('nom').setDescription('Nom de la playlist cible').setRequired(true))
            .addStringOption(o => o.setName('recherche').setDescription('Lien ou titre de la musique à ajouter').setRequired(true))
        )
        .addSubcommand(s => s.setName('remove').setDescription('Retire une musique').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist').setRequired(true)).addIntegerOption(o => o.setName('numero').setDescription('Numéro de la musique').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('Affiche une playlist ou la liste de TOUTES les playlists').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist (laisser vide pour tout voir)').setRequired(false)))
        .addSubcommand(s => s.setName('play')
            .setDescription('Lance une playlist')
            .addStringOption(o => o.setName('nom').setDescription('Nom de la playlist (vide = choisir)').setRequired(false))
            .addBooleanOption(o => o.setName('aleatoire').setDescription('Mélanger la playlist ?').setRequired(false))
        ),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        let name = interaction.options.getString('nom'); 
        const userId = interaction.user.id;
        
        let db = readDb();
        if (!db[userId]) db[userId] = {}; 

        // --- PLAY (Modifié pour voir tout le monde) ---
        if (sub === 'play') {
            const shuffleMode = interaction.options.getBoolean('aleatoire') || false;
            const allPlaylists = getAllPlaylists(db);

            // Menu de sélection GLOBAL
            if (!name) {
                if (allPlaylists.length === 0) return interaction.reply(info("Aucune playlist sur le serveur.", EPH));

                // On prépare les options (max 25 pour Discord)
                const options = allPlaylists.slice(0, 25).map(p => ({
                    label: p.name.substring(0, 100),
                    // On met l'ID du créateur dans la description
                    description: `${p.tracks.length} titres | Par <@${p.ownerId}>`.substring(0, 100), 
                    value: p.name // On renvoie juste le nom
                }));

                const select = new StringSelectMenuBuilder()
                    .setCustomId('playlist_play_select')
                    .setPlaceholder('Choisis une playlist à lancer')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(select);
                const msg = await interaction.reply({ content: "🌍 Quelle playlist du serveur lancer ?", components: [row], ephemeral: true });

                try {
                    const selection = await msg.awaitMessageComponent({ time: 30000, componentType: ComponentType.StringSelect });
                    name = selection.values[0]; 
                    await selection.deferUpdate();
                } catch (e) {
                    return interaction.editReply(warn("Temps écoulé !", { content: null, components: [] }));
                }
            }

            // --- RECHERCHE INTELLIGENTE ---
            // 1. On cherche d'abord dans MES playlists
            let targetTracks = null;
            let ownerName = "toi";

            if (db[userId][name]) {
                targetTracks = db[userId][name];
            } else {
                // 2. Sinon, on cherche chez les AUTRES
                for (const otherId in db) {
                    if (db[otherId][name]) {
                        targetTracks = db[otherId][name];
                        ownerName = `<@${otherId}>`; // On note à qui elle est
                        break;
                    }
                }
            }

            if (!targetTracks) return interaction.followUp(ko(`Playlist **${name}** introuvable sur le serveur.`, EPH));
            if (targetTracks.length === 0) return interaction.followUp(ko("Cette playlist est vide."));

            if (!interaction.member.voice.channel) return interaction.followUp(ko('Tu dois être en vocal !', EPH));

            const replyMethod = interaction.replied ? 'editReply' : 'reply';
            
            if (shuffleMode) {
                targetTracks = shuffle(targetTracks);
                await interaction[replyMethod](info(`🔀 Chargement de **${name}** (de ${ownerName}) en mode **Aléatoire**...`, { content: null, components: [] }));
            } else {
                await interaction[replyMethod](info(`▶️ Chargement de **${name}** (de ${ownerName})...`, { content: null, components: [] }));
            }

            // Reconstruction pour Lavalink
            const tracksToPlay = targetTracks.map(t => ({
                encoded: t.encoded,
                info: {
                    title: t.title,
                    uri: t.uri,
                    author: t.author,
                    length: t.length || 0, 
                    identifier: t.identifier,
                    sourceName: t.sourceName,
                    artworkUrl: null 
                }
            }));

            // Connexion et lecture
            const guildId = interaction.guild.id;
            const userChannelId = interaction.member.voice.channel.id;
            let data = musicCommand.musicQueues.get(guildId);

            if (!data) {
                const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
                if (!node) return interaction.editReply(ko('Lavalink non disponible.'));
                // Création factorisée (mêmes événements que /play : start, barre de progression, etc.)
                data = await musicCommand.createPlayerData(client, guildId, userChannelId, interaction.channel);
            }

            const wasEmpty = data.queue.length === 0;
            for (const t of tracksToPlay) { t.requester = interaction.user; data.queue.push(t); }

            if (wasEmpty) {
                data.player.playTrack({ track: { encoded: data.queue[0].encoded } });
                // La carte s'affiche via l'événement 'start' du player.
            } else {
                musicCommand.updateMusicMessage(guildId, interaction.channel);
            }

            return interaction.editReply(ok(`Playlist **${name}** (${tracksToPlay.length} titres) ajoutée !`));
        }

        // --- LISTER (Modifié pour voir tout le monde) ---
        if (sub === 'list') {
            const allPlaylists = getAllPlaylists(db);

            if (!name) {
                if (allPlaylists.length === 0) return interaction.reply(info("Aucune playlist sur le serveur. Crée-en une avec `/playlist create` !"));

                // On formate l'affichage : "• Nom (5 sons) - Par @Pseudo"
                const listString = allPlaylists.map(p => {
                    const isMine = p.ownerId === userId ? " (⭐ C'est toi)" : ` (par <@${p.ownerId}>)`;
                    return `• **${p.name}** — \`${p.tracks.length}\` titre(s)${isMine}`;
                }).join('\n');

                const embed = base(COLORS.brand)
                    .setTitle(`🌍 Playlists du serveur · ${allPlaylists.length}`)
                    .setDescription(listString.substring(0, 4096))
                    .setFooter({ text: "Lance-en une avec /playlist play" });
                return interaction.reply({ embeds: [embed] });
            }

            // Recherche de la playlist spécifique (Même logique que Play)
            let targetTracks = null;
            if (db[userId][name]) targetTracks = db[userId][name];
            else {
                for (const otherId in db) {
                    if (db[otherId][name]) {
                        targetTracks = db[otherId][name];
                        break;
                    }
                }
            }

            if (!targetTracks) return interaction.reply(ko(`Playlist **${name}** introuvable.`, EPH));

            const description = targetTracks.map((t, i) => `**${i + 1}.** [${t.title}](${t.uri})`).join('\n').substring(0, 4000);

            const embed = base(COLORS.brand)
                .setTitle(`📜 Playlist : ${name}`)
                .setDescription(description || "_Playlist vide._")
                .setFooter({ text: `${targetTracks.length} titre(s)` });

            if (targetTracks[0]) {
                const thumb = musicCommand.getThumbnail({ info: targetTracks[0] });
                if (thumb) embed.setThumbnail(thumb);
            }

            return interaction.reply({ embeds: [embed] });
        }

        // --- CRÉER ---
        if (sub === 'create') {
            if (!name) return interaction.reply(ko("Nom obligatoire.", EPH));
            if (db[userId][name]) return interaction.reply(ko(`Tu as déjà une playlist nommée **${name}** !`, EPH));
            db[userId][name] = [];
            saveDb(db);
            return interaction.reply(ok(`Playlist **${name}** créée !`));
        }

        // --- SUPPRIMER (Restreint à TES playlists) ---
        if (sub === 'delete') {
            // Ici on ne liste QUE les tiennes, pas celles des autres
            const myPlaylistNames = Object.keys(db[userId]);

            if (!name) {
                if (myPlaylistNames.length === 0) return interaction.reply(info("Tu n'as aucune playlist à supprimer.", EPH));

                const select = new StringSelectMenuBuilder()
                    .setCustomId('playlist_delete_select')
                    .setPlaceholder('Choisis une playlist à SUPPRIMER')
                    .addOptions(myPlaylistNames.map(n => ({
                        label: n,
                        description: `🗑️ Supprimer (${db[userId][n].length} titres)`,
                        value: n
                    })));

                const row = new ActionRowBuilder().addComponents(select);
                const msg = await interaction.reply({ content: "⚠️ Quelle playlist (à toi) veux-tu supprimer ?", components: [row], ephemeral: true });

                try {
                    const selection = await msg.awaitMessageComponent({ time: 30000, componentType: ComponentType.StringSelect });
                    name = selection.values[0]; 
                    await selection.deferUpdate();
                } catch (e) {
                    return interaction.editReply(warn("Temps écoulé !", { content: null, components: [] }));
                }
            }

            if (!db[userId][name]) return interaction.followUp(ko(`Tu ne possèdes pas de playlist nommée **${name}**.`, EPH));

            delete db[userId][name];
            saveDb(db);

            const replyMethod = interaction.replied ? 'editReply' : 'reply';
            return interaction[replyMethod](ok(`Ta playlist **${name}** a été supprimée.`, { content: null, components: [] }));
        }

        // --- AJOUTER (Restreint à TES playlists) ---
        if (sub === 'add') {
            if (!name) return interaction.reply(ko("Nom manquant.", EPH));

            // On vérifie d'abord si c'est TA playlist
            if (!db[userId][name]) {
                // Petit bonus : on vérifie si elle existe chez un autre pour expliquer pourquoi ça marche pas
                let existsElsewhere = false;
                for (const id in db) if (db[id][name]) existsElsewhere = true;

                if (existsElsewhere) return interaction.reply(ko(`La playlist **${name}** appartient à quelqu'un d'autre. Tu ne peux pas la modifier !`, EPH));
                return interaction.reply(ko(`Tu n'as pas de playlist nommée **${name}**.`, EPH));
            }

            const query = interaction.options.getString('recherche');
            await interaction.deferReply();

            const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
            const isUrl = query.startsWith('http');
            const search = isUrl ? query : `ytsearch:${query}`;
            const result = await node.rest.resolve(search);

            if (!result || result.loadType === 'empty' || result.loadType === 'error') {
                return interaction.editReply(ko('Rien trouvé.'));
            }

            let trackToAdd = null;
            const rawData = result.tracks || result.data;

            if (result.loadType === 'playlist' || result.loadType === 'playlist_loaded') {
                const tracks = Array.isArray(rawData) ? rawData : rawData.tracks;
                for (const t of tracks) {
                     db[userId][name].push({
                        title: t.info.title,
                        uri: t.info.uri,
                        author: t.info.author,
                        encoded: t.encoded,
                        identifier: t.info.identifier,
                        sourceName: t.info.sourceName,
                        length: t.info.length 
                    });
                }
                saveDb(db);
                return interaction.editReply(ok(`Ajouté **${tracks.length} titres** à **${name}** !`));

            } else if (result.loadType === 'search' || result.loadType === 'search_result') {
                const searchResults = Array.isArray(rawData) ? rawData : rawData;
                const top3 = searchResults.slice(0, 3);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('playlist_add_select')
                    .setPlaceholder('Quelle musique ajouter ?')
                    .addOptions(top3.map((track, i) => ({
                        label: track.info.title.substring(0, 100),
                        description: track.info.author.substring(0, 100),
                        value: i.toString()
                    })));

                const msg = await interaction.editReply({ 
                    content: `🔍 Résultats pour "${query}" :`, 
                    components: [new ActionRowBuilder().addComponents(selectMenu)] 
                });

                try {
                    const filter = i => i.user.id === interaction.user.id;
                    const selection = await msg.awaitMessageComponent({ filter, time: 30000, componentType: ComponentType.StringSelect });
                    
                    const index = parseInt(selection.values[0]);
                    trackToAdd = top3[index];
                    await selection.deferUpdate();
                } catch (e) {
                    return interaction.editReply(warn('Temps écoulé !', { content: null, components: [] }));
                }

            } else {
                trackToAdd = Array.isArray(rawData) ? rawData[0] : rawData;
            }

            if (trackToAdd) {
                db[userId][name].push({
                    title: trackToAdd.info.title,
                    uri: trackToAdd.info.uri,
                    author: trackToAdd.info.author,
                    encoded: trackToAdd.encoded,
                    identifier: trackToAdd.info.identifier,
                    sourceName: trackToAdd.info.sourceName,
                    length: trackToAdd.info.length 
                });
                saveDb(db);
                await interaction.editReply(ok(`Ajouté **${trackToAdd.info.title}** à **${name}** !`, { content: null, components: [] }));
            }
        }

        // --- RETIRER ---
        if (sub === 'remove') {
            if (!name) return interaction.reply(ko("Nom manquant.", EPH));
            if (!db[userId][name]) return interaction.reply(ko("Tu ne peux modifier que tes playlists.", EPH));

            const index = interaction.options.getInteger('numero') - 1;
            const tracks = db[userId][name];
            if (index < 0 || index >= tracks.length) return interaction.reply(ko("Numéro invalide.", EPH));

            const removed = tracks.splice(index, 1)[0];
            saveDb(db);
            return interaction.reply(ok(`Retiré **${removed.title}** de **${name}**.`));
        }
    }
};