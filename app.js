const express = require("express");
const app = express();
const cors = require("cors");

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const serverRoutes = require("./routes/servers");
app.use(serverRoutes);

// Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend LightCall lancé sur le port", PORT));
