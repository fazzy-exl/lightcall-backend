const express = require("express");
const router = express.Router();
const pool = require("../database");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
            `SELECT id, username, created_at, avatar_url, avatar_original, google_id,
                    (password_hash IS NOT NULL) AS has_password
             FROM users WHERE id = $1`,
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

// POST /auth/google
router.post("/auth/google", async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ error: "Token Google manquant" });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const email = payload.email;
        const name = payload.name || email.split("@")[0];
        const picture = payload.picture;

        let result = await pool.query(`SELECT * FROM users WHERE google_id = $1`, [googleId]);
        let user = result.rows[0];

        if (!user) {
            let baseUsername = name.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "user";
            let username = baseUsername;
            let suffix = 0;

            while (true) {
                const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [username]);
                if (!existing.rows[0]) break;
                suffix++;
                username = `${baseUsername}${suffix}`;
            }

            // FIX : télécharger et convertir la photo Google en base64 une seule fois
            let avatarBase64 = null;
            if (picture) {
                try {
                    const imgRes = await fetch(picture);
                    const buffer = await imgRes.arrayBuffer();
                    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
                    avatarBase64 = `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
                } catch (imgErr) {
                    console.error("Erreur téléchargement avatar Google:", imgErr);
                }
            }

            const insertResult = await pool.query(
                `INSERT INTO users (username, google_id, avatar_url) VALUES ($1, $2, $3) RETURNING id`,
                [username, googleId, avatarBase64]
            );
            user = { id: insertResult.rows[0].id, username };
        }

        res.json({ success: true, user_id: user.id });

    } catch (err) {
        console.error("Erreur auth Google:", err);
        res.status(401).json({ error: "Authentification Google invalide" });
    }
});

// POST /auth/google/link — lier un compte Google à un compte déjà connecté
router.post("/auth/google/link", async (req, res) => {
    const { user_id, credential } = req.body;

    if (!user_id || !credential) {
        return res.status(400).json({ error: "Données manquantes" });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const googleId = payload.sub;

        // Vérifie que ce compte Google n'est pas déjà lié à un autre utilisateur
        const existing = await pool.query(`SELECT id FROM users WHERE google_id = $1`, [googleId]);
        if (existing.rows[0] && String(existing.rows[0].id) !== String(user_id)) {
            return res.status(409).json({ error: "Ce compte Google est déjà lié à un autre utilisateur LightCall" });
        }

        await pool.query(`UPDATE users SET google_id = $1 WHERE id = $2`, [googleId, user_id]);

        res.json({ success: true });

    } catch (err) {
        console.error("Erreur liaison Google:", err);
        res.status(401).json({ error: "Authentification Google invalide" });
    }
});

// POST /auth/google/unlink — délier un compte Google
router.post("/auth/google/unlink", async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: "user_id manquant" });
    }

    try {
        // Vérifie que l'utilisateur a bien un mot de passe (sinon il perdrait tout accès à son compte)
        const result = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [user_id]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }

        if (!user.password_hash) {
            return res.status(400).json({ error: "Tu dois d'abord définir un mot de passe avant de délier Google, sinon tu perdrais l'accès à ton compte." });
        }

        await pool.query(`UPDATE users SET google_id = NULL WHERE id = $1`, [user_id]);
        res.json({ success: true });

    } catch (err) {
        console.error("Erreur déliaison Google:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// DELETE /users/:id — supprimer complètement un compte
router.delete("/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM server_members WHERE user_id = $1`, [id]);
        await pool.query(`DELETE FROM messages WHERE user_id = $1`, [id]);

        const owned = await pool.query(`SELECT id FROM servers WHERE owner_id = $1`, [id]);
        for (const server of owned.rows) {
            await pool.query(`DELETE FROM server_members WHERE server_id = $1`, [server.id]);
            await pool.query(`DELETE FROM channels WHERE server_id = $1`, [server.id]);
            await pool.query(`DELETE FROM servers WHERE id = $1`, [server.id]);
        }

        const result = await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Erreur suppression compte:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
