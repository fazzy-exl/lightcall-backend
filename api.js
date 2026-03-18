const express = require('express');
const db = require('./database');
const app = express();

const cors = require("cors");
app.use(cors());

app.use(express.json());

// --- Créer un serveur ---
app.post('/servers/create', (req, res) => {
    const { name, owner_id } = req.body;

    if (!name || !owner_id) {
        return res.status(400).json({ error: "Missing name or owner_id" });
    }

    const inviteCode = generateInviteCode();

    const result = db.prepare(`
        INSERT INTO servers (name, owner_id, invite_code)
        VALUES (?, ?, ?)
    `).run(name, owner_id, inviteCode);

    // Ajouter le créateur comme membre (owner)
    db.prepare(`
        INSERT INTO server_members (server_id, user_id, role)
        VALUES (?, ?, 'owner')
    `).run(result.lastInsertRowid, owner_id);

    // Créer un salon vocal par défaut
    db.prepare(`
        INSERT INTO channels (server_id, name, type)
        VALUES (?, 'Général', 'voice')
    `).run(result.lastInsertRowid);

    res.json({
        success: true,
        server_id: result.lastInsertRowid,
        invite_code: inviteCode
    });
});

// --- Rejoindre un serveur ---
app.post('/servers/join', (req, res) => {
    const { server_id, user_id } = req.body;

    if (!server_id || !user_id) {
        return res.status(400).json({ error: "Missing server_id or user_id" });
    }

    db.prepare(`
        INSERT INTO server_members (server_id, user_id, role)
        VALUES (?, ?, 'member')
    `).run(server_id, user_id);

    res.json({ success: true });
});

app.post('/servers/join-by-code', (req, res) => {
    const { invite_code, user_id } = req.body;

    if (!invite_code || !user_id) {
        return res.status(400).json({ error: "Missing invite_code or user_id" });
    }

    const server = db.prepare(`
        SELECT * FROM servers WHERE invite_code = ?
    `).get(invite_code);

    if (!server) {
        return res.status(404).json({ error: "Invalid invite code" });
    }

    // Ajouter l'utilisateur au serveur
    db.prepare(`
        INSERT INTO server_members (server_id, user_id, role)
        VALUES (?, ?, 'member')
    `).run(server.id, user_id);

    res.json({
        success: true,
        server_id: server.id,
        server_name: server.name
    });
});

// --- Lister les serveurs d’un utilisateur ---
app.get('/servers/:user_id', (req, res) => {
    const user_id = req.params.user_id;

    const servers = db.prepare(`
        SELECT servers.id, servers.name, servers.owner_id
        FROM servers
        JOIN server_members ON servers.id = server_members.server_id
        WHERE server_members.user_id = ?
    `).all(user_id);

    res.json(servers);
});

// --- Lister les salons d’un serveur ---
app.get('/servers/:server_id/channels', (req, res) => {
    const server_id = req.params.server_id;

    const channels = db.prepare(`
        SELECT * FROM channels WHERE server_id = ?
    `).all(server_id);

    res.json(channels);
});

// --- Supprimer un serveur ---
app.delete('/servers/:server_id/delete', (req, res) => {
    const server_id = req.params.server_id;

    // Supprimer les membres du serveur
    db.prepare(`DELETE FROM server_members WHERE server_id = ?`).run(server_id);

    // Supprimer les salons du serveur
    db.prepare(`DELETE FROM channels WHERE server_id = ?`).run(server_id);

    // Supprimer le serveur
    const result = db.prepare(`DELETE FROM servers WHERE id = ?`).run(server_id);

    if (result.changes === 0) {
        return res.status(404).json({ error: "Server not found" });
    }

    res.json({ success: true });
});

const http = require('http');
const startWebSocket = require('./websocket');

const server = http.createServer(app);
startWebSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log("API + WebSocket LightCall en ligne sur le port " + PORT);
});

function generateInviteCode() {
    return Math.random().toString(36).substring(2, 10);
}
