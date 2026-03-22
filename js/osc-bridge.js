/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
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
                "OSC bridge: set WebSocket host and numeric port (or full ws:// URL in host)";
            return;
        }
        osc.status.value = "OSC bridge: connecting to " + url + " …";
        try {
            socket = new WebSocket(url);
        }
        catch (e) {
            osc.status.value = "OSC bridge: " + String(e);
            return;
        }
        socket.onopen = () => {
            osc.status.value = "OSC bridge: connected (" + url + ")";
        };
        socket.onclose = () => {
            osc.status.value = "OSC bridge: disconnected";
            if (osc.enabled.value) {
                reconnectTimer = window.setTimeout(connect, 2000);
            }
        };
        socket.onerror = () => {
            osc.status.value = "OSC bridge: WebSocket error";
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