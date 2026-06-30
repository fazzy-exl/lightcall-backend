const express = require("express");
const router = express.Router();
const pool = require("../database");
const bcrypt = require("bcrypt");

router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing username or password" });
    if (username.length > 32 || password.length > 128) return res.status(400).json({ error: "Entrée trop longue" });

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

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

    try {
        const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: "Invalid username or password" });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: "Invalid username or password" });

        res.json({ success: true, user_id: user.id });
    } catch (err) {
        console.error("Erreur login:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// GET /users/:id — inclut avatar_url (recadré) et avatar_original (source complète)
router.get("/users/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, created_at, avatar_url, avatar_original FROM users WHERE id = $1`,
            [req.params.id]
        );
        if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Erreur GET user:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

router.put("/users/:id/password", async (req, res) => {
    const { id } = req.params;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) return res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
    if (new_password.length < 4 || new_password.length > 128) return res.status(400).json({ error: "Le nouveau mot de passe doit faire entre 4 et 128 caractères" });

    try {
        const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) return res.status(401).json({ error: "Mot de passe actuel incorrect" });

        const newHash = await bcrypt.hash(new_password, 10);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erreur changement mot de passe:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// PUT /users/:id/avatar — sauvegarde la version recadrée ET la source originale
router.put("/users/:id/avatar", async (req, res) => {
    const { id } = req.params;
    const { avatar_base64, avatar_original_base64 } = req.body;

    if (!avatar_base64) return res.status(400).json({ error: "Image manquante" });
    if (avatar_base64.length > 1_500_000) return res.status(400).json({ error: "Image trop volumineuse" });
    if (avatar_original_base64 && avatar_original_base64.length > 3_000_000) {
        return res.status(400).json({ error: "Image originale trop volumineuse" });
    }

    try {
        if (avatar_original_base64) {
            await pool.query(
                `UPDATE users SET avatar_url = $1, avatar_original = $2 WHERE id = $3`,
                [avatar_base64, avatar_original_base64, id]
            );
        } else {
            // Recadrage seul (à partir de l'original déjà en base) → on ne touche pas avatar_original
            await pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatar_base64, id]);
        }
        res.json({ success: true, avatar_url: avatar_base64 });
    } catch (err) {
        console.error("Erreur upload avatar:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
