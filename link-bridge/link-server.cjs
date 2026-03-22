"use strict";

const http = require("http");
const { WebSocketServer } = require("ws");

const WS_PORT = Number(process.env.LINK_WS_PORT || 9999);
const HTTP_PORT = Number(
    process.env.LINK_HTTP_PORT || String(WS_PORT + 1)
);

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

function dashboardHtml(wsPort, httpPort) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>acid-banger Link bridge</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;background:#0a0a10;color:#ddd;margin:0;padding:16px;max-width:520px;}
h1{font-size:1.1rem;color:#c9a8e8;margin:0 0 8px;}
.sub{color:#888;font-size:0.85rem;margin-bottom:16px;line-height:1.4;}
.big{font-size:2.4rem;font-weight:700;color:#fff;letter-spacing:0.04em;}
.row{margin:10px 0;font-size:0.95rem;}
.label{color:#888;display:inline-block;min-width:140px;}
#st{color:#9ab;font-size:0.8rem;margin-top:16px;white-space:pre-wrap;}
.err{color:#f88;}
.ok{color:#8c8;}
</style>
</head>
<body>
<h1>Ableton Link bridge (acid-banger)</h1>
<div class="sub">Source: native Link session on this PC (Ableton Live, other Link apps).<br>
Destination: WebSocket to browser tab(s) on ws://127.0.0.1:${wsPort}</div>
<div class="big" id="bpm">--</div>
<div class="row"><span class="label">Playing</span><span id="play">--</span></div>
<div class="row"><span class="label">Link peers</span><span id="peers">--</span> <span class="sub">(other Link apps)</span></div>
<div class="row"><span class="label">WebSocket clients</span><span id="wsc">--</span> <span class="sub">(acid-banger + this page)</span></div>
<div class="row"><span class="label">Beat</span><span id="beat">--</span></div>
<div class="row"><span class="label">Phase</span><span id="phase">--</span></div>
<div class="row"><span class="label">Quantum</span><span id="quantum">--</span></div>
<div id="st" class="err">Connecting...</div>
<script>
(function(){
var el=function(id){return document.getElementById(id);};
var url="ws://127.0.0.1:${wsPort}";
var ws;
function connect(){
el("st").textContent="Connecting to "+url+" ...";
el("st").className="err";
ws=new WebSocket(url);
ws.onopen=function(){
el("st").textContent="Connected. Leave this tab open to keep counting WS clients.";
el("st").className="ok";
};
ws.onclose=function(){
el("st").textContent="Disconnected. Retrying in 2s...";
el("st").className="err";
setTimeout(connect,2000);
};
ws.onerror=function(){
el("st").textContent="WebSocket error (check port ${wsPort})";
el("st").className="err";
};
ws.onmessage=function(ev){
try{var d=JSON.parse(ev.data);}catch(e){return;}
if(d.type!=="link")return;
el("bpm").textContent=(typeof d.bpm==="number")?d.bpm.toFixed(2):"--";
el("play").textContent=d.playing!==false?"yes":"no";
el("peers").textContent=(typeof d.peers==="number")?String(d.peers):"--";
el("wsc").textContent=(typeof d.wsClients==="number")?String(d.wsClients):"--";
el("beat").textContent=(typeof d.beat==="number")?d.beat.toFixed(3):"--";
el("phase").textContent=(typeof d.phase==="number")?d.phase.toFixed(4):"--";
el("quantum").textContent=(typeof d.quantum==="number")?String(d.quantum):"--";
};
}
connect();
})();
</script>
</body>
</html>`;
}

const dashboardPage = dashboardHtml(WS_PORT, HTTP_PORT);

const httpServer = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        });
        res.end(dashboardPage);
        return;
    }
    res.writeHead(404);
    res.end();
});

if (HTTP_PORT >= 1 && HTTP_PORT <= 65535 && HTTP_PORT !== WS_PORT) {
    httpServer.on("error", (err) => {
        console.warn(
            "Link bridge HTTP status UI not available:",
            err && err.message ? err.message : err
        );
    });
    httpServer.listen(HTTP_PORT, "127.0.0.1", () => {
        console.log(
            "acid-banger Link bridge status UI:  http://127.0.0.1:" +
                HTTP_PORT +
                "/"
        );
    });
} else {
    console.warn(
        "LINK_HTTP_PORT invalid or same as WS; status page not started."
    );
}

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
        wsClients: clients.size,
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
