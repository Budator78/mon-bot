const { base, COLORS } = require('./utils/embeds');
const { sendLog } = require('./utils/logger');

// Attache tous les écouteurs de logs serveur au client.
function registerLogging(client) {
    // --- Arrivée d'un membre ---
    client.on('guildMemberAdd', (member) => {
        const e = base(COLORS.success)
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setTitle('📥 Membre arrivé')
            .setDescription(`${member} (\`${member.id}\`)`)
            .addFields({ name: 'Compte créé', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` });
        sendLog(member.guild, e);
    });

    // --- Départ d'un membre ---
    client.on('guildMemberRemove', (member) => {
        const e = base(COLORS.warning)
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setTitle('📤 Membre parti')
            .setDescription(`**${member.user.username}** (\`${member.id}\`)`);
        sendLog(member.guild, e);
    });

    // --- Message supprimé ---
    client.on('messageDelete', (message) => {
        if (!message.guild || (message.author && message.author.bot)) return;
        const content = message.content || '_（contenu indisponible — message ancien/non mis en cache）_';
        const e = base(COLORS.error)
            .setTitle('🗑️ Message supprimé')
            .setDescription(`Dans ${message.channel}`)
            .addFields(
                { name: 'Auteur', value: message.author ? `${message.author.username}` : 'Inconnu', inline: true },
                { name: 'Contenu', value: content.substring(0, 1024) },
            );
        sendLog(message.guild, e);
    });

    // --- Message édité ---
    client.on('messageUpdate', (oldMsg, newMsg) => {
        if (!newMsg.guild || (newMsg.author && newMsg.author.bot)) return;
        if (oldMsg.content === newMsg.content) return; // ignore les éditions sans changement de texte (embeds, etc.)
        const e = base(COLORS.warning)
            .setTitle('✏️ Message édité')
            .setDescription(`Dans ${newMsg.channel} — [voir](${newMsg.url})`)
            .addFields(
                { name: 'Auteur', value: newMsg.author ? `${newMsg.author.username}` : 'Inconnu', inline: true },
                { name: 'Avant', value: (oldMsg.content || '_indisponible_').substring(0, 1024) },
                { name: 'Après', value: (newMsg.content || '_indisponible_').substring(0, 1024) },
            );
        sendLog(newMsg.guild, e);
    });

    // --- Activité vocale (rejoindre / quitter / changer de salon) ---
    client.on('voiceStateUpdate', (oldS, newS) => {
        const guild = newS.guild || oldS.guild;
        const member = newS.member || oldS.member;
        if (!member || member.user.bot) return; // on ignore les bots (dont nous-mêmes)

        let e = null;
        if (!oldS.channel && newS.channel) {
            e = base(COLORS.success).setTitle('🔊 Vocal rejoint').setDescription(`**${member.user.username}** a rejoint ${newS.channel}`);
        } else if (oldS.channel && !newS.channel) {
            e = base(COLORS.warning).setTitle('🔇 Vocal quitté').setDescription(`**${member.user.username}** a quitté ${oldS.channel}`);
        } else if (oldS.channelId !== newS.channelId) {
            e = base(COLORS.brand).setTitle('🔀 Salon vocal changé').setDescription(`**${member.user.username}** : ${oldS.channel} → ${newS.channel}`);
        }
        if (e) sendLog(guild, e);
    });

    // --- Salons créés / supprimés / modifiés ---
    client.on('channelCreate', (channel) => {
        if (!channel.guild) return;
        sendLog(channel.guild, base(COLORS.success).setTitle('📁 Salon créé').setDescription(`${channel} (\`${channel.name}\`)`));
    });
    client.on('channelDelete', (channel) => {
        if (!channel.guild) return;
        sendLog(channel.guild, base(COLORS.error).setTitle('🗑️ Salon supprimé').setDescription(`\`${channel.name}\``));
    });
    client.on('channelUpdate', (oldC, newC) => {
        if (!newC.guild) return;
        const changes = [];
        if (oldC.name !== newC.name) changes.push(`Nom : \`${oldC.name}\` → \`${newC.name}\``);
        if (oldC.topic !== newC.topic) changes.push('Sujet/description modifié');
        if (oldC.parentId !== newC.parentId) changes.push('Catégorie modifiée');
        if (!changes.length) return;
        sendLog(newC.guild, base(COLORS.warning).setTitle('✏️ Salon modifié').setDescription(`${newC}\n${changes.join('\n')}`));
    });

    // --- Rôles créés / supprimés / modifiés ---
    client.on('roleCreate', (role) =>
        sendLog(role.guild, base(COLORS.success).setTitle('🏷️ Rôle créé').setDescription(`${role} (\`${role.name}\`)`)));
    client.on('roleDelete', (role) =>
        sendLog(role.guild, base(COLORS.error).setTitle('🏷️ Rôle supprimé').setDescription(`\`${role.name}\``)));
    client.on('roleUpdate', (oldR, newR) => {
        const changes = [];
        if (oldR.name !== newR.name) changes.push(`Nom : \`${oldR.name}\` → \`${newR.name}\``);
        if (oldR.hexColor !== newR.hexColor) changes.push(`Couleur : ${oldR.hexColor} → ${newR.hexColor}`);
        if (oldR.permissions.bitfield !== newR.permissions.bitfield) changes.push('Permissions modifiées');
        if (!changes.length) return;
        sendLog(newR.guild, base(COLORS.warning).setTitle('✏️ Rôle modifié').setDescription(`${newR}\n${changes.join('\n')}`));
    });

    // --- Serveur modifié (nom, etc.) ---
    client.on('guildUpdate', (oldG, newG) => {
        const changes = [];
        if (oldG.name !== newG.name) changes.push(`Nom : \`${oldG.name}\` → \`${newG.name}\``);
        if (oldG.icon !== newG.icon) changes.push('Icône modifiée');
        if (!changes.length) return;
        sendLog(newG, base(COLORS.warning).setTitle('⚙️ Serveur modifié').setDescription(changes.join('\n')));
    });

    // --- Membre modifié (pseudo / rôles) ---
    client.on('guildMemberUpdate', (oldM, newM) => {
        const lines = [];
        if (oldM.nickname !== newM.nickname) {
            lines.push(`Pseudo : \`${oldM.nickname || 'aucun'}\` → \`${newM.nickname || 'aucun'}\``);
        }
        const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
        const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
        if (added.size) lines.push(`Rôles ajoutés : ${added.map(r => `${r}`).join(', ')}`);
        if (removed.size) lines.push(`Rôles retirés : ${removed.map(r => `${r}`).join(', ')}`);
        if (!lines.length) return;
        sendLog(newM.guild, base(COLORS.brand).setTitle('👤 Membre modifié').setDescription(`**${newM.user.username}**\n${lines.join('\n')}`));
    });
}

module.exports = { registerLogging };
