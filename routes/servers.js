const express = require("express");
const router = express.Router();
const pool = require("../db");

// -------------------------------
// GET : serveurs d’un utilisateur
// -------------------------------
router.get("/servers/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await pool.query(
            "SELECT * FROM servers WHERE owner_id = $1",
            [userId]
        );

        res.json(result.rows);

    } catch (err) {
        console.error("Erreur GET servers:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// -------------------------------
// POST : créer un serveur
// -------------------------------
router.post("/servers/create", async (req, res) => {
    const { name, owner_id } = req.body;

    if (!name) return res.status(400).json({ error: "Nom requis" });

    const invite_code = Math.random().toString(36).substring(2, 8);

    try {
        const result = await pool.query(
            "INSERT INTO servers (name, owner_id, invite_code) VALUES ($1, $2, $3) RETURNING *",
            [name, owner_id, invite_code]
        );

        res.json(result.rows[0]);

    } catch (err) {
        console.error("Erreur create server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// -------------------------------
// DELETE : supprimer un serveur
// -------------------------------
router.delete("/servers/:id/delete", async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query("DELETE FROM servers WHERE id = $1", [id]);
        res.json({ message: "Serveur supprimé" });

    } catch (err) {
        console.error("Erreur delete server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// -------------------------------
// PUT : renommer un serveur
// -------------------------------
router.put("/servers/:id/rename", async (req, res) => {
    const { id } = req.params;
    const { new_name } = req.body;

    if (!new_name || !new_name.trim()) {
        return res.status(400).json({ error: "Nom invalide" });
    }

    try {
        const result = await pool.query(
            "UPDATE servers SET name = $1 WHERE id = $2 RETURNING id, name",
            [new_name.trim(), id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Serveur introuvable" });
        }

        res.json({
            message: "Serveur renommé",
            server: result.rows[0]
        });

    } catch (err) {
        console.error("Erreur rename server:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
