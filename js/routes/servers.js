const express = require("express");
const router = express.Router();
const { randomBytes } = require("crypto");
const pool = require("../database");

// GET /servers/by-code/:invite_code/full
router.get("/servers/by-code/:invite_code/full", async (req, res) => {
    const { invite_code } = req.params;
    try {
        const server = await pool.query(
            `SELECT id, name, owner_id, invite_code FROM servers WHERE invite_code = $1`,
            [invite_code]
        );
        if (!server.rows[0]) return res.status(404).json({ error: "Serveur introuvable" });

        const serverId = server.rows[0].id;

        const channels = await pool.query(`SELECT id, name, type FROM channels WHERE server_id = $1`, [serverId]);
        const members = await pool.query(
            `SELECT users.id, users.username, server_members.role
             FROM server_members JOIN users ON users.id = server_members.user_id
             WHERE server_members.server_id = $1`, [serverId]
        );

        res.json({
            ...server.rows[0],
            text_channels: channels.rows.filter(c => c.type === "text"),
            voice_channels: channels.rows.filter(c => c.type === "voice"),
            members: members.rows
        });
    } catch (err) {
        console.error("Erreur by-code full:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// GET /servers/:userId — liste des serveurs d'un utilisateur
router.get("/servers/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            `SELECT servers.id, servers.name, servers.owner_id, servers.invite_code
             FROM servers
             JOIN server_members ON servers.id = server_members.server_id
             WHERE server_members.user_id = $1`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur GET servers:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// GET /servers/:server_id/full
router.get("/servers/:server_id/full", async (req, res) => {
    const { server_id } = req.params;
    try {
        const server = await pool.query(
            `SELECT id, name, owner_id, invite_code FROM servers WHERE id = $1`,
            [server_id]
        );
        if (!server.rows[0]) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }

        const channels = await pool.query(
            `SELECT id, name, type FROM channels WHERE server_id = $1`,
            [server_id]
        );

        const members = await pool.query(
            `SELECT users.id, users.username, server_members.role
             FROM server_members
             JOIN users ON users.id = server_members.user_id
             WHERE server_members.server_id = $1`,
            [server_id]
        );

        const allChannels = channels.rows;
        res.json({
            ...server.rows[0],
            text_channels: allChannels.filter(c => c.type === "text"),
            voice_channels: allChannels.filter(c => c.type === "voice"),
            members: members.rows
        });
    } catch (err) {
        console.error("Erreur GET full server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// GET /servers/:server_id/channels
router.get("/servers/:server_id/channels", async (req, res) => {
    const { server_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM channels WHERE server_id = $1`,
            [server_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur channels:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST /servers/create
router.post("/servers/create", async (req, res) => {
    const { name, owner_id } = req.body;

    if (!name || !owner_id) {
        return res.status(400).json({ error: "Missing name or owner_id" });
    }
    if (name.trim().length === 0 || name.length > 64) {
        return res.status(400).json({ error: "Nom de serveur invalide (1-64 caractères)" });
    }

    const inviteCode = randomBytes(6).toString("base64url");

    try {
        const result = await pool.query(
            `INSERT INTO servers (name, owner_id, invite_code) VALUES ($1, $2, $3) RETURNING id`,
            [name.trim(), owner_id, inviteCode]
        );
        const serverId = result.rows[0].id;

        await pool.query(
            `INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'owner')`,
            [serverId, owner_id]
        );

        await pool.query(
            `INSERT INTO channels (server_id, name, type) VALUES ($1, 'général', 'text')`,
            [serverId]
        );

        await pool.query(
            `INSERT INTO channels (server_id, name, type) VALUES ($1, 'Général', 'voice')`,
            [serverId]
        );

        res.json({ success: true, server_id: serverId, invite_code: inviteCode });
    } catch (err) {
        console.error("Erreur create server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST /servers/join
router.post("/servers/join", async (req, res) => {
    const { server_id, user_id } = req.body;

    if (!server_id || !user_id) {
        return res.status(400).json({ error: "Missing server_id or user_id" });
    }

    try {
        const existing = await pool.query(
            `SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2`,
            [server_id, user_id]
        );
        if (existing.rows[0]) {
            return res.status(409).json({ error: "Déjà membre de ce serveur" });
        }

        await pool.query(
            `INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'member')`,
            [server_id, user_id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Erreur join server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST /servers/join-by-code
router.post("/servers/join-by-code", async (req, res) => {
    const { invite_code, user_id } = req.body;

    if (!invite_code || !user_id) {
        return res.status(400).json({ error: "Missing invite_code or user_id" });
    }

    try {
        const server = await pool.query(
            `SELECT * FROM servers WHERE invite_code = $1`,
            [invite_code]
        );
        if (!server.rows[0]) {
            return res.status(404).json({ error: "Code d'invitation invalide" });
        }

        const existing = await pool.query(
            `SELECT id FROM server_members WHERE server_id = $1 AND user_id = $2`,
            [server.rows[0].id, user_id]
        );
        if (existing.rows[0]) {
            return res.status(409).json({ error: "Vous êtes déjà membre de ce serveur" });
        }

        await pool.query(
            `INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'member')`,
            [server.rows[0].id, user_id]
        );

        res.json({ success: true, server_id: server.rows[0].id, server_name: server.rows[0].name });
    } catch (err) {
        console.error("Erreur join-by-code:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// DELETE /servers/:server_id/delete
router.delete("/servers/:server_id/delete", async (req, res) => {
    const { server_id } = req.params;
    try {
        await pool.query(`DELETE FROM server_members WHERE server_id = $1`, [server_id]);
        await pool.query(`DELETE FROM channels WHERE server_id = $1`, [server_id]);
        const result = await pool.query(`DELETE FROM servers WHERE id = $1`, [server_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Erreur delete server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// PUT /servers/:server_id/rename
router.put("/servers/:server_id/rename", async (req, res) => {
    const { server_id } = req.params;
    const { new_name } = req.body;

    if (!new_name || !new_name.trim()) {
        return res.status(400).json({ error: "Nom invalide" });
    }
    if (new_name.trim().length > 64) {
        return res.status(400).json({ error: "Nom trop long (64 caractères max)" });
    }

    try {
        const result = await pool.query(
            `UPDATE servers SET name = $1 WHERE id = $2`,
            [new_name.trim(), server_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }
        res.json({ success: true, new_name: new_name.trim() });
    } catch (err) {
        console.error("Erreur rename server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
