const express = require("express");
const router = express.Router();
const db = require("../database");

// GET /messages/:channel_id — récupérer les 50 derniers messages
router.get("/messages/:channel_id", (req, res) => {
    const { channel_id } = req.params;
    try {
        const messages = db.prepare(`
            SELECT messages.id, messages.content, messages.created_at,
                   users.id AS user_id, users.username
            FROM messages
            JOIN users ON users.id = messages.user_id
            WHERE messages.channel_id = ?
            ORDER BY messages.created_at ASC
            LIMIT 50
        `).all(channel_id);
        res.json(messages);
    } catch (err) {
        console.error("Erreur GET messages:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST /messages — envoyer un message
router.post("/messages", (req, res) => {
    const { channel_id, user_id, content } = req.body;

    if (!channel_id || !user_id || !content?.trim()) {
        return res.status(400).json({ error: "Données manquantes" });
    }
    if (content.length > 2000) {
        return res.status(400).json({ error: "Message trop long (2000 caractères max)" });
    }

    try {
        const result = db.prepare(`
            INSERT INTO messages (channel_id, user_id, content)
            VALUES (?, ?, ?)
        `).run(channel_id, user_id, content.trim());

        const message = db.prepare(`
            SELECT messages.id, messages.content, messages.created_at,
                   users.id AS user_id, users.username
            FROM messages
            JOIN users ON users.id = messages.user_id
            WHERE messages.id = ?
        `).get(result.lastInsertRowid);

        res.json(message);
    } catch (err) {
        console.error("Erreur POST message:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;