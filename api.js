const express = require("express");
const cors = require("cors");
const http = require("http");

const serverRoutes = require("./routes/servers");
const startWebSocket = require("./websocket");

const app = express();

app.use(cors());
app.use(express.json());

// Routes API
app.use("/", serverRoutes);

// WebSocket
const server = http.createServer(app);
startWebSocket(server);

// Port Render
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log("API + WebSocket LightCall en ligne sur le port " + PORT);
});
