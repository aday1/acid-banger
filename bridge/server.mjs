import dgram from "node:dgram";
import osc from "osc";
import { WebSocketServer } from "ws";

const UDP_PORT = Number(process.env.OSC_UDP_PORT || 57121);
const WS_PORT = Number(process.env.OSC_WS_PORT || 8765);

const wss = new WebSocketServer({ port: WS_PORT });

const oscPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: UDP_PORT,
    metadata: true,
});

const clients = new Set();
const udpSender = dgram.createSocket("udp4");

function broadcastJson(obj) {
    const s = JSON.stringify(obj);
    for (const ws of clients) {
        if (ws.readyState === 1) {
            ws.send(s);
        }
    }
}

function sendOscUdp(address, args, remoteHost, remotePort) {
    const host = typeof remoteHost === "string" ? remoteHost.trim() : "127.0.0.1";
    const port = Number(remotePort);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
        return;
    }
    const oscArgs = (Array.isArray(args) ? args : []).map((v) => ({
        type: "f",
        value: Number(v),
    }));
    let buf;
    try {
        buf = osc.writeMessage({
            address: String(address),
            args: oscArgs,
        });
    } catch (e) {
        console.error("osc write failed", e);
        return;
    }
    udpSender.send(buf, port, host, (err) => {
        if (err) console.error("udp send failed", err);
    });
}

oscPort.on("message", (msg) => {
    broadcastJson({
        address: msg.address,
        args: (msg.args || []).map((a) => a.value),
    });
});

oscPort.open();

wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("message", (raw) => {
        let j;
        try {
            j = JSON.parse(raw.toString());
        } catch {
            return;
        }
        if (j.cmd === "oscSend" && j.address) {
            sendOscUdp(j.address, j.args, j.remoteHost, j.remotePort);
        }
    });
    ws.on("close", () => clients.delete(ws));
});

console.log(
    "acid-banger OSC bridge: listen UDP",
    UDP_PORT,
    "WebSocket ws://127.0.0.1:" + WS_PORT,
    "| browser sends oscSend -> UDP out"
);
