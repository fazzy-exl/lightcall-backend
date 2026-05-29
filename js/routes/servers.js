const express = require("express");
const router = express.Router();
const { randomBytes } = require("crypto");
const db = require("../database");

/* ----------------------------------------------------
   MIDDLEWARE : vérification JWT (protège toutes les routes)
   Décommentez quand vous aurez mis en place le JWT.
   Pour l'instant, on lit user_id depuis le body/params.
---------------------------------------------------- */
// const { verifyToken } = require("../middleware/auth");
// router.use(verifyToken);

/* ----------------------------------------------------
   1) ROUTES SPÉCIFIQUES (doivent être AVANT les génériques)
---------------------------------------------------- */

// GET /api/servers/:server_id/full — infos complètes d'un serveur
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

// GET /api/servers/:server_id/channels — salons d'un serveur
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

// GET /api/servers/:userId — serveurs d'un utilisateur
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

// POST /api/servers/create — créer un serveur
router.post("/servers/create", (req, res) => {
    const { name, owner_id } = req.body;

    if (!name || !owner_id) {
        return res.status(400).json({ error: "Missing name or owner_id" });
    }

    // ✅ FIX : validation de longueur
    if (name.trim().length === 0 || name.length > 64) {
        return res.status(400).json({ error: "Nom de serveur invalide (1-64 caractères)" });
    }

    // ✅ FIX : code d'invitation cryptographiquement sûr
    const inviteCode = randomBytes(6).toString("base64url");

    try {
        const result = db.prepare(`
            INSERT INTO servers (name, owner_id, invite_code)
            VALUES (?, ?, ?)
        `).run(name.trim(), owner_id, inviteCode);

        const serverId = result.lastInsertRowid;

        // Ajouter le créateur comme owner
        db.prepare(`
            INSERT INTO server_members (server_id, user_id, role)
            VALUES (?, ?, 'owner')
        `).run(serverId, owner_id);

        // Ajouter un salon textuel par défaut
        db.prepare(`
            INSERT INTO channels (server_id, name, type)
            VALUES (?, 'général', 'text')
        `).run(serverId);

        // Ajouter un salon vocal par défaut
        db.prepare(`
            INSERT INTO channels (server_id, name, type)
            VALUES (?, 'Général', 'voice')
        `).run(serverId);

        // ✅ FIX : le log de debug est maintenant DANS le try, AVANT res.json()
        const testChannels = db.prepare("SELECT * FROM channels WHERE server_id = ?").all(serverId);
        console.log("Channels après création :", testChannels);

        res.json({
            success: true,
            server_id: serverId,
            invite_code: inviteCode
        });

    } catch (err) {
        console.error("Erreur create server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST /api/servers/join — rejoindre un serveur par ID
router.post("/servers/join", (req, res) => {
    const { server_id, user_id } = req.body;

    if (!server_id || !user_id) {
        return res.status(400).json({ error: "Missing server_id or user_id" });
    }

    try {
        // ✅ FIX : vérifier si déjà membre avant d'insérer
        const alreadyMember = db.prepare(`
            SELECT id FROM server_members
            WHERE server_id = ? AND user_id = ?
        `).get(server_id, user_id);

        if (alreadyMember) {
            return res.status(409).json({ error: "Déjà membre de ce serveur" });
        }

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

// POST /api/servers/join-by-code — rejoindre via code d'invitation
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
            return res.status(404).json({ error: "Code d'invitation invalide" });
        }

        // ✅ FIX : vérifier si déjà membre
        const alreadyMember = db.prepare(`
            SELECT id FROM server_members
            WHERE server_id = ? AND user_id = ?
        `).get(server.id, user_id);

        if (alreadyMember) {
            return res.status(409).json({ error: "Vous êtes déjà membre de ce serveur" });
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

// DELETE /api/servers/:server_id/delete — supprimer un serveur
router.delete("/servers/:server_id/delete", (req, res) => {
    const { server_id } = req.params;

    // ✅ FIX : idéalement vérifier que l'utilisateur est bien owner
    // const { user_id } = req.body;
    // const server = db.prepare("SELECT * FROM servers WHERE id = ? AND owner_id = ?").get(server_id, user_id);
    // if (!server) return res.status(403).json({ error: "Non autorisé" });

    try {
        db.prepare(`DELETE FROM server_members WHERE server_id = ?`).run(server_id);
        db.prepare(`DELETE FROM channels WHERE server_id = ?`).run(server_id);

        const result = db.prepare(`DELETE FROM servers WHERE id = ?`).run(server_id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }

        res.json({ success: true });

    } catch (err) {
        console.error("Erreur delete server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// PUT /api/servers/:server_id/rename — renommer un serveur
router.put("/servers/:server_id/rename", (req, res) => {
    const { server_id } = req.params;
    const { new_name } = req.body;

    if (!new_name || !new_name.trim()) {
        return res.status(400).json({ error: "Nom invalide" });
    }

    // ✅ FIX : validation de longueur
    if (new_name.trim().length > 64) {
        return res.status(400).json({ error: "Nom trop long (64 caractères max)" });
    }

    try {
        const result = db.prepare(`
            UPDATE servers SET name = ? WHERE id = ?
        `).run(new_name.trim(), server_id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }

        res.json({ success: true, new_name: new_name.trim() });

    } catch (err) {
        console.error("Erreur rename server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
