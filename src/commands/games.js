const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { base, COLORS, ko, warn } = require('../utils/embeds');
const rosterUtil = require('../utils/roster');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Chargement des données
const challengesData = require('../../data/challenges.json');
const rosterPath = path.join(__dirname, '../../data/roster.xlsx');

// Données Statiques
const VALORANT_MAPS = ['Ascent', 'Bind', 'Haven', 'Split', 'Lotus', 'Pearl', 'Fracture', 'Breeze', 'Icebox', 'Sunset'];
// Source unique partagée avec la commande /roster.
const VALORANT_AGENTS = rosterUtil.VALORANT_AGENTS;

const OW_MAPS = ['King\'s Row', 'Dorado', 'Ilios', 'Route 66', 'Numbani', 'Hollywood', 'Eichenwalde'];
const OW_HEROES = {
    '🛡️ Tank': ['D.Va', 'Doomfist', 'Junker Queen', 'Mauga', 'Orisa', 'Ramattra', 'Reinhardt', 'Roadhog', 'Sigma', 'Winston', 'Wrecking Ball', 'Zarya'],
    '⚔️ DPS': ['Ashe', 'Bastion', 'Cassidy', 'Echo', 'Genji', 'Hanzo', 'Junkrat', 'Mei', 'Pharah', 'Reaper', 'Sojourn', 'Soldier: 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Venture', 'Widowmaker'],
    '💉 Support': ['Ana', 'Baptiste', 'Brigitte', 'Illari', 'Juno', 'Kiriko', 'Lifeweaver', 'Lúcio', 'Mercy', 'Moira', 'Zenyatta']
};

function getRosterData() {
    if (!fs.existsSync(rosterPath)) return [];
    const workbook = xlsx.readFile(rosterPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return xlsx.utils.sheet_to_json(sheet);
}

// Mélange de Fisher-Yates : VRAIMENT uniforme.
// (l'ancien `sort(() => Math.random() - 0.5)` était biaisé et ressortait
//  souvent les mêmes personnes en premier)
function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pute')
        .setDescription('Qui va être la pute ?')
        // AJOUT DE L'OPTION DE SIMULATION ICI
        .addIntegerOption(option => 
            option.setName('simulation')
                .setDescription('DEBUG : Simuler un nombre total de joueurs (ex: 6 pour 3v3)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        if (!interaction.member.voice.channel) return interaction.reply(ko('Tu dois être en vocal !'));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('game_select')
                .setPlaceholder('Choisis le jeu')
                .addOptions([
                    { label: 'Valorant', value: 'valorant' },
                    { label: 'Overwatch', value: 'overwatch' },
                    { label: 'Rocket League', value: 'rl' },
                ])
        );

        const msg = await interaction.reply({ content: 'Quel jeu ?', components: [row], fetchReply: true });

        const filter = i => i.user.id === interaction.user.id;
        try {
            const selection = await msg.awaitMessageComponent({ filter, time: 60000 });
            const game = selection.values[0];
            
            // --- GESTION DES JOUEURS (REEL + SIMULATION) ---
            const channel = interaction.member.voice.channel;
            // On prend les vrais humains
            let members = Array.from(channel.members.values()).filter(m => !m.user.bot);
            
            // On regarde si une simulation est demandée
            const simCount = interaction.options.getInteger('simulation');
            
            if (simCount && simCount > members.length) {
                const fakesNeeded = simCount - members.length;
                console.log(`⚠️ MODE DEBUG : Ajout de ${fakesNeeded} faux joueurs.`);
                
                for (let i = 0; i < fakesNeeded; i++) {
                    members.push({
                        user: { 
                            username: `[BOT] Testeur_${i+1}`, 
                            id: `fake_${i}`, 
                            bot: false // On dit false pour qu'ils soient traités comme des humains
                        },
                        // On simule la fonction send pour voir le DM dans la console
                        send: async (msg) => console.log(`\n📬 [DM FICTIF à Testeur_${i+1}] :\n${msg}\n`)
                    });
                }
            }
            // ----------------------------------------------------

            await selection.update({ content: `Configuration de la partie de **${game}** avec ${members.length} joueurs...`, components: [] });

            // === VALORANT ===
            if (game === 'valorant') {
                const map = VALORANT_MAPS[Math.floor(Math.random() * VALORANT_MAPS.length)];

                const shuffled = shuffle(members);
                const mid = Math.ceil(shuffled.length / 2);
                const team1 = shuffled.slice(0, mid);
                const team2 = shuffled.slice(mid);

                const roster = getRosterData();

                // Construit la liste "joueur — agent" d'une équipe (sans doublon d'agent).
                const buildTeam = (team) => {
                    let takenAgents = [];
                    const lines = team.map(member => {
                        // 1. On regarde d'abord le roster JSON (par ID Discord, fiable, via /roster).
                        let playerPool = rosterUtil.getAgents(member.user.id);
                        // 2. Repli sur l'ancien Excel (par pseudo) si rien en JSON.
                        if (playerPool.length === 0) {
                            const playerData = roster.find(r => r.Pseudo === member.user.username) || {};
                            playerPool = Object.keys(playerData).filter(key => key !== 'Pseudo' && playerData[key]);
                        }

                        let selectedAgent = "";
                        let suffix = "";
                        const validOptions = playerPool.filter(agent => !takenAgents.includes(agent));

                        if (validOptions.length > 0) {
                            selectedAgent = validOptions[Math.floor(Math.random() * validOptions.length)];
                        } else {
                            const remainingGlobal = VALORANT_AGENTS.filter(agent => !takenAgents.includes(agent));
                            if (remainingGlobal.length > 0) {
                                selectedAgent = remainingGlobal[Math.floor(Math.random() * remainingGlobal.length)];
                                suffix = playerPool.length === 0 ? " *(random)*" : " *(fill)*";
                            } else {
                                selectedAgent = "Aucun agent dispo";
                            }
                        }

                        takenAgents.push(selectedAgent);
                        return `• **${member.user.username}** — ${selectedAgent}${suffix}`;
                    });
                    return lines.join('\n') || '_Personne_';
                };

                const valoEmbed = base(COLORS.valorant)
                    .setAuthor({ name: 'VALORANT' })
                    .setTitle(`🗺️ ${map}`)
                    .addFields(
                        { name: '🔵 Équipe 1', value: buildTeam(team1), inline: true },
                        { name: '🔴 Équipe 2', value: buildTeam(team2), inline: true },
                    );

                await interaction.followUp({ embeds: [valoEmbed] });

                const traitors = [];
                if (members.length >= 6) {
                    traitors.push(team1[Math.floor(Math.random() * team1.length)]);
                    traitors.push(team2[Math.floor(Math.random() * team2.length)]);
                } else {
                    traitors.push(members[Math.floor(Math.random() * members.length)]);
                }
                sendTraitorDM(traitors, 'valorant');
            }

            // === OVERWATCH ===
            else if (game === 'overwatch') {
                const count = members.length;

                if (count !== 6 && count !== 8 && count !== 10) {
                    return interaction.followUp(ko('Pour Overwatch, il faut pile **6, 8 ou 10 joueurs** (3v3, 4v4 ou 5v5).'));
                }
                
                const shuffled = shuffle(members);
                const mid = count / 2;
                const team1 = shuffled.slice(0, mid);
                const team2 = shuffled.slice(mid);

                let rolesPool1 = [];
                let rolesPool2 = [];

                if (count === 6) {
                    const base = ['🛡️ Tank', '⚔️ DPS', '💉 Support'];
                    rolesPool1 = shuffle([...base]);
                    rolesPool2 = shuffle([...base]);
                } 
                else if (count === 8) {
                    const getComp8 = () => {
                        const isTwoDps = Math.random() < 0.5;
                        return [
                            '🛡️ Tank',
                            isTwoDps ? '⚔️ DPS' : '💉 Support',
                            isTwoDps ? '⚔️ DPS' : '💉 Support',
                            isTwoDps ? '💉 Support' : '⚔️ DPS'
                        ];
                    };
                    const sharedComp = getComp8();
                    rolesPool1 = shuffle([...sharedComp]);
                    rolesPool2 = shuffle([...sharedComp]);
                } 
                else if (count === 10) {
                    const base = ['🛡️ Tank', '⚔️ DPS', '⚔️ DPS', '💉 Support', '💉 Support'];
                    rolesPool1 = shuffle([...base]);
                    rolesPool2 = shuffle([...base]);
                }

                const map = OW_MAPS[Math.floor(Math.random() * OW_MAPS.length)];

                // Construit la liste "joueur — rôle (héros)" d'une équipe (héros uniques).
                const buildTeam = (team, roles) => {
                    let availableHeroes = {
                        '🛡️ Tank': [...OW_HEROES['🛡️ Tank']],
                        '⚔️ DPS': [...OW_HEROES['⚔️ DPS']],
                        '💉 Support': [...OW_HEROES['💉 Support']]
                    };
                    const lines = team.map((m, idx) => {
                        const role = roles[idx];
                        const pool = availableHeroes[role];
                        const randIndex = Math.floor(Math.random() * pool.length);
                        const randomHero = pool[randIndex];
                        pool.splice(randIndex, 1);
                        return `• **${m.user.username}** — ${role} **${randomHero}**`;
                    });
                    return lines.join('\n') || '_Personne_';
                };

                const owEmbed = base(COLORS.overwatch)
                    .setAuthor({ name: 'OVERWATCH' })
                    .setTitle(`🗺️ ${map}`)
                    .addFields(
                        { name: '🔵 Équipe 1', value: buildTeam(team1, rolesPool1), inline: true },
                        { name: '🔴 Équipe 2', value: buildTeam(team2, rolesPool2), inline: true },
                    );

                await interaction.followUp({ embeds: [owEmbed] });

                const traitors = [];
                traitors.push(team1[Math.floor(Math.random() * team1.length)]);
                traitors.push(team2[Math.floor(Math.random() * team2.length)]);
                sendTraitorDM(traitors, 'overwatch');
            }

            // === ROCKET LEAGUE ===
            else if (game === 'rl') {
                const rlEmbed = base(COLORS.rl)
                    .setAuthor({ name: 'ROCKET LEAGUE' })
                    .setDescription("⚽ Démerdez-vous pour les équipes !\n📬 Et checkez vos DM...");
                await interaction.followUp({ embeds: [rlEmbed] });

                const traitors = [];
                if (members.length > 4) {
                    const shuffled = shuffle(members);
                    traitors.push(shuffled[0]);
                    traitors.push(shuffled[1]);
                } else {
                    traitors.push(members[Math.floor(Math.random() * members.length)]);
                }
                sendTraitorDM(traitors, 'rl');
            }

        } catch (e) {
            console.error(e);
            return interaction.editReply(ko('Temps écoulé ou erreur !', { content: null, components: [] }));
        }

        async function sendTraitorDM(targets, gameType) {
            const gameChallenges = challengesData[gameType] || challengesData['global'];
            let availableChallenges = [...gameChallenges];
            const failed = []; // joueurs dont le DM n'a pas pu partir

            for (const member of targets) {
                if (availableChallenges.length === 0) availableChallenges = [...gameChallenges];

                const index = Math.floor(Math.random() * availableChallenges.length);
                const selectedChallenge = availableChallenges[index];

                availableChallenges.splice(index, 1);

                try {
                    await member.send(`**PUTE !**\nTon défi :\n👉 **${selectedChallenge}**`);
                    console.log(`DM envoyé à ${member.user.username} (Jeu: ${gameType})`);
                } catch (e) {
                    // Si c'est un bot de test, on verra déjà le log grâce au mock 'send' plus haut
                    if (!member.user.username.includes("[BOT]")) {
                        console.log(`Impossible d'envoyer DM à ${member.user.username}`);
                        failed.push(member.user.username);
                    }
                }
            }

            // On prévient SEULEMENT celui qui a lancé la commande (message privé/éphémère),
            // pour ne pas révéler aux autres qui était traître.
            if (failed.length > 0) {
                const liste = failed.map(n => `**${n}**`).join(', ');
                await interaction.followUp({
                    content: `⚠️ Impossible d'envoyer le défi à ${liste} (MP fermés). Préviens-le(s) en privé ou relance la commande.`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
};