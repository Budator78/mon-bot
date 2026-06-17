const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');
const { base, COLORS, ko, warn } = require('../utils/embeds');

const API = 'https://api.deadlock-api.com';

// Caches process-life pour les assets (changent rarement).
let ranksCache = null, heroesCache = null;

async function getJson(url, timeoutMs = 9000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

async function getRanks() {
    if (!ranksCache) ranksCache = (await getJson(`${API}/v1/assets/ranks`)) || [];
    return ranksCache;
}
async function getHeroes() {
    if (!heroesCache) {
        const arr = (await getJson(`${API}/v1/assets/heroes?only_active=true`)) || [];
        heroesCache = {};
        for (const h of arr) heroesCache[h.id] = h.name;
    }
    return heroesCache;
}

// Convertit une entrée numérique / lien profiles en account_id (32 bits). null sinon.
function parseAccountId(input) {
    input = input.trim();
    const m = input.match(/profiles\/(\d{17})/);
    if (m) input = m[1];
    if (!/^\d+$/.test(input)) return null;
    const n = BigInt(input);
    const STEAM64_BASE = 76561197960265728n;
    return n > STEAM64_BASE ? Number(n - STEAM64_BASE) : Number(n);
}

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

// Construit l'embed de stats pour un account_id. Renvoie { embed } ou { error }.
async function buildStatsEmbed(accountId) {
    const [mmrArr, heroStats, steamArr, ranks, heroes] = await Promise.all([
        getJson(`${API}/v1/players/mmr?account_ids=${accountId}`),
        getJson(`${API}/v1/players/hero-stats?account_ids=${accountId}`),
        getJson(`${API}/v1/players/steam?account_ids=${accountId}`),
        getRanks(),
        getHeroes(),
    ]);

    if (!heroStats || heroStats.length === 0) {
        return { error: `Aucune donnée pour l'account_id \`${accountId}\`. Le joueur n'a peut-être jamais été indexé.` };
    }

    let steam = Array.isArray(steamArr) ? steamArr[0] : steamArr;
    if (!steam) {
        const r = await getJson(`${API}/v1/players/steam?account_ids=${accountId}&refresh=true`);
        steam = Array.isArray(r) ? r[0] : r;
    }
    const name = (steam && steam.personaname) || `Joueur ${accountId}`;

    const mmr = Array.isArray(mmrArr) ? mmrArr[0] : null;
    let rankText = 'Non classé', rankImg = null;
    if (mmr && mmr.division > 0) {
        const r = ranks.find(x => x.tier === mmr.division);
        const rn = r ? r.name : `Tier ${mmr.division}`;
        rankText = `${rn} ${mmr.division_tier || ''}`.trim();
        if (r && r.images) rankImg = r.images[`small_subrank${mmr.division_tier}`] || r.images.small || r.images.large;
    }

    let tM = 0, tW = 0, tK = 0, tD = 0, tA = 0;
    for (const h of heroStats) {
        tM += h.matches_played || 0; tW += h.wins || 0;
        tK += h.kills || 0; tD += h.deaths || 0; tA += h.assists || 0;
    }
    const wr = tM ? Math.round((tW / tM) * 100) : 0;
    const kda = tD ? ((tK + tA) / tD).toFixed(2) : (tK + tA).toFixed(2);

    const top = [...heroStats].sort((a, b) => b.matches_played - a.matches_played).slice(0, 3);
    const topText = top.map(h => {
        const hn = heroes[h.hero_id] || `Héros ${h.hero_id}`;
        const hwr = h.matches_played ? Math.round((h.wins / h.matches_played) * 100) : 0;
        return `**${hn}** — ${fmt(h.matches_played)} parties · ${hwr}% WR`;
    }).join('\n') || '_Aucun_';

    const embed = base(COLORS.brand)
        .setAuthor({ name: 'Deadlock' })
        .setTitle(name)
        .addFields(
            { name: '🏅 Rang', value: rankText, inline: true },
            { name: '⚔️ Parties', value: fmt(tM), inline: true },
            { name: '📈 Winrate', value: `${wr}%`, inline: true },
            { name: '💀 KDA moyen', value: `${kda}  \`(${fmt(tK)} / ${fmt(tD)} / ${fmt(tA)})\``, inline: false },
            { name: '🌟 Héros les plus joués', value: topText, inline: false },
        )
        .setFooter({ text: `account_id ${accountId} · via deadlock-api.com` });

    const avatar = steam && (steam.avatarfull || steam.avatarmedium || steam.avatar);
    if (avatar) embed.setThumbnail(avatar);
    else if (rankImg) embed.setThumbnail(rankImg);
    if (steam && steam.profileurl) embed.setURL(steam.profileurl);

    return { embed };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deadlock')
        .setDescription("Affiche les stats Deadlock d'un joueur")
        .addStringOption(o => o.setName('joueur')
            .setDescription('Pseudo Steam, SteamID64, account_id, ou lien steamcommunity.com/profiles/...')
            .setRequired(true)),

    async execute(interaction, client) {
        const raw = interaction.options.getString('joueur');
        await interaction.deferReply();

        const directId = parseAccountId(raw);

        // --- Cas 1 : ID / lien numérique fourni directement ---
        if (directId !== null) {
            const { embed, error } = await buildStatsEmbed(directId);
            return interaction.editReply(error ? ko(error) : { embeds: [embed] });
        }

        // --- Cas 2 : recherche par pseudo ---
        const query = raw.replace(/.*\/id\//, '').trim(); // si on a collé un lien /id/pseudo
        const results = await getJson(`${API}/v1/players/steam-search?search_query=${encodeURIComponent(query)}&limit=10`);
        const arr = Array.isArray(results) ? results : [];

        if (arr.length === 0) {
            return interaction.editReply(ko(`Aucun joueur Deadlock trouvé pour **${query}**. Essaie avec un SteamID64 ou un account_id.`));
        }

        // Un seul résultat : on l'utilise directement.
        if (arr.length === 1) {
            const { embed, error } = await buildStatsEmbed(arr[0].account_id);
            return interaction.editReply(error ? ko(error) : { embeds: [embed] });
        }

        // Plusieurs résultats : menu déroulant pour désambiguïser.
        const menu = new StringSelectMenuBuilder()
            .setCustomId('deadlock_select')
            .setPlaceholder('Plusieurs joueurs trouvés — choisis')
            .addOptions(arr.slice(0, 25).map(p => ({
                label: (p.personaname || `Joueur ${p.account_id}`).substring(0, 100),
                description: `${fmt(p.matches_played_last_30d)} parties (30j) · ID ${p.account_id}`.substring(0, 100),
                value: String(p.account_id),
            })));

        const msg = await interaction.editReply({
            content: `🔍 ${arr.length} joueurs trouvés pour **${query}** — choisis le bon :`,
            components: [new ActionRowBuilder().addComponents(menu)],
        });

        try {
            const sel = await msg.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 30000,
                componentType: ComponentType.StringSelect,
            });
            await sel.deferUpdate();
            const { embed, error } = await buildStatsEmbed(Number(sel.values[0]));
            return interaction.editReply(error
                ? ko(error, { content: null, components: [] })
                : { content: null, embeds: [embed], components: [] });
        } catch (e) {
            return interaction.editReply(warn('Temps écoulé !', { content: null, components: [] }));
        }
    }
};
