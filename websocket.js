const WebSocket = require('ws');
const db = require('./database');

function startWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    // Chaque client connecté
    wss.on('connection', (ws) => {
        ws.currentChannel = null; // salon actuel

        ws.on('message', (data) => {
            const msg = JSON.parse(data);

            // Rejoindre un salon
            if (msg.type === "join_channel") {
                ws.currentChannel = msg.channel_id;
                ws.send(JSON.stringify({ type: "joined", channel_id: msg.channel_id }));
            }

            // Envoyer un message dans un salon
            if (msg.type === "signal" && ws.currentChannel) {
                wss.clients.forEach(client => {
                    if (client !== ws && client.currentChannel === ws.currentChannel) {
                        client.send(JSON.stringify({
                            type: "signal",
                            from: msg.from,
                            data: msg.data
                        }));
                    }
                });
            }
        });
    });

    console.log("WebSocket LightCall prêt");
}

module.exports = startWebSocket;
