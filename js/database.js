require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // FIX : colonne avatar (base64), ajoutée si elle n'existe pas déjà
        try {
            await client.query(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
        } catch (e) { /* colonne déjà existante */ }

        await client.query(`
            CREATE TABLE IF NOT EXISTS servers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                owner_id INTEGER NOT NULL,
                invite_code TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS server_members (
                id SERIAL PRIMARY KEY,
                server_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT DEFAULT 'member'
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS channels (
                id SERIAL PRIMARY KEY,
                server_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                channel_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_members_server ON server_members(server_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_members_user ON server_members(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id)`);

        console.log("Base de données PostgreSQL initialisée ✅");
    } finally {
        client.release();
    }
}

initDB().catch(err => console.error("Erreur init DB:", err));

module.exports = pool;