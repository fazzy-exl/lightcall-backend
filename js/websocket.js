const WebSocket = require("ws");

function startWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    // Map des clients : userId -> ws
    const clients = new Map();

    wss.on("connection", (ws) => {
        ws.userId = null;

        ws.on("message", (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch (e) {
                console.error("Message invalide:", raw.toString());
                return;
            }

            // 1) Un client rejoint : { type: "join", id }
            if (msg.type === "join") {
                ws.userId = msg.id;
                clients.set(msg.id, ws);
                console.log("Client rejoint :", msg.id);

                // Notifier les autres qu'un nouveau arrive
                broadcastExcept(ws, {
                    type: "join",
                    id: msg.id
                });
                return;
            }

            // Si on n'a pas encore d'id, on ignore
            if (!ws.userId) return;

            // 2) Offer : { type: "offer", id, target, offer }
            if (msg.type === "offer") {
                const targetWs = clients.get(msg.target);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: "offer",
                        id: ws.userId,
                        offer: msg.offer
                    }));
                }
                return;
            }

            // 3) Answer : { type: "answer", id, target, answer }
            if (msg.type === "answer") {
                const targetWs = clients.get(msg.target);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: "answer",
                        id: ws.userId,
                        answer: msg.answer
                    }));
                }
                return;
            }

            // 4) ICE : { type: "ice", id, target, candidate }
            if (msg.type === "ice") {
                const targetWs = clients.get(msg.target);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: "ice",
                        id: ws.userId,
                        candidate: msg.candidate
                    }));
                }
                return;
            }

            // 5) Mic : { type: "mic", id, enabled }
            if (msg.type === "mic") {
                // On diffuse à tout le monde sauf l’émetteur
                broadcastExcept(ws, {
                    type: "mic",
                    id: ws.userId,
                    enabled: msg.enabled
                });
                return;
            }
        });

        ws.on("close", () => {
            if (ws.userId && clients.has(ws.userId)) {
                console.log("Client déconnecté :", ws.userId);
                clients.delete(ws.userId);

                // On pourrait notifier les autres si besoin
                // broadcastExcept(ws, { type: "leave", id: ws.userId });
            }
        });
    });

    function broadcastExcept(senderWs, obj) {
        const data = JSON.stringify(obj);
        for (const [id, clientWs] of clients.entries()) {
            if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(data);
            }
        }
    }

    console.log("WebSocket LightCall prêt (mode WebRTC)");
}

module.exports = startWebSocket;