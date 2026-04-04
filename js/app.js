/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { pressToStart } from "./boilerplate.js";
import { Audio } from "./audio.js";
import { NineOhGen, ThreeOhGen } from "./pattern.js";
import { UI } from "./ui.js";
import { genericParameter, parameter, trigger, } from "./interface.js";
import { createTransportForMode, } from "./transport.js";
import { buildMidiTargetRegistry, createMidiLearnController, } from "./midi-learn.js";
import { createAcidMidiMirror } from "./midi-mirror.js";
import { attachOscBridgeClient } from "./osc-bridge.js";
import { getFirstMidiInput, getFirstMidiOutput, getMidiInputById, getMidiOutputById, } from "./midi-helpers.js";
function wireMixerAudio(state, gainNodes) {
    function refresh() {
        const anySolo = state.mixer.strips.some((s) => s.solo.value);
        for (let i = 0; i < 3; i++) {
            const st = state.mixer.strips[i];
            let v = st.level.value;
            if (st.mute.value) {
                v = 0;
            }
            else if (anySolo && !st.solo.value) {
                v = 0;
            }
            gainNodes[i].gain.value = v;
        }
    }
    for (const st of state.mixer.strips) {
        st.level.subscribe(refresh);
        st.mute.subscribe(refresh);
        st.solo.subscribe(refresh);
    }
    refresh();
}
function WanderingParameter(param, scaleFactor = 1 / 400) {
    const [min, max] = param.bounds;
    let diff = 0.0;
    let scale = scaleFactor * (max - min);
    let touchCountdown = 0;
    let previousValue = (min + max) / 2;
    const step = () => {
        if (previousValue != param.value) {
            diff = 0;
            previousValue = param.value;
            touchCountdown = 200;
        }
        else {
            if (touchCountdown > 0) {
                touchCountdown--;
            }
            if (touchCountdown < 100) {
                diff *= touchCountdown > 0 ? 0.8 : 0.98;
                diff += (Math.random() - 0.5) * scale;
                param.value += diff;
                previousValue = param.value;
                if (param.value > min + 0.8 * (max - min)) {
                    diff -= Math.random() * scale;
                }
                else if (param.value < min + 0.2 * (max - min)) {
                    diff += Math.random() * scale;
                }
            }
        }
    };
    return {
        step,
    };
}
function ThreeOhUnit(audio, waveform, output, gen, patternLength = 16) {
    const synth = audio.ThreeOh(waveform, output);
    const pattern = genericParameter("Pattern", []);
    const newPattern = trigger("New Pattern Trigger", true);
    gen.newNotes.subscribe((newNotes) => {
        if (newNotes == true)
            newPattern.value = true;
    });
    function step(index) {
        if ((index === 0 && newPattern.value == true) || pattern.value.length == 0) {
            pattern.value = gen.createPattern();
            newPattern.value = false;
        }
        const slot = pattern.value[index % patternLength];
        if (slot.note != "-") {
            synth.noteOn(slot.note, slot.accent, slot.glide);
        }
        else {
            synth.noteOff();
        }
    }
    const parameters = {
        cutoff: parameter("Cutoff", [30, 700], 400),
        resonance: parameter("Resonance", [1, 30], 15),
        envMod: parameter("Env Mod", [0, 8000], 4000),
        decay: parameter("Decay", [0.1, 0.9], 0.5),
    };
    parameters.cutoff.subscribe((v) => (synth.params.cutoff.value = v));
    parameters.resonance.subscribe((v) => (synth.params.resonance.value = v));
    parameters.envMod.subscribe((v) => (synth.params.envMod.value = v));
    parameters.decay.subscribe((v) => (synth.params.decay.value = v));
    return {
        step,
        pattern,
        parameters,
        newPattern,
    };
}
function NineOhUnit(audio_1) {
    return __awaiter(this, arguments, void 0, function* (audio, drumBus = audio.master.in) {
        const drums = yield audio.SamplerDrumMachine(["909BD.mp3", "909OH.mp3", "909CH.mp3", "909SD.mp3"], drumBus);
        const pattern = genericParameter("Drum Pattern", []);
        const mutes = [
            genericParameter("Mute BD", false),
            genericParameter("Mute OH", false),
            genericParameter("Mute CH", false),
            genericParameter("Mute SD", false),
        ];
        const newPattern = trigger("New Pattern Trigger", true);
        const gen = NineOhGen();
        function step(index) {
            if ((index == 0 && newPattern.value == true) || pattern.value.length == 0) {
                pattern.value = gen.createPatterns(true);
                newPattern.value = false;
            }
            for (let i in pattern.value) {
                const entry = pattern.value[i][index % pattern.value[i].length];
                if (entry && !mutes[i].value) {
                    drums.triggers[i].play(entry);
                }
            }
        }
        return {
            step,
            pattern,
            mutes,
            newPattern,
        };
    });
}
function DelayUnit(audio) {
    const dryWet = parameter("Dry/Wet", [0, 0.5], 0.5);
    const feedback = parameter("Feedback", [0, 0.9], 0.3);
    const delayTime = parameter("Time", [0, 2], 0.3);
    const delay = audio.DelayInsert(delayTime.value, dryWet.value, feedback.value);
    dryWet.subscribe((w) => (delay.wet.value = w));
    feedback.subscribe((f) => (delay.feedback.value = f));
    delayTime.subscribe((t) => (delay.delayTime.value = t));
    return {
        dryWet,
        feedback,
        delayTime,
        inputNode: delay.in,
    };
}
function AutoPilot(state) {
    const nextMeasure = parameter("upcomingMeasure", [0, Infinity], 0);
    const currentMeasure = parameter("measure", [0, Infinity], 0);
    const patternEnabled = genericParameter("Alter Patterns", true);
    const dialsEnabled = genericParameter("Twiddle With Knobs", true);
    const mutesEnabled = genericParameter("Mute Drum Parts", true);
    state.clock.currentStep.subscribe((step) => {
        if (step === 4) {
            nextMeasure.value = nextMeasure.value + 1;
        }
        else if (step === 15) {
            currentMeasure.value = currentMeasure.value + 1;
        }
    });
    nextMeasure.subscribe((measure) => {
        if (patternEnabled.value) {
            if (measure % 64 === 0) {
                if (Math.random() < 0.2) {
                    state.gen.newNotes.value = true;
                }
            }
            if (measure % 16 === 0) {
                state.notes.forEach((n) => {
                    if (Math.random() < 0.5) {
                        n.newPattern.value = true;
                    }
                });
                if (Math.random() < 0.3) {
                    state.drums.newPattern.value = true;
                }
            }
        }
    });
    currentMeasure.subscribe((measure) => {
        if (mutesEnabled.value) {
            if (measure % 8 == 0) {
                const drumMutes = [
                    Math.random() < 0.2,
                    Math.random() < 0.5,
                    Math.random() < 0.5,
                    Math.random() < 0.5,
                ];
                state.drums.mutes[0].value = drumMutes[0];
                state.drums.mutes[1].value = drumMutes[1];
                state.drums.mutes[2].value = drumMutes[2];
                state.drums.mutes[3].value = drumMutes[3];
            }
        }
    });
    const noteParams = state.notes.flatMap((x) => Object.values(x.parameters));
    const delayParams = [state.delay.feedback, state.delay.dryWet];
    const wanderers = [...noteParams, ...delayParams].map((param) => WanderingParameter(param));
    window.setInterval(() => {
        if (dialsEnabled.value)
            wanderers.forEach((w) => w.step());
    }, 100);
    return {
        switches: [patternEnabled, dialsEnabled, mutesEnabled],
    };
}
function buildClock(midiAccess, midiInputId, midiOutputId, linkWsHost, linkWsPort, getMidiOutput, getMidiInput) {
    const bpm = parameter("BPM", [70, 200], 142);
    const currentStep = parameter("Current Step", [0, 15], 0);
    const syncMode = genericParameter("sync mode", "internal");
    const midiStatusText = genericParameter("midi status", midiAccess ? "MIDI ready" : "MIDI API unavailable");
    const midiDeviceEpoch = genericParameter("midi epoch", 0);
    const transportRef = { current: null };
    const midiSlaveClockRef = {
        current: null,
    };
    const stepHandler = (_t, n) => {
        currentStep.value = n % 16;
    };
    function setStatus(msg) {
        midiStatusText.value = msg;
    }
    function getLinkWsUrl() {
        const h = linkWsHost.value.trim();
        const p = linkWsPort.value.trim();
        if (!h)
            return null;
        if (h.includes("://")) {
            return h.startsWith("ws://") || h.startsWith("wss://") ? h : null;
        }
        if (!/^\d+$/.test(p))
            return null;
        return `ws://${h}:${p}`;
    }
    function rebuildTransport() {
        if (transportRef.current) {
            transportRef.current.dispose();
        }
        const bundle = createTransportForMode(syncMode.value, bpm, getMidiOutput, getMidiInput, getLinkWsUrl, setStatus);
        transportRef.current = bundle.transport;
        midiSlaveClockRef.current = bundle.midiSlaveClock;
        transportRef.current.bind(stepHandler);
        transportRef.current.setBpm(bpm.value);
    }
    function disposeTransport() {
        if (transportRef.current) {
            transportRef.current.dispose();
            transportRef.current = null;
        }
        midiSlaveClockRef.current = null;
    }
    rebuildTransport();
    bpm.subscribe((b) => { var _a; return (_a = transportRef.current) === null || _a === void 0 ? void 0 : _a.setBpm(b); });
    syncMode.subscribe(() => rebuildTransport());
    midiInputId.subscribe(() => rebuildTransport());
    midiOutputId.subscribe(() => rebuildTransport());
    linkWsHost.subscribe(() => rebuildTransport());
    linkWsPort.subscribe(() => rebuildTransport());
    if (midiAccess) {
        midiAccess.addEventListener("statechange", () => {
            midiDeviceEpoch.value = midiDeviceEpoch.value + 1;
        });
    }
    const clock = {
        bpm,
        currentStep,
        syncMode,
        midiInputId,
        midiOutputId,
        midiStatusText,
        midiDeviceEpoch,
        linkWsHost,
        linkWsPort,
        rebuildTransport,
        disposeTransport,
    };
    return { clock, transportRef, midiSlaveClockRef };
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof location !== "undefined" && location.protocol === "file:") {
            throw new Error("Cannot load drum samples from a file:// page (browser blocks fetch). Use http:// — run Launch-AcidBanger.ps1 from the repo or: npm run dev");
        }
        const audio = Audio();
        if (audio.context.state === "suspended") {
            yield audio.context.resume();
        }
        let midiAccess = null;
        try {
            midiAccess = yield navigator.requestMIDIAccess({ sysex: false });
        }
        catch (_a) {
            /* Web MIDI missing or denied */
        }
        const midiInputId = genericParameter("midi in id", "");
        const midiOutputId = genericParameter("midi out id", "");
        const linkWsHost = genericParameter("link ws host", "127.0.0.1");
        const linkWsPort = genericParameter("link ws port", "9999");
        function getMidiOutput() {
            if (!midiAccess)
                return null;
            const id = midiOutputId.value;
            if (id) {
                return getMidiOutputById(midiAccess, id);
            }
            return getFirstMidiOutput(midiAccess);
        }
        function getMidiInput() {
            if (!midiAccess)
                return null;
            const id = midiInputId.value;
            if (id) {
                return getMidiInputById(midiAccess, id);
            }
            return getFirstMidiInput(midiAccess);
        }
        const { clock, midiSlaveClockRef } = buildClock(midiAccess, midiInputId, midiOutputId, linkWsHost, linkWsPort, getMidiOutput, getMidiInput);
        const delay = DelayUnit(audio);
        clock.bpm.subscribe((b) => (delay.delayTime.value = (3 / 4) * (60 / b)));
        const strip303a = audio.context.createGain();
        const strip303b = audio.context.createGain();
        const strip909 = audio.context.createGain();
        strip303a.gain.value = 1;
        strip303b.gain.value = 1;
        strip909.gain.value = 1;
        strip303a.connect(delay.inputNode);
        strip303b.connect(delay.inputNode);
        strip909.connect(audio.master.in);
        const gen = ThreeOhGen();
        const oscEnabled = genericParameter("Connect OSC bridge", false);
        const oscWsHost = genericParameter("osc ws host", "127.0.0.1");
        const oscWsPort = genericParameter("osc ws port", "8765");
        const oscBridgeUdpListen = genericParameter("osc bridge udp listen", "57121");
        const oscOutHost = genericParameter("osc out host", "127.0.0.1");
        const oscOutPort = genericParameter("osc out port", "9000");
        const oscEmitStep = genericParameter("Emit OSC /acid/step", false);
        const oscEmitBpm = genericParameter("Emit OSC /acid/bpm", false);
        const oscLastIn = genericParameter("osc last in", "");
        const oscStatus = genericParameter("osc status", "");
        const programState = {
            notes: [
                ThreeOhUnit(audio, "sawtooth", strip303a, gen),
                ThreeOhUnit(audio, "square", strip303b, gen),
            ],
            drums: yield NineOhUnit(audio, strip909),
            gen,
            delay,
            clock,
            masterVolume: parameter("Volume", [0, 1], 0.5),
            midiLearn: {
                statusLine: genericParameter("midi learn status", ""),
                lastIncoming: genericParameter("midi last incoming", ""),
                listEpoch: genericParameter("midi learn list epoch", 0),
            },
            osc: {
                enabled: oscEnabled,
                wsHost: oscWsHost,
                wsPort: oscWsPort,
                bridgeUdpListenPort: oscBridgeUdpListen,
                outHost: oscOutHost,
                outPort: oscOutPort,
                emitStepOsc: oscEmitStep,
                emitBpmOsc: oscEmitBpm,
                lastIncomingOsc: oscLastIn,
                status: oscStatus,
            },
            mixer: {
                strips: [
                    {
                        level: parameter("303-01 level", [0, 1], 1),
                        mute: genericParameter("303-01 mute", false),
                        solo: genericParameter("303-01 solo", false),
                    },
                    {
                        level: parameter("303-02 level", [0, 1], 1),
                        mute: genericParameter("303-02 mute", false),
                        solo: genericParameter("303-02 solo", false),
                    },
                    {
                        level: parameter("909 level", [0, 1], 1),
                        mute: genericParameter("909 mute", false),
                        solo: genericParameter("909 solo", false),
                    },
                ],
            },
        };
        wireMixerAudio(programState, [strip303a, strip303b, strip909]);
        programState.masterVolume.subscribe((newVolume) => {
            audio.master.in.gain.value = newVolume;
        });
        const midiMirror = createAcidMidiMirror(getMidiOutput, [1, 2]);
        programState.clock.currentStep.subscribe((step) => {
            for (const n of programState.notes) {
                n.step(step);
            }
            midiMirror.step(programState.notes, step);
            programState.drums.step(step);
        });
        const autoPilot = AutoPilot(programState);
        const midiTargets = buildMidiTargetRegistry(programState, autoPilot);
        const midiLearnCtl = createMidiLearnController({
            targetsById: midiTargets,
            bumpListEpoch: () => {
                programState.midiLearn.listEpoch.value =
                    programState.midiLearn.listEpoch.value + 1;
            },
            setStatus: (s) => {
                programState.midiLearn.statusLine.value = s;
            },
            setLastIncoming: (s) => {
                programState.midiLearn.lastIncoming.value = s;
            },
        });
        let midiInputAttached = null;
        function wireMidiInput() {
            const inp = getMidiInput();
            if (inp === midiInputAttached)
                return;
            if (midiInputAttached) {
                midiInputAttached.onmidimessage = null;
            }
            midiInputAttached = inp;
            if (!inp)
                return;
            inp.onmidimessage = (ev) => {
                var _a;
                midiLearnCtl.handleMidiMessage(ev);
                if (programState.clock.syncMode.value === "midi-slave") {
                    (_a = midiSlaveClockRef.current) === null || _a === void 0 ? void 0 : _a.handleMessage(ev);
                }
            };
        }
        window.setInterval(wireMidiInput, 800);
        wireMidiInput();
        programState.clock.midiInputId.subscribe(wireMidiInput);
        programState.clock.midiDeviceEpoch.subscribe(wireMidiInput);
        programState.clock.syncMode.subscribe(wireMidiInput);
        const oscBridge = attachOscBridgeClient(programState, programState.clock.bpm, {
            onMidiCc(channel0Based, cc, value) {
                midiLearnCtl.handleMappedCc(channel0Based, cc, value);
            },
            onMidiNote(channel0Based, note, velocity) {
                midiLearnCtl.handleMappedNote(channel0Based, note, velocity);
            },
        });
        let lastBpmOscSent = -1;
        programState.clock.currentStep.subscribe((step) => {
            if (programState.osc.emitStepOsc.value) {
                oscBridge.sendOscOut("/acid/step", [step]);
            }
        });
        programState.clock.bpm.subscribe((b) => {
            if (!programState.osc.emitBpmOsc.value) {
                lastBpmOscSent = -1;
                return;
            }
            const r = Math.round(b);
            if (r === lastBpmOscSent)
                return;
            lastBpmOscSent = r;
            oscBridge.sendOscOut("/acid/bpm", [b]);
        });
        const ui = UI(programState, autoPilot, audio.master.analyser, midiAccess, {
            startMidiLearnForTarget(id) {
                midiLearnCtl.startLearnForTarget(id);
            },
            cancelPendingMidiLearn() {
                midiLearnCtl.cancelPendingLearn();
            },
            isMidiLearnPending() {
                return midiLearnCtl.isLearnPending();
            },
            forgetMidiMapping(id) {
                midiLearnCtl.forgetTarget(id);
            },
            clearAllMidiMappings() {
                midiLearnCtl.clearAll();
            },
            getMidiMappingsList() {
                return midiLearnCtl.getBindingsList();
            },
            getMidiMappingForTarget(id) {
                var _a;
                const row = midiLearnCtl
                    .getBindingsList()
                    .find((entry) => entry.targetId === id);
                return (_a = row === null || row === void 0 ? void 0 : row.binding) !== null && _a !== void 0 ? _a : null;
            },
            getMidiTargets() {
                return Array.from(midiTargets.values()).map((target) => ({
                    id: target.id,
                    label: target.label,
                    kind: target.kind,
                }));
            },
        });
        document.body.append(ui);
    });
}
pressToStart(start, "The Endless Acid Banger", "remixed by aday <a href=\"https://github.com/aday1/acid-banger\">https://github.com/aday1/acid-banger</a><br>forked from <a href=\"https://github.com/vitling/acid-banger\">https://github.com/vitling/acid-banger</a>");
//# sourceMappingURL=app.js.map