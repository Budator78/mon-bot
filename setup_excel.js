const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Liste des agents Valorant (à jour)
const agents = [
    "Jett", "Raze", "Iso", "Neon", "Reyna", "Yoru", "Phoenix", // Duelists
    "Breach", "Fade", "Gekko", "KAY/O", "Skye", "Sova", // Initiators
    "Omen", "Astra", "Brimstone", "Clove", "Harbor", "Viper", // Controllers
    "Chamber", "Cypher", "Deadlock", "Killjoy", "Sage", "Vyse" // Sentinels
];

// Liste de tes joueurs (Mets les Pseudos EXACTS de Discord)
// J'ai mis le tien et des exemples
const players = [
    "budator78", 
    "futurss_", 
    "juvaii",
    "fasstro",
    "tibaaa",
    "p6copat"
];

// On construit les données
const data = players.map(pseudo => {
    let row = { Pseudo: pseudo };
    agents.forEach(agent => {
        // Par défaut, on met TRUE (VRAI) partout.
        // Tu n'auras qu'à mettre FALSE (FAUX) dans Excel pour les agents qu'ils ne jouent pas.
        row[agent] = "x"; 
    });
    return row;
});

// Création du classeur Excel
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(data);

// Ajustement de la largeur des colonnes pour faire joli
const wscols = [{wch: 20}]; // Colonne Pseudo large
agents.forEach(() => wscols.push({wch: 8})); // Colonnes agents petites
ws['!cols'] = wscols;

xlsx.utils.book_append_sheet(wb, ws, "Roster");

// Sauvegarde dans le bon dossier
const dirPath = path.join(__dirname, 'src/data');

// Vérifie que le dossier existe, sinon le crée
if (!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath, { recursive: true });
}

const filePath = path.join(dirPath, 'roster.xlsx');
xlsx.writeFile(wb, filePath);

console.log("✅ Fichier 'src/data/roster.xlsx' généré avec succès !");
console.log("👉 Tu peux maintenant l'ouvrir avec Excel/LibreOffice et modifier les TRUE/FALSE.");