const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const serverRoutes = require("./routes/servers");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");

app.use(serverRoutes);
app.use(authRoutes);
app.use(messageRoutes);

// Frontend statique
app.use(express.static(path.join(__dirname, "../../lightcall-frontend")));
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../../lightcall-frontend/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend LightCall lancé sur le port", PORT));
