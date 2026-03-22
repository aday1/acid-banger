/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/

import { Clock } from "./boilerplate.js";
import type { NumericParameter, SyncMode, TransportStepHandler } from "./interface.js";

const MIDI_CLOCK = 0xf8;
const MIDI_START = 0xfa;
import {
    createMidiSlaveClockApi,
    type MidiSlaveClockApi,
} from "./midi-clock-slave.js";

export type { MidiSlaveClockApi } from "./midi-clock-slave.js";

export type { TransportStepHandler } from "./interface.js";

export type ActiveTransport = {
    bind(handler: TransportStepHandler): void;
    setBpm(bpm: number): void;
    dispose(): void;
};

function createInternalTransport(initialBpm: number): ActiveTransport {
    let handler: TransportStepHandler = () => {};
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

function createMidiMasterTransport(
    initialBpm: number,
    getOutput: () => MIDIOutput | null
): ActiveTransport {
    let handler: TransportStepHandler = () => {};
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

type LinkWsPayload = {
    type?: string;
    beat?: number;
    phase?: number;
    bpm?: number;
    quantum?: number;
    peers?: number;
    playing?: boolean;
};

function createAbletonLinkTransport(
    bpm: NumericParameter,
    getWsUrl: () => string | null,
    onStatus: (message: string) => void
): ActiveTransport {
    let handler: TransportStepHandler = () => {};
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let lastRemoteBpm = -1;
    let lastGridStep = -1;

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

    function applyFrame(data: LinkWsPayload) {
        if (data.type !== "link") return;
        const q =
            typeof data.quantum === "number" && data.quantum > 0 ? data.quantum : 4;
        const ph = typeof data.phase === "number" ? data.phase : 0;
        const rawBpm = typeof data.bpm === "number" ? data.bpm : bpm.value;
        lastRemoteBpm = rawBpm;
        const [lo, hi] = bpm.bounds;
        const rounded = Math.round(rawBpm);
        bpm.value = Math.max(lo, Math.min(hi, rounded));

        const sixteenthsInQuantum = q * 4;
        const gridStep =
            Math.floor(ph * sixteenthsInQuantum + 1e-9) % 16;
        if (gridStep !== lastGridStep) {
            lastGridStep = gridStep;
            const wall = new Date().getTime();
            handler(wall, gridStep);
        }

        const peers = typeof data.peers === "number" ? data.peers : 0;
        const play = data.playing !== false;
        onStatus(
            `Link: ${rounded} BPM | peers ${peers}${play ? "" : " | transport stopped"}`
        );
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
        } catch (e) {
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
                if (getWsUrl()) connect();
            }, 2000);
        };
        socket.onerror = () => {
            onStatus("Link: WebSocket error");
        };
        socket.onmessage = (ev) => {
            if (typeof ev.data === "string") {
                try {
                    applyFrame(JSON.parse(ev.data) as LinkWsPayload);
                } catch {
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
            if (Math.abs(proposed - lastRemoteBpm) < 0.08) return;
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
        },
    };
}

function createMidiSlaveTransport(
    bpm: NumericParameter,
    clockApi: MidiSlaveClockApi
): ActiveTransport {
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

export type TransportBundle = {
    transport: ActiveTransport;
    midiSlaveClock: MidiSlaveClockApi | null;
};

export function createTransportForMode(
    mode: SyncMode,
    bpm: NumericParameter,
    getMidiOutput: () => MIDIOutput | null,
    getMidiInput: () => MIDIInput | null,
    getLinkWsUrl: () => string | null,
    onStatus: (message: string) => void
): TransportBundle {
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
