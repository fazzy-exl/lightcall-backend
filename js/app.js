const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");

const serverRoutes = require("./routes/servers");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const startWebSocket = require("./websocket");

const app = express();

app.use(cors());
app.use(express.json());

app.use(serverRoutes);
app.use(authRoutes);
app.use(messageRoutes);

// FIX : sert le frontend seulement en local (pas sur Render)
if (process.env.NODE_ENV !== "production") {
    app.use(express.static(path.join(__dirname, "../../lightcall-frontend")));
    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../../lightcall-frontend/index.html"));
    });
}

const server = http.createServer(app);
startWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("API + WebSocket LightCall en ligne sur le port " + PORT);
});