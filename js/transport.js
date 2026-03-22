/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
import { Clock } from "./boilerplate.js";
const MIDI_CLOCK = 0xf8;
const MIDI_START = 0xfa;
import { createMidiSlaveClockApi, } from "./midi-clock-slave.js";
function createInternalTransport(initialBpm) {
    let handler = () => { };
    const clock = Clock(initialBpm, 4, 0);
    clock.bind((t, n) => handler(t, n));
    return {
        bind(h) {
            handler = h;
        },
        setBpm(b) {
            clock.setBpm(b);
        },
        dispose() {
            clock.dispose();
        },
    };
}
function createMidiMasterTransport(initialBpm, getOutput) {
    let handler = () => { };
    let sentStart = false;
    const clock = Clock(initialBpm, 4, 0);
    clock.bind((t, n) => {
        const out = getOutput();
        if (out) {
            if (!sentStart) {
                out.send([MIDI_START]);
                sentStart = true;
            }
            for (let i = 0; i < 6; i++) {
                out.send([MIDI_CLOCK]);
            }
        }
        handler(t, n);
    });
    return {
        bind(h) {
            handler = h;
        },
        setBpm(b) {
            clock.setBpm(b);
        },
        dispose() {
            clock.dispose();
            sentStart = false;
        },
    };
}
/**
 * Map Link timeline to acid-banger's 0..15 sixteenth-step index.
 * Prefer floating `beat` + `quantum`: phase within one quantum, then *4 for sixteenths.
 * (Using raw `phase` * (quantum*4) is wrong if the native addon exposes phase per beat, which
 * makes the sequencer run several times too fast.)
 */
function linkPayloadToGridStep(data) {
    const q = typeof data.quantum === "number" && data.quantum > 0 ? data.quantum : 4;
    const bt = data.beat;
    if (typeof bt === "number" && Number.isFinite(bt)) {
        const mod = ((bt % q) + q) % q;
        const sixteenthsInQuantum = mod * 4;
        return Math.floor(sixteenthsInQuantum + 1e-9) % 16;
    }
    const ph = typeof data.phase === "number" ? data.phase : 0;
    const sixteenthsInQuantum = q * 4;
    return Math.floor(ph * sixteenthsInQuantum + 1e-9) % 16;
}
function createAbletonLinkTransport(bpm, getWsUrl, onStatus) {
    let handler = () => { };
    let socket = null;
    let reconnectTimer = null;
    let lastRemoteBpm = -1;
    let lastGridStep = -1;
    /** True while applyFrame is writing BPM from Link (blocks setBpm echo to WebSocket). */
    let applyingLinkBpm = false;
    function teardownSocket() {
        if (socket) {
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            socket.close();
            socket = null;
        }
    }
    function applyFrame(data) {
        if (data.type !== "link")
            return;
        const q = typeof data.quantum === "number" && data.quantum > 0 ? data.quantum : 4;
        const ph = typeof data.phase === "number" ? data.phase : 0;
        const rawBpm = typeof data.bpm === "number" ? data.bpm : bpm.value;
        lastRemoteBpm = rawBpm;
        const [lo, hi] = bpm.bounds;
        const rounded = Math.max(lo, Math.min(hi, Math.round(rawBpm)));
        if (rounded !== bpm.value) {
            applyingLinkBpm = true;
            try {
                bpm.value = rounded;
            }
            finally {
                applyingLinkBpm = false;
            }
        }
        const gridStep = linkPayloadToGridStep(data);
        if (gridStep !== lastGridStep) {
            lastGridStep = gridStep;
            const wall = new Date().getTime();
            handler(wall, gridStep);
        }
        const peers = typeof data.peers === "number" ? data.peers : 0;
        const play = data.playing !== false;
        const wsN = typeof data.wsClients === "number" ? data.wsClients : 0;
        const beatStr = typeof data.beat === "number" ? data.beat.toFixed(2) : "?";
        const stepStr = String(gridStep);
        onStatus(`Link: FOLLOWING session (browser is not tempo master) | ${rounded} BPM from Link | step ${stepStr}/16 | Link peers ${peers} | beat ${beatStr} phase ${ph.toFixed(3)} | quantum ${q} | WS ${wsN}` +
            (play ? "" : "\nLink transport stopped (audio may still run in Live)"));
    }
    function connect() {
        if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        teardownSocket();
        const url = getWsUrl();
        if (!url) {
            onStatus("Link: set WebSocket host and port (link-bridge)");
            return;
        }
        onStatus("Link: connecting…");
        try {
            socket = new WebSocket(url);
        }
        catch (e) {
            onStatus("Link: " + String(e));
            return;
        }
        socket.onopen = () => {
            onStatus("Link: connected (" + url + ")");
        };
        socket.onclose = () => {
            onStatus("Link: disconnected (retrying…)");
            reconnectTimer = window.setTimeout(() => {
                reconnectTimer = null;
                if (getWsUrl())
                    connect();
            }, 2000);
        };
        socket.onerror = () => {
            onStatus("Link: WebSocket error");
        };
        socket.onmessage = (ev) => {
            if (typeof ev.data === "string") {
                try {
                    applyFrame(JSON.parse(ev.data));
                }
                catch (_a) {
                    /* ignore non-JSON */
                }
            }
        };
    }
    return {
        bind(h) {
            handler = h;
            lastGridStep = -1;
            connect();
        },
        setBpm(proposed) {
            if (applyingLinkBpm)
                return;
            if (Math.abs(proposed - lastRemoteBpm) < 0.45)
                return;
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ cmd: "setBpm", value: proposed }));
            }
        },
        dispose() {
            if (reconnectTimer !== null) {
                window.clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            teardownSocket();
            lastGridStep = -1;
            lastRemoteBpm = -1;
        },
    };
}
function createMidiSlaveTransport(bpm, clockApi) {
    return {
        bind(h) {
            clockApi.bindStep(h);
        },
        setBpm() {
            /* slave tempo follows incoming clock */
        },
        dispose() {
            clockApi.dispose();
        },
    };
}
export function createTransportForMode(mode, bpm, getMidiOutput, getMidiInput, getLinkWsUrl, onStatus) {
    if (mode === "internal") {
        return {
            transport: createInternalTransport(bpm.value),
            midiSlaveClock: null,
        };
    }
    if (mode === "midi-master") {
        return {
            transport: createMidiMasterTransport(bpm.value, getMidiOutput),
            midiSlaveClock: null,
        };
    }
    if (mode === "midi-slave") {
        const clockApi = createMidiSlaveClockApi(bpm, onStatus);
        return {
            transport: createMidiSlaveTransport(bpm, clockApi),
            midiSlaveClock: clockApi,
        };
    }
    return {
        transport: createAbletonLinkTransport(bpm, getLinkWsUrl, onStatus),
        midiSlaveClock: null,
    };
}
//# sourceMappingURL=transport.js.map