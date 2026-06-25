const express = require("express");
const router = express.Router();
const pool = require("../database");

// GET /messages/:channel_id
router.get("/messages/:channel_id", async (req, res) => {
    const { channel_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT messages.id, messages.content, messages.created_at,
                    users.id AS user_id, users.username
             FROM messages
             JOIN users ON users.id = messages.user_id
             WHERE messages.channel_id = $1
             ORDER BY messages.created_at ASC
             LIMIT 50`,
            [channel_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur GET messages:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST /messages
router.post("/messages", async (req, res) => {
    const { channel_id, user_id, content } = req.body;

    if (!channel_id || !user_id || !content?.trim()) {
        return res.status(400).json({ error: "Données manquantes" });
    }
    if (content.length > 2000) {
        return res.status(400).json({ error: "Message trop long (2000 caractères max)" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id`,
            [channel_id, user_id, content.trim()]
        );

        const message = await pool.query(
            `SELECT messages.id, messages.content, messages.created_at,
                    users.id AS user_id, users.username
             FROM messages
             JOIN users ON users.id = messages.user_id
             WHERE messages.id = $1`,
            [result.rows[0].id]
        );

        res.json(message.rows[0]);
    } catch (err) {
        console.error("Erreur POST message:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;