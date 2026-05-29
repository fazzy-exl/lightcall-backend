const express = require("express");
const router = express.Router();
const db = require("../database");
const bcrypt = require("bcrypt");

// -------------------------------
// POST : créer un compte
// -------------------------------
router.post("/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users (username, password_hash, created_at)
            VALUES (?, ?, datetime('now'))
        `).run(username, hashedPassword);

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
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
    }

    const user = db.prepare(`
        SELECT * FROM users WHERE username = ?
    `).get(username);

    if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
        return res.status(401).json({ error: "Invalid username or password" });
    }

    res.json({
        success: true,
        user_id: user.id
    });
});

// -------------------------------
// GET : récupérer un utilisateur par ID
// -------------------------------
router.get("/users/:id", (req, res) => {
    const userId = req.params.id;

    const user = db.prepare(`
        SELECT id, username, created_at
        FROM users
        WHERE id = ?
    `).get(userId);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
});

// 👉 IMPORTANT : exporter APRÈS toutes les routes
module.exports = router;
