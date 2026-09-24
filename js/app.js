const express = require("express");
const cors = require("cors");
const http = require("http");

const serverRoutes = require("./routes/servers");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const startWebSocket = require("./websocket");

const app = express();

app.use(cors());
app.use(express.json());

// Routes API
app.use(serverRoutes);
app.use(authRoutes);
app.use(messageRoutes);

// WebSocket
const server = http.createServer(app);
startWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("API + WebSocket LightCall en ligne sur le port " + PORT);
});