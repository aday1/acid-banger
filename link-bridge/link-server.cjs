"use strict";

const { WebSocketServer } = require("ws");

const WS_PORT = Number(process.env.LINK_WS_PORT || 9999);

let abletonlink;
try {
    abletonlink = require("abletonlink");
} catch (e) {
    console.error(
        "Could not load native module \"abletonlink\". Install build tools and run npm install:"
    );
    console.error("  https://github.com/nodejs/node-gyp#installation");
    console.error(e.message);
    process.exit(1);
}

const wss = new WebSocketServer({ port: WS_PORT });
const link = new abletonlink();
link.enable();
if (typeof link.quantum !== "undefined") {
    link.quantum = 4;
}

const clients = new Set();

wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("message", (raw) => {
        let j;
        try {
            j = JSON.parse(raw.toString());
        } catch {
            return;
        }
        if (j.cmd === "setBpm" && typeof j.value === "number") {
            const v = j.value;
            if (v >= 20 && v <= 999) {
                link.bpm = v;
            }
        }
        if (j.cmd === "setQuantum" && typeof j.value === "number") {
            const q = j.value;
            if (q >= 0.25 && q <= 64) {
                link.quantum = q;
            }
        }
    });
    ws.on("close", () => clients.delete(ws));
});

link.startUpdate(20, (beat, phase, bpm, playState) => {
    const quantum =
        typeof link.quantum === "number" ? link.quantum : 4;
    const peers =
        typeof link.numPeers === "number" ? link.numPeers : 0;
    const payload = JSON.stringify({
        type: "link",
        beat,
        phase,
        bpm,
        quantum,
        peers,
        playing: Boolean(playState),
    });
    for (const c of clients) {
        if (c.readyState === 1) {
            c.send(payload);
        }
    }
});

console.log(
    "acid-banger Link bridge: Ableton Link session + WebSocket ws://127.0.0.1:" +
        WS_PORT
);
