const express = require("express");
const router = express.Router();
const pool = require("../database");
const bcrypt = require("bcrypt");

// POST /register
router.post("/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
    }
    if (username.length > 32 || password.length > 128) {
        return res.status(400).json({ error: "Entrée trop longue" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id`,
            [username, hashedPassword]
        );
        res.json({ success: true, user_id: result.rows[0].id });
    } catch (err) {
        console.error("Erreur register:", err);
        res.status(500).json({ error: "Username already taken" });
    }
});

// POST /login
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM users WHERE username = $1`,
            [username]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        res.json({ success: true, user_id: user.id });
    } catch (err) {
        console.error("Erreur login:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// GET /users/:id
router.get("/users/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, created_at FROM users WHERE id = $1`,
            [req.params.id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Erreur GET user:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;