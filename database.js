const Database = require('better-sqlite3');
const db = new Database('lightcall.db');

// USERS
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

// SERVERS
db.prepare(`
CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    invite_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

try {
    db.prepare(`ALTER TABLE servers ADD COLUMN invite_code TEXT`).run();
} catch (e) {
    // La colonne existe déjà → on ignore l’erreur
}

// SERVER MEMBERS
db.prepare(`
CREATE TABLE IF NOT EXISTS server_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member'
)
`).run();

// CHANNELS
db.prepare(`
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL
)
`).run();

module.exports = db;

// USERS
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        created_at TEXT
    )
`).run();
