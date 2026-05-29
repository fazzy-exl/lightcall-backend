const Database = require("better-sqlite3");
const db = new Database("lightcall.db");

// Active les clés étrangères
db.pragma("foreign_keys = ON");

// TABLE : USERS
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// TABLE : SERVERS
db.prepare(`
    CREATE TABLE IF NOT EXISTS servers (
                                           id INTEGER PRIMARY KEY AUTOINCREMENT,
                                           name TEXT NOT NULL,
                                           owner_id INTEGER NOT NULL,
                                           invite_code TEXT UNIQUE NOT NULL,
                                           created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

try { db.prepare(`ALTER TABLE servers ADD COLUMN invite_code TEXT`).run(); } catch (e) {}

// TABLE : SERVER MEMBERS
db.prepare(`
    CREATE TABLE IF NOT EXISTS server_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member'
    )
`).run();

// TABLE : CHANNELS
db.prepare(`
    CREATE TABLE IF NOT EXISTS channels (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            server_id INTEGER NOT NULL,
                                            name TEXT NOT NULL,
                                            type TEXT NOT NULL
    )
`).run();

try { db.prepare(`ALTER TABLE channels ADD COLUMN type TEXT`).run(); } catch (e) {}

// TABLE : MESSAGES
db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// INDEX pour les performances
db.prepare(`CREATE INDEX IF NOT EXISTS idx_members_server ON server_members(server_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_members_user ON server_members(user_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id)`).run();

module.exports = db;