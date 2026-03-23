const express = require("express");
const router = express.Router();
const db = require("../database");

// -------------------------------
// POST : créer un compte
// -------------------------------
router.post("/auth/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
    }

    try {
        const result = db.prepare(`
            INSERT INTO users (username, password, created_at)
            VALUES (?, ?, datetime('now'))
        `).run(username, password);

        res.json({
            success: true,
            user_id: result.lastInsertRowid
        });

    } catch (err) {
        console.error("Erreur register:", err);
        res.status(500).json({ error: "Username already taken" });
    }
});

// -------------------------------
// POST : connexion
// -------------------------------
router.post("/auth/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
    }

    const user = db.prepare(`
        SELECT * FROM users WHERE username = ? AND password = ?
    `).get(username, password);

    if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
    }

    res.json({
        success: true,
        user_id: user.id
    });
});

module.exports = router;
