const express = require("express");
const router = express.Router();
const db = require("../database");

/* ----------------------------------------------------
   1) ROUTES SPÉCIFIQUES (doivent être AVANT les génériques)
---------------------------------------------------- */

// GET : infos complètes d’un serveur
router.get("/servers/:server_id/full", (req, res) => {
    const { server_id } = req.params;

    try {
        const server = db.prepare(`
            SELECT id, name, owner_id, invite_code
            FROM servers
            WHERE id = ?
        `).get(server_id);

        if (!server) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }

        const channels = db.prepare(`
            SELECT id, name, type
            FROM channels
            WHERE server_id = ?
        `).all(server_id);

        const members = db.prepare(`
            SELECT users.id, users.username, server_members.role
            FROM server_members
            JOIN users ON users.id = server_members.user_id
            WHERE server_members.server_id = ?
        `).all(server_id);

        res.json({
            ...server,
            text_channels: channels.filter(c => c.type === "text"),
            voice_channels: channels.filter(c => c.type === "voice"),
            members
        });

    } catch (err) {
        console.error("Erreur GET full server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// GET : salons d’un serveur
router.get("/servers/:server_id/channels", (req, res) => {
    const { server_id } = req.params;

    try {
        const channels = db.prepare(`
            SELECT * FROM channels WHERE server_id = ?
        `).all(server_id);

        res.json(channels);

    } catch (err) {
        console.error("Erreur channels:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

/* ----------------------------------------------------
   2) ROUTES GÉNÉRIQUES (doivent être APRÈS les spécifiques)
---------------------------------------------------- */

// GET : serveurs d’un utilisateur
router.get("/servers/:userId", (req, res) => {
    const { userId } = req.params;

    try {
        const servers = db.prepare(`
            SELECT servers.id, servers.name, servers.owner_id
            FROM servers
            JOIN server_members ON servers.id = server_members.server_id
            WHERE server_members.user_id = ?
        `).all(userId);

        res.json(servers);

    } catch (err) {
        console.error("Erreur GET servers:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

/* ----------------------------------------------------
   3) AUTRES ROUTES
---------------------------------------------------- */

// POST : créer un serveur
router.post("/servers/create", (req, res) => {
    const { name, owner_id } = req.body;

    if (!name || !owner_id) {
        return res.status(400).json({ error: "Missing name or owner_id" });
    }

    const inviteCode = Math.random().toString(36).substring(2, 10);

    try {
        const result = db.prepare(`
            INSERT INTO servers (name, owner_id, invite_code)
            VALUES (?, ?, ?)
        `).run(name, owner_id, inviteCode);

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

    } catch (err) {
        console.error("Erreur create server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST : rejoindre un serveur
router.post("/servers/join", (req, res) => {
    const { server_id, user_id } = req.body;

    if (!server_id || !user_id) {
        return res.status(400).json({ error: "Missing server_id or user_id" });
    }

    try {
        db.prepare(`
            INSERT INTO server_members (server_id, user_id, role)
            VALUES (?, ?, 'member')
        `).run(server_id, user_id);

        res.json({ success: true });

    } catch (err) {
        console.error("Erreur join server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST : rejoindre via code
router.post("/servers/join-by-code", (req, res) => {
    const { invite_code, user_id } = req.body;

    if (!invite_code || !user_id) {
        return res.status(400).json({ error: "Missing invite_code or user_id" });
    }

    try {
        const server = db.prepare(`
            SELECT * FROM servers WHERE invite_code = ?
        `).get(invite_code);

        if (!server) {
            return res.status(404).json({ error: "Invalid invite code" });
        }

        db.prepare(`
            INSERT INTO server_members (server_id, user_id, role)
            VALUES (?, ?, 'member')
        `).run(server.id, user_id);

        res.json({
            success: true,
            server_id: server.id,
            server_name: server.name
        });

    } catch (err) {
        console.error("Erreur join-by-code:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// DELETE : supprimer un serveur
router.delete("/servers/:server_id/delete", (req, res) => {
    const { server_id } = req.params;

    try {
        db.prepare(`DELETE FROM server_members WHERE server_id = ?`).run(server_id);
        db.prepare(`DELETE FROM channels WHERE server_id = ?`).run(server_id);

        const result = db.prepare(`DELETE FROM servers WHERE id = ?`).run(server_id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Server not found" });
        }

        res.json({ success: true });

    } catch (err) {
        console.error("Erreur delete server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// PUT : renommer un serveur
router.put("/servers/:server_id/rename", (req, res) => {
    const { server_id } = req.params;
    const { new_name } = req.body;

    if (!new_name || !new_name.trim()) {
        return res.status(400).json({ error: "Nom invalide" });
    }

    try {
        const result = db.prepare(`
            UPDATE servers SET name = ? WHERE id = ?
        `).run(new_name.trim(), server_id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }

        res.json({ success: true, new_name });

    } catch (err) {
        console.error("Erreur rename server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
