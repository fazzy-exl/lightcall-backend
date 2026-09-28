const WebSocket = require("ws");
const pool = require("./database");

function startWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    const clients = new Map();
    const allSockets = new Set();

    // channelId -> Map(userId -> { id, username, avatar_url })
    const voicePresence = new Map();

    function broadcastExcept(senderWs, obj) {
        const data = JSON.stringify(obj);
        for (const [, clientWs] of clients.entries()) {
            if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN)
                clientWs.send(data);
        }
    }

    // Diffuse à TOUT le monde connecté (même ceux qui ne sont pas en appel,
    // nécessaire pour que la sidebar se mette à jour chez tout le monde)
    function broadcastAll(obj) {
        const data = JSON.stringify(obj);
        for (const clientWs of allSockets) {
            if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
        }
    }

    function broadcastVoicePresence(channelId) {
        const usersMap = voicePresence.get(channelId);
        const users = usersMap ? Array.from(usersMap.values()) : [];
        broadcastAll({ type: "voice_presence", channel_id: channelId, users });
    }

    function sendVoicePresenceSnapshot(ws) {
        const presence = {};
        for (const [channelId, usersMap] of voicePresence.entries()) {
            presence[channelId] = Array.from(usersMap.values());
        }
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "voice_presence_full", presence }));
        }
    }

    function removeFromVoicePresence(ws) {
        if (ws.channelId && voicePresence.has(ws.channelId) && ws.userId) {
            voicePresence.get(ws.channelId).delete(String(ws.userId));
            broadcastVoicePresence(ws.channelId);
        }
    }

    wss.on("connection", (ws) => {
        ws.userId = null;
        ws.channelId = null;
        allSockets.add(ws);

        // Le nouveau client reçoit tout de suite l'état actuel des salons vocaux
        sendVoicePresenceSnapshot(ws);

        ws.on("message", async (raw) => {
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

                if (msg.channel) {
                    try {
                        const result = await pool.query(
                            "SELECT username, avatar_url FROM users WHERE id = $1",
                            [msg.id]
                        );
                        const user = result.rows[0];
                        if (user) {
                            if (!voicePresence.has(msg.channel)) voicePresence.set(msg.channel, new Map());
                            voicePresence.get(msg.channel).set(String(msg.id), {
                                id: msg.id,
                                username: user.username,
                                avatar_url: user.avatar_url
                            });
                            broadcastVoicePresence(msg.channel);
                        }
                    } catch (err) {
                        console.error("Erreur lookup utilisateur (présence vocale):", err);
                    }
                }
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

            // Caméra ON/OFF
            if (msg.type === "cam") {
                broadcastExcept(ws, { type: "cam", id: ws.userId, enabled: msg.enabled });
                return;
            }

            // Quitter le salon vocal (sans fermer l'app / la connexion WS)
            if (msg.type === "leave") {
                broadcastExcept(ws, { type: "leave", id: ws.userId });
                removeFromVoicePresence(ws);
                clients.delete(ws.userId);
                ws.channelId = null;
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
            allSockets.delete(ws);
            if (ws.userId && clients.has(ws.userId)) {
                console.log("Client déconnecté :", ws.userId);
                clients.delete(ws.userId);
                broadcastExcept(ws, { type: "leave", id: ws.userId });
            }
            removeFromVoicePresence(ws);
        });
    });

    console.log("WebSocket LightCall prêt");
}

module.exports = startWebSocket;