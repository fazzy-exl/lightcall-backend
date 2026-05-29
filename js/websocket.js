const WebSocket = require("ws");

function startWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    const clients = new Map();

    wss.on("connection", (ws) => {
        ws.userId = null;
        ws.channelId = null;

        ws.on("message", (raw) => {
            let msg;
            try { msg = JSON.parse(raw); }
            catch (e) { console.error("Message invalide:", raw.toString()); return; }

            // Rejoindre (WebRTC vocal)
            if (msg.type === "join") {
                ws.userId = msg.id;
                ws.channelId = msg.channel || null;
                clients.set(msg.id, ws);
                console.log("Client rejoint :", msg.id);
                broadcastExcept(ws, { type: "join", id: msg.id });
                return;
            }

            if (!ws.userId) return;

            // Offer WebRTC
            if (msg.type === "offer") {
                const target = clients.get(msg.target);
                if (target?.readyState === WebSocket.OPEN)
                    target.send(JSON.stringify({ type: "offer", id: ws.userId, offer: msg.offer }));
                return;
            }

            // Answer WebRTC
            if (msg.type === "answer") {
                const target = clients.get(msg.target);
                if (target?.readyState === WebSocket.OPEN)
                    target.send(JSON.stringify({ type: "answer", id: ws.userId, answer: msg.answer }));
                return;
            }

            // ICE candidate
            if (msg.type === "ice") {
                const target = clients.get(msg.target);
                if (target?.readyState === WebSocket.OPEN)
                    target.send(JSON.stringify({ type: "ice", id: ws.userId, candidate: msg.candidate }));
                return;
            }

            // Micro ON/OFF
            if (msg.type === "mic") {
                broadcastExcept(ws, { type: "mic", id: ws.userId, enabled: msg.enabled });
                return;
            }

            // Message textuel — broadcast à tous les clients connectés
            if (msg.type === "text_message") {
                broadcastExcept(ws, {
                    type: "text_message",
                    channel_id: msg.channel_id,
                    id: msg.id,
                    content: msg.content,
                    user_id: msg.user_id,
                    username: msg.username,
                    created_at: msg.created_at
                });
                return;
            }
        });

        ws.on("close", () => {
            if (ws.userId && clients.has(ws.userId)) {
                console.log("Client déconnecté :", ws.userId);
                clients.delete(ws.userId);
                broadcastExcept(ws, { type: "leave", id: ws.userId });
            }
        });
    });

    function broadcastExcept(senderWs, obj) {
        const data = JSON.stringify(obj);
        for (const [, clientWs] of clients.entries()) {
            if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN)
                clientWs.send(data);
        }
    }

    console.log("WebSocket LightCall prêt");
}

module.exports = startWebSocket;