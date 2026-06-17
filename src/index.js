const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, Partials } = require('discord.js');
const { Shoukaku, Connectors } = require('shoukaku');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const { registerLogging } = require('./logging');

// Token : priorité à la variable d'environnement (serveur), sinon config.json (local).
const TOKEN = process.env.DISCORD_TOKEN || config.token;

// --- ANTI-CRASH SYSTEM (GLOBAL) ---
process.on('unhandledRejection', (reason, p) => {
    console.log('[Anti-Crash] : Erreur non gérée (Rejection)');
    console.log(reason);
});
process.on('uncaughtException', (err, origin) => {
    console.log('[Anti-Crash] : Erreur critique (Exception)');
    console.log(err);
});
// ----------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,   // logs de bannissements
        GatewayIntentBits.MessageContent     // contenu des messages (logs) — PRIVILÉGIÉ : à activer dans le portail Dev
    ],
    // Partials : permet de recevoir les events sur des messages non mis en cache.
    partials: [Partials.Message, Partials.Channel]
});

// Active tous les logs serveur (arrivées/départs, messages, vocal).
registerLogging(client);

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Chargement des commandes
const commands = [];
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.log(`[AVERTISSEMENT] La commande dans ${file} manque de "data" ou "execute".`);
    }
}

// Configuration Lavalink
const Nodes = config.lavalink;
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, {
    reconnectTries: 60,     // réessaie longtemps (VM lente : Lavalink met ~2 min à démarrer)
    reconnectInterval: 5,   // une tentative toutes les 5 s (~300 s au total)
    restTimeout: 60
});
client.shoukaku = shoukaku;

shoukaku.on('error', (_, error) => console.error('Lavalink error:', error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} is ready`));

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    // Statut par défaut du bot (mis à jour avec le titre en cours pendant la lecture).
    client.user.setActivity({ name: '/help 🎵', type: ActivityType.Listening });

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('Rafraîchissement des commandes slash...');
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands },
        );
        console.log('Commandes enregistrées !');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    // Gestion des Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error("Erreur commande:", error);
            // CORRECTION: On vérifie l'état avant de répondre
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Une erreur est survenue lors de l\'exécution.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: 'Une erreur est survenue lors de l\'exécution.', ephemeral: true }).catch(() => {});
            }
        }
    } 
    // Gestion des Boutons
    else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const commandName = interaction.customId.split('_')[0]; 
        let targetCommand = commandName;
        
        if(['play', 'pause', 'resume', 'stop', 'loop', 'queue', 'skip', 'music'].includes(commandName)) {
            targetCommand = 'play';
        }

        const command = client.commands.get(targetCommand); 
        if (command && command.handleInteraction) {
            try {
                await command.handleInteraction(interaction, client);
            } catch (error) {
                console.error("Erreur interaction:", error);
            }
        }
    }
});

// Déconnexion auto quand le salon vocal du bot se vide.
client.on('voiceStateUpdate', (oldState, newState) => {
    const play = client.commands.get('play');
    if (play && play.handleVoiceUpdate) play.handleVoiceUpdate(client, oldState, newState);
});

client.login(TOKEN);