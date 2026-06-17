// Config pm2 : lance Lavalink + le bot, les redémarre s'ils plantent,
// et les relance au reboot du serveur (avec `pm2 startup` + `pm2 save`).
module.exports = {
    apps: [
        {
            name: 'lavalink',
            cwd: './Lavalink',
            script: 'java',
            // -Xmx450m : bride la RAM de Lavalink (indispensable sur une VM 1 Go type
            // Google Cloud e2-micro). Sur une machine plus costaude, tu peux l'augmenter/retirer.
            args: '-Xmx450m -jar Lavalink.jar',
            interpreter: 'none',     // java n'est pas du JS, pas d'interpréteur node
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
        },
        {
            name: 'mon-bot',
            script: 'src/index.js',
            autorestart: true,
            restart_delay: 3000,
            // Le token se définit côté serveur (variable d'env), PAS ici.
            // Shoukaku (reconnectTries: 20) gère le fait que Lavalink mette
            // quelques secondes à démarrer en parallèle.
        },
    ],
};
