/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
/** User-facing: "127.0.0.1 port 8765" instead of ws:// jargon */
function describeBridgeSocket(url) {
    const m = url.match(/^wss?:\/\/([^/:]+)(?::(\d+))?/i);
    if (m) {
        const host = m[1];
        const port = m[2];
        return port ? `${host} port ${port}` : host;
    }
    return url;
}
function buildWsUrl(state) {
    const h = state.osc.wsHost.value.trim();
    const p = state.osc.wsPort.value.trim();
    if (!h)
        return null;
    if (h.includes("://")) {
        return h;
    }
    if (!/^\d+$/.test(p)) {
        return null;
    }
    return `ws://${h}:${p}`;
}
export function attachOscBridgeClient(state, bpm) {
    const { osc } = state;
    let socket = null;
    let reconnectTimer = null;
    function isConnected() {
        return socket !== null && socket.readyState === WebSocket.OPEN;
    }
    function disconnect() {
        if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (socket) {
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            socket.close();
            socket = null;
        }
    }
    function applyIncoming(raw) {
        var _a, _b;
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch (_c) {
            return;
        }
        if (data.cmd)
            return;
        const addr = (_a = data.address) !== null && _a !== void 0 ? _a : "";
        const args = (_b = data.args) !== null && _b !== void 0 ? _b : [];
        const preview = addr +
            (args.length ? " " + args.map((a) => String(a)).join(" ") : "");
        osc.lastIncomingOsc.value = preview;
        if (addr === "/acid/bpm" || addr.endsWith("/bpm")) {
            const v = Number(args[0]);
            if (Number.isFinite(v)) {
                const [lo, hi] = bpm.bounds;
                bpm.value = Math.max(lo, Math.min(hi, v));
            }
        }
    }
    function connect() {
        if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (socket) {
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            socket.close();
            socket = null;
        }
        if (!osc.enabled.value) {
            osc.status.value = "";
            return;
        }
        const url = buildWsUrl(state);
        if (!url) {
            osc.status.value =
                "OSC bridge: set host (e.g. 127.0.0.1) and WS port (e.g. 8765) to match bridge/server.mjs (see bridge README link in the OSC panel).";
            return;
        }
        osc.status.value =
            "OSC bridge: connecting to Node at " +
                describeBridgeSocket(url) +
                " (start bridge/server.mjs if this hangs; bridge README link in this panel)";
        try {
            socket = new WebSocket(url);
        }
        catch (e) {
            osc.status.value = "OSC bridge: " + String(e);
            return;
        }
        socket.onopen = () => {
            osc.status.value =
                "OSC bridge: connected to Node at " +
                    describeBridgeSocket(url) +
                    ". TouchOSC and other OSC apps use UDP to the listen port below, not this connection.";
        };
        socket.onclose = () => {
            osc.status.value = "OSC bridge: disconnected";
            if (osc.enabled.value) {
                reconnectTimer = window.setTimeout(connect, 2000);
            }
        };
        socket.onerror = () => {
            osc.status.value =
                "OSC bridge: could not reach Node (run bridge/server.mjs or use Start OSC bridge link; check host/port match OSC_WS_PORT, default 8765)";
        };
        socket.onmessage = (ev) => {
            if (typeof ev.data === "string") {
                applyIncoming(ev.data);
            }
        };
    }
    function reconnect() {
        disconnect();
        connect();
    }
    function sendOscOut(address, args) {
        if (!isConnected())
            return;
        const host = osc.outHost.value.trim() || "127.0.0.1";
        const port = parseInt(osc.outPort.value.trim(), 10);
        if (!Number.isFinite(port))
            return;
        const payload = JSON.stringify({
            cmd: "oscSend",
            address,
            args,
            remoteHost: host,
            remotePort: port,
        });
        socket === null || socket === void 0 ? void 0 : socket.send(payload);
    }
    osc.enabled.subscribe(() => reconnect());
    osc.wsHost.subscribe(() => {
        if (osc.enabled.value)
            reconnect();
    });
    osc.wsPort.subscribe(() => {
        if (osc.enabled.value)
            reconnect();
    });
    return { sendOscOut, isConnected };
}
//# sourceMappingURL=osc-bridge.js.map