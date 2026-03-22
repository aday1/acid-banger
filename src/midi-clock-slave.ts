/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/

import type { NumericParameter, TransportStepHandler } from "./interface.js";

const MIDI_CLOCK = 0xf8;
const MIDI_START = 0xfa;
const MIDI_CONTINUE = 0xfb;
const MIDI_STOP = 0xfc;

export type MidiSlaveClockApi = {
    bindStep(handler: TransportStepHandler): void;
    handleMessage(ev: MIDIMessageEvent): void;
    dispose(): void;
};

export function createMidiSlaveClockApi(
    bpm: NumericParameter,
    onStatus: (message: string) => void
): MidiSlaveClockApi {
    let handler: TransportStepHandler = () => {};
    let pulseIn16th = 0;
    let globalStep = 0;
    let running = true;
    let lastF8Time = 0;
    const emaAlpha = 0.12;
    let bpmEma = bpm.value;

    function handleMessage(ev: MIDIMessageEvent) {
        const data = ev.data;
        if (!data || data.length < 1) return;
        const st = data[0];
        if (st === MIDI_CLOCK) {
            const now = performance.now();
            if (lastF8Time > 0) {
                const dt = now - lastF8Time;
                if (dt > 0.5 && dt < 250) {
                    const instBpm = 60000 / (24 * dt);
                    if (
                        Number.isFinite(instBpm) &&
                        instBpm > 40 &&
                        instBpm < 300
                    ) {
                        bpmEma = emaAlpha * instBpm + (1 - emaAlpha) * bpmEma;
                        const [lo, hi] = bpm.bounds;
                        const clamped = Math.max(
                            lo,
                            Math.min(hi, Math.round(bpmEma))
                        );
                        bpm.value = clamped;
                    }
                }
            }
            lastF8Time = now;

            if (!running) return;
            pulseIn16th++;
            if (pulseIn16th >= 6) {
                pulseIn16th = 0;
                const wall = new Date().getTime();
                handler(wall, globalStep);
                globalStep++;
            }
        } else if (st === MIDI_START) {
            running = true;
            pulseIn16th = 0;
            globalStep = 0;
            lastF8Time = 0;
            onStatus("MIDI: running (start)");
        } else if (st === MIDI_CONTINUE) {
            running = true;
            onStatus("MIDI: running (continue)");
        } else if (st === MIDI_STOP) {
            running = false;
            onStatus("MIDI: stopped");
        }
    }

    return {
        bindStep(h) {
            handler = h;
        },
        handleMessage,
        dispose() {
            pulseIn16th = 0;
            globalStep = 0;
            running = true;
            lastF8Time = 0;
            bpmEma = bpm.value;
        },
    };
}
