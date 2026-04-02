const Database = require('better-sqlite3');
const db = new Database('lightcall.db');

// -----------------------------
// TABLE : USERS
// -----------------------------
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// -----------------------------
// TABLE : SERVERS
// -----------------------------
db.prepare(`
    CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Sécurise la colonne invite_code si la table est ancienne
try {
    db.prepare(`ALTER TABLE servers ADD COLUMN invite_code TEXT`).run();
} catch (e) {
    // colonne déjà existante
}

// -----------------------------
// TABLE : SERVER MEMBERS
// -----------------------------
db.prepare(`
    CREATE TABLE IF NOT EXISTS server_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member'
    )
`).run();

// -----------------------------
// TABLE : CHANNELS
// -----------------------------
db.prepare(`
    CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL
    )
`).run();

// 🔥 Sécurise la colonne type si la table est ancienne
try {
    db.prepare(`ALTER TABLE channels ADD COLUMN type TEXT`).run();
} catch (e) {
    // colonne déjà existante
}

module.exports = db;
