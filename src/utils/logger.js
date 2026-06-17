const { getLogChannel } = require('./settings');

// Envoie un embed dans le salon de logs configuré pour ce serveur (silencieux si aucun).
async function sendLog(guild, embed) {
    if (!guild) return;
    const channelId = getLogChannel(guild.id);
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;
    channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { sendLog };
