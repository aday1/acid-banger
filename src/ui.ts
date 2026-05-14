/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/

import {
    DelayUnit,
    DrumPattern,
    GeneralisedParameter,
    ClockUnit,
    NoteGenerator,
    NumericParameter,
    PatternParameter,
    ProgramState,
    ThreeOhMachine,
    Trigger,
    AutoPilotUnit,
    SyncMode,
} from "./interface.js";
import type { MidiBinding } from "./midi-learn.js";
import { textNoteToNumber } from "./audio.js";
import { Dial } from "./dial.js";
import { VerticalFader } from "./fader.js";
import { midiPortMapHasId } from "./midi-helpers.js";
import { Acid303Visual } from "./viz-303.js";

export type MidiUiCallbacks = {
    startMidiLearnForTarget(id: string): void;
    cancelPendingMidiLearn(): void;
    isMidiLearnPending(): boolean;
    forgetMidiMapping(id: string): void;
    clearAllMidiMappings(): void;
    getMidiMappingsList(): {
        targetId: string;
        label: string;
        binding: MidiBinding;
    }[];
    getMidiMappingForTarget(id: string): MidiBinding | null;
    getMidiTargets(): {
        id: string;
        label: string;
        kind: "numeric" | "bool" | "trigger";
    }[];
};

export type MidiTargetMenu = {
    attach(el: HTMLElement, targetId: string): void;
};

function syncModeRoleLabel(mode: SyncMode): string {
    switch (mode) {
        case "internal":
            return "Internal (master)";
        case "midi-master":
            return "MIDI master";
        case "midi-slave":
            return "MIDI slave";
        case "ableton-link":
            return "Ableton Link (follow session)";
        default:
            return String(mode);
    }
}

function createBpmTempoHeader(clock: ClockUnit): HTMLElement {
    const wrap = document.createElement("div");
    wrap.classList.add("bpm-tempo-header");
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    wrap.setAttribute("aria-atomic", "true");

    const bpmEl = document.createElement("span");
    bpmEl.classList.add("bpm-tempo-header-bpm");
    const sep = document.createElement("span");
    sep.classList.add("bpm-tempo-header-sep");
    sep.innerText = " — ";
    const modeEl = document.createElement("span");
    modeEl.classList.add("bpm-tempo-header-mode");

    const right = document.createElement("div");
    right.classList.add("bpm-tempo-header-right");

    const leds = document.createElement("div");
    leds.classList.add("bpm-beat-leds");
    leds.title =
        "Quarter notes in the 16-step bar: bright = downbeat (step 1).";
    const ledEls: HTMLSpanElement[] = [];
    for (let i = 0; i < 4; i++) {
        const dot = document.createElement("span");
        dot.classList.add("bpm-beat-led");
        dot.setAttribute("aria-hidden", "true");
        leds.append(dot);
        ledEls.push(dot);
    }

    const tapWrap = document.createElement("div");
    tapWrap.classList.add("bpm-tap-wrap");
    const tapBtn = document.createElement("button");
    tapBtn.type = "button";
    tapBtn.classList.add("bpm-tap-btn");
    tapBtn.innerText = "TAP";
    tapBtn.title =
        "Tap tempo in time with the music. Beat 1-4 shows your place in the bar; BPM updates from your tap spacing (after two or more taps).";
    const tapBeat = document.createElement("span");
    tapBeat.classList.add("bpm-tap-beat-num");
    tapBeat.setAttribute("aria-live", "polite");
    tapWrap.append(tapBtn, tapBeat);

    function refresh() {
        bpmEl.textContent = `${Math.round(clock.bpm.value)} BPM`;
        modeEl.textContent = syncModeRoleLabel(clock.syncMode.value);
    }
    clock.bpm.subscribe(refresh);
    clock.syncMode.subscribe(refresh);
    refresh();

    function syncBeatLeds(step: number) {
        const q = step % 4;
        for (let i = 0; i < 4; i++) {
            const on = i === q;
            ledEls[i].classList.toggle("bpm-beat-led--on", on);
            ledEls[i].classList.toggle("bpm-beat-led--downbeat", on && step === 0);
        }
    }

    let flashTimer: number | null = null;
    function pulseTransportFlash(isDownbeat: boolean) {
        if (flashTimer !== null) {
            window.clearTimeout(flashTimer);
            flashTimer = null;
        }
        wrap.classList.remove(
            "bpm-tempo-header-flash-downbeat",
            "bpm-tempo-header-flash-beat"
        );
        void wrap.offsetWidth;
        wrap.classList.add(
            isDownbeat
                ? "bpm-tempo-header-flash-downbeat"
                : "bpm-tempo-header-flash-beat"
        );
        flashTimer = window.setTimeout(() => {
            wrap.classList.remove(
                "bpm-tempo-header-flash-downbeat",
                "bpm-tempo-header-flash-beat"
            );
            flashTimer = null;
        }, isDownbeat ? 160 : 110);
    }

    let stepFlashReady = false;
    clock.currentStep.subscribe((step) => {
        syncBeatLeds(step);
        if (stepFlashReady && step % 4 === 0) {
            pulseTransportFlash(step === 0);
        }
        stepFlashReady = true;
    });

    function syncTapForClockMode() {
        const link = clock.syncMode.value === "ableton-link";
        tapBtn.disabled = link;
        tapBtn.title = link
            ? "Disabled while on Ableton Link: BPM and grid come from the Link session (e.g. change tempo in Live). You are not the tempo master here."
            : "Tap tempo in time with the music. Beat 1-4 shows your place in the bar; BPM updates from your tap spacing (after two or more taps).";
    }
    clock.syncMode.subscribe(syncTapForClockMode);
    syncTapForClockMode();

    const TAP_GAP_MS = 2200;
    let tapTimes: number[] = [];
    tapBtn.addEventListener("click", () => {
        if (clock.syncMode.value === "ableton-link") {
            return;
        }
        const now = performance.now();
        tapTimes = tapTimes.filter((t) => now - t < TAP_GAP_MS);
        tapTimes.push(now);

        const beatInBar = ((tapTimes.length - 1) % 4) + 1;
        tapBeat.textContent = String(beatInBar);
        tapBeat.classList.remove("bpm-tap-beat-num--pop");
        void tapBeat.offsetWidth;
        tapBeat.classList.add("bpm-tap-beat-num--pop");
        window.setTimeout(() => {
            tapBeat.classList.remove("bpm-tap-beat-num--pop");
        }, 280);

        if (tapTimes.length >= 2) {
            const gaps: number[] = [];
            for (let i = 1; i < tapTimes.length; i++) {
                gaps.push(tapTimes[i] - tapTimes[i - 1]);
            }
            const avg =
                gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
            if (avg >= 200 && avg <= 900) {
                const nextBpm = Math.round(60000 / avg);
                const [lo, hi] = clock.bpm.bounds;
                clock.bpm.value = Math.max(lo, Math.min(hi, nextBpm));
            }
        }
    });

    right.append(leds, tapWrap);
    wrap.append(bpmEl, sep, modeEl, right);
    return wrap;
}

function createMidiTargetContextMenu(cb: MidiUiCallbacks): MidiTargetMenu {
    let menu: HTMLDivElement | null = null;
    let globalsBound = false;

    function closeMenu() {
        if (menu) {
            menu.remove();
            menu = null;
        }
    }

    function onDocPointerDown(ev: Event) {
        if (!menu) return;
        const t = ev.target as Node;
        if (!menu.contains(t)) {
            closeMenu();
        }
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            closeMenu();
        }
    }

    function bindGlobals() {
        if (globalsBound) return;
        globalsBound = true;
        document.addEventListener("pointerdown", onDocPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
    }

    function openMenu(clientX: number, clientY: number, targetId: string) {
        closeMenu();
        bindGlobals();
        const box = document.createElement("div");
        box.className = "midi-ctx-menu";

        function formatBinding(binding: MidiBinding | null): string {
            if (!binding) return "Current mapping: none";
            const kind = binding.kind.toUpperCase();
            return `Current mapping: ${kind} ch${binding.channel + 1} #${binding.number}`;
        }

        const mappedNow = document.createElement("div");
        mappedNow.className = "midi-ctx-current";
        mappedNow.textContent = formatBinding(cb.getMidiMappingForTarget(targetId));
        box.append(mappedNow);

        function addItem(text: string, action: () => void) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "midi-ctx-item";
            b.textContent = text;
            b.addEventListener("click", () => {
                action();
                closeMenu();
            });
            box.append(b);
        }

        addItem("MIDI learn this control", () =>
            cb.startMidiLearnForTarget(targetId)
        );
        addItem("MIDI forget this control", () =>
            cb.forgetMidiMapping(targetId)
        );

        document.body.append(box);
        menu = box;

        const pad = 6;
        const rect = box.getBoundingClientRect();
        let x = clientX;
        let y = clientY;
        if (x + rect.width + pad > window.innerWidth) {
            x = Math.max(pad, window.innerWidth - rect.width - pad);
        }
        if (y + rect.height + pad > window.innerHeight) {
            y = Math.max(pad, window.innerHeight - rect.height - pad);
        }
        if (x < pad) x = pad;
        if (y < pad) y = pad;
        box.style.left = x + "px";
        box.style.top = y + "px";
    }

    return {
        attach(el: HTMLElement, targetId: string) {
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                openMenu(e.clientX, e.clientY, targetId);
            });
            el.dataset.midiTarget = targetId;
        },
    };
}

const defaultColors = {
    bg: "#222266",
    note: "#88aacc",
    accent: "#AA88CC",
    glide: "#CCAA88",
    text: "#CCCCFF",
    highlight: "rgba(255,255,255,0.2)",
    grid: "rgba(255,255,255,0.2)",
    dial: "#AA88CC",
};
type ColorScheme = { [color in keyof typeof defaultColors]: string };

function readUiColorVars(_host: HTMLElement): ColorScheme {
    const s = getComputedStyle(document.documentElement);
    const pick = (name: keyof ColorScheme, cssVar: string) => {
        const v = s.getPropertyValue(cssVar).trim();
        return v || defaultColors[name];
    };
    return {
        bg: pick("bg", "--acid-pattern-bg"),
        note: pick("note", "--acid-note"),
        accent: pick("accent", "--acid-accent"),
        glide: pick("glide", "--acid-glide"),
        text: pick("text", "--acid-text"),
        highlight: pick("highlight", "--acid-highlight"),
        grid: pick("grid", "--acid-grid"),
        dial: pick("dial", "--acid-dial"),
    };
}

type DialSetOpts = {
    classes?: string[];
    midiIds?: string[];
    midiByKey?: Record<string, string>;
    midiMenu?: MidiTargetMenu;
    /** Short label drawn on the dial canvas (defaults to param.name). */
    dialShortLabels?: string[];
};

function DialSet(
    parameters: { [key: string]: NumericParameter } | NumericParameter[],
    colorHost: HTMLElement,
    opts?: DialSetOpts
) {
    const keys = Array.isArray(parameters) ? null : Object.keys(parameters);
    const params = Array.isArray(parameters)
        ? parameters
        : keys!.map((k) => parameters[k]);

    const container = document.createElement("div");
    container.classList.add("params", ...(opts?.classes ?? []));

    const applyDialColors = () => {
        const c = readUiColorVars(colorHost);
        return { dial: c.dial, text: c.text };
    };

    params.forEach((param, i) => {
        const cols = applyDialColors();
        const dialLabel =
            opts?.dialShortLabels?.[i] !== undefined
                ? opts.dialShortLabels[i]
                : param.name;
        const dial = Dial(param.bounds, dialLabel, cols.dial, cols.text);
        dial.bind((v) => {
            param.value = v;
        });
        param.subscribe((v) => (dial.value = v));
        let midiId: string | undefined;
        if (opts?.midiIds) {
            midiId = opts.midiIds[i];
        } else if (opts?.midiByKey && keys) {
            midiId = opts.midiByKey[keys[i]];
        }
        if (midiId && opts?.midiMenu) {
            opts.midiMenu.attach(dial.element, midiId);
            dial.element.title =
                "Drag to set level. Right-click: MIDI learn or forget mapping.";
        }
        container.append(dial.element);
    });

    return container;
}

function triggerButton(
    target: Trigger,
    opts?: { midiTargetId?: string; midiMenu?: MidiTargetMenu }
) {
    const but = document.createElement("button");
    but.classList.add("trigger-button");
    but.innerText = "\u21BB";

    target.subscribe((v) => {
        if (v) but.classList.add("waiting");
        else but.classList.remove("waiting");
    });

    const mid = opts?.midiTargetId;
    if (mid && opts?.midiMenu) {
        opts.midiMenu.attach(but, mid);
    }

    but.addEventListener("click", function () {
        target.value = true;
    });

    return but;
}

function toggleButton(
    param: GeneralisedParameter<boolean>,
    opts?: {
        classes?: string[];
        midiTargetId?: string;
        midiMenu?: MidiTargetMenu;
        /** Button caption (defaults to param.name). */
        labelOverride?: string;
        title?: string;
        ariaLabel?: string;
    }
) {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add(...(opts?.classes ?? []));
    button.innerText = opts?.labelOverride ?? param.name;
    if (opts?.title) {
        button.title = opts.title;
    }
    if (opts?.ariaLabel) {
        button.setAttribute("aria-label", opts.ariaLabel);
    }
    const mid = opts?.midiTargetId;
    if (mid && opts?.midiMenu) {
        opts.midiMenu.attach(button, mid);
    }
    button.addEventListener("click", () => {
        param.value = !param.value;
    });
    param.subscribe((v) => {
        if (v) {
            button.classList.add("on");
            button.classList.remove("off");
        } else {
            button.classList.add("off");
            button.classList.remove("on");
        }
    });
    return button;
}

function label(text: string) {
    const element = document.createElement("div");
    element.classList.add("label");
    element.innerText = text;
    return element;
}

function machine(...contents: HTMLElement[]) {
    const element = document.createElement("div");
    element.classList.add("machine");
    element.append(...contents);
    return element;
}

function controlGroup(
    labelEl: HTMLElement,
    content: HTMLElement,
    ...classes: string[]
) {
    const element = document.createElement("div");
    element.classList.add("control-group", ...classes);
    element.append(labelEl, content);
    return element;
}

function controls(...contents: HTMLElement[]) {
    const element = document.createElement("div");
    element.classList.add("controls");
    element.append(...contents);
    return element;
}

function group(...contents: HTMLElement[]) {
    const element = document.createElement("div");
    element.classList.add("group");
    element.append(...contents);
    return element;
}

function PatternDisplay(
    patternParam: PatternParameter,
    stepParam: NumericParameter,
    colorHost: HTMLElement
) {
    const canvas = document.createElement("canvas");
    canvas.classList.add("pattern");
    function repaint() {
        const colors = readUiColorVars(colorHost);
        const pattern = patternParam.value;
        const w = (canvas.width = canvas.clientWidth);
        const h = (canvas.height = 200);
        const vScale = h / 50;
        const g = canvas.getContext("2d") as CanvasRenderingContext2D;

        g.font = "10px Orbitron";

        g.fillStyle = colors.bg;
        g.fillRect(0, 0, w, h);

        g.strokeStyle = colors.grid;
        for (let i = 0; i < pattern.length; i++) {
            const x = (w * i) / pattern.length;
            g.beginPath();
            g.moveTo(x, 0);
            g.lineTo(x, h);
            g.stroke();
        }
        for (let i = 0; i < 80; i++) {
            const y = h - i * vScale;
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(w, y);
            g.stroke();
        }

        for (let i = 0; i < pattern.length; i++) {
            const s = pattern[i];
            if (s.note === "-") {
            } else {
                const n = textNoteToNumber(s.note) - 24;
                const x = (w * i) / pattern.length;
                const y = h - n * vScale;
                const bw = w / pattern.length;
                const bh = 5;

                g.fillStyle = s.glide
                    ? colors.glide
                    : s.accent
                      ? colors.accent
                      : colors.note;
                g.fillRect(x, y, bw, bh);

                g.fillStyle = colors.text;
                const xt = x + bw / 2 - g.measureText(s.note).width / 2;
                g.fillText(s.note, xt, y);
            }
        }

        g.fillStyle = colors.highlight;
        g.fillRect(
            (w * stepParam.value) / pattern.length,
            0,
            w / pattern.length,
            h
        );
    }

    patternParam.subscribe(repaint);
    stepParam.subscribe(repaint);

    return canvas;
}

function DrumDisplay(
    pattern: GeneralisedParameter<DrumPattern>,
    mutes: GeneralisedParameter<boolean>[],
    stepParam: NumericParameter,
    colorHost: HTMLElement
) {
    const canvas = document.createElement("canvas");
    canvas.classList.add("pattern");

    function repaint() {
        const colors = readUiColorVars(colorHost);
        const w = (canvas.width = canvas.clientWidth);
        const h = (canvas.height = 100);
        const g = canvas.getContext("2d") as CanvasRenderingContext2D;
        g.fillStyle = colors.bg;
        g.fillRect(0, 0, w, h);

        for (let i = 0; i < 16; i++) {
            const x = (w * i) / 16;
            for (let p = 0; p < pattern.value.length; p++) {
                const y = (p / pattern.value.length) * h;
                if (pattern.value[p][i]) {
                    if (mutes[p].value) {
                        g.fillStyle = "rgba(128,0,0,0.4)";
                    } else {
                        g.fillStyle =
                            "rgba(136,170,204," + pattern.value[p][i] + ")";
                    }
                    g.fillRect(x, y, w / 16, h / pattern.value.length);
                }
            }
        }

        g.fillStyle = colors.highlight;
        g.fillRect((w * stepParam.value) / 16, 0, w / 16, h);
    }

    pattern.subscribe(repaint);
    stepParam.subscribe(repaint);

    return canvas;
}

function NoteGen(noteGenerator: NoteGenerator, midiMenu: MidiTargetMenu) {
    const currentNotes = document.createElement("div");
    currentNotes.classList.add("parameter-controlled", "notegen-note-display");
    noteGenerator.noteSet.subscribe((notes) => {
        currentNotes.innerText = notes.join(", ");
    });

    return controlGroup(
        label("Notegen"),
        group(
            triggerButton(noteGenerator.newNotes, {
                midiTargetId: "gen.newNotes",
                midiMenu,
            }),
            currentNotes
        ),
        "notegen-box"
    );
}

function Mutes(
    params: GeneralisedParameter<boolean>[],
    midiIds: string[],
    midiMenu: MidiTargetMenu
) {
    const container = document.createElement("div");
    container.classList.add("mutes");

    container.append(
        ...params.map((p, i) =>
            toggleButton(p, {
                midiTargetId: midiIds[i],
                midiMenu,
            })
        )
    );
    return container;
}

function DelayControls(
    delayUnit: DelayUnit,
    colorHost: HTMLElement,
    midiMenu: MidiTargetMenu
) {
    const dialRow = DialSet([delayUnit.dryWet, delayUnit.feedback], colorHost, {
        classes: ["horizontal"],
        midiIds: ["delay.dryWet", "delay.feedback"],
        midiMenu,
    });

    return controlGroup(label("Delay"), dialRow);
}

function mixerStripLevelFader(
    level: NumericParameter,
    colorHost: HTMLElement,
    midiId: string,
    midiMenu: MidiTargetMenu,
    busName: string
): HTMLElement {
    const c = readUiColorVars(colorHost);
    const f = VerticalFader(level.bounds, {
        accent: c.dial,
        label: "Lv",
        ariaLabel: `${busName} bus level`,
    });
    f.bind((v) => {
        level.value = v;
    });
    level.subscribe((v) => {
        f.value = v;
    });
    midiMenu.attach(f.element, midiId);
    f.element.title =
        "Drag vertically for level (up = louder). Right-click: MIDI learn or forget mapping.";
    return f.element;
}

function MixerPanel(
    state: ProgramState,
    colorHost: HTMLElement,
    midiMenu: MidiTargetMenu
) {
    const stripNames = ["303-01", "303-02", "909"];
    const desk = document.createElement("div");
    desk.classList.add("mixer-desk");

    const header = document.createElement("div");
    header.classList.add("mixer-grid-header");
    const hBus = document.createElement("span");
    hBus.innerText = "Bus";
    const hLvl = document.createElement("span");
    hLvl.innerText = "Level";
    hLvl.title =
        "Per-bus gain into delay (303) or master (909). MIDI: right-click fader.";
    const hM = document.createElement("span");
    hM.classList.add("mixer-col-m");
    hM.innerText = "M";
    hM.title = "Mute";
    const hS = document.createElement("span");
    hS.classList.add("mixer-col-s");
    hS.innerText = "S";
    hS.title = "Solo";
    header.append(hBus, hLvl, hM, hS);
    desk.append(header);

    state.mixer.strips.forEach((strip, i) => {
        const name = stripNames[i] ?? `ch${i}`;
        const row = document.createElement("div");
        row.classList.add("mixer-strip-row");
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", `Mixer ${name}`);

        const nm = document.createElement("div");
        nm.classList.add("mixer-strip-name");
        nm.innerText = name;
        nm.title = `${name} bus`;

        const faderCell = document.createElement("div");
        faderCell.classList.add("mixer-fader-cell");
        faderCell.append(
            mixerStripLevelFader(
                strip.level,
                colorHost,
                `mixer.strip${i}.level`,
                midiMenu,
                name
            )
        );

        const muteBtn = toggleButton(strip.mute, {
            classes: ["mixer-mute-btn"],
            midiTargetId: `mixer.strip${i}.mute`,
            midiMenu,
            labelOverride: "M",
            title: `${name} mute. Click toggles. Right-click: MIDI learn / forget.`,
            ariaLabel: `${name} mute`,
        });

        const soloBtn = toggleButton(strip.solo, {
            classes: ["mixer-solo-btn"],
            midiTargetId: `mixer.strip${i}.solo`,
            midiMenu,
            labelOverride: "S",
            title: `${name} solo. Click toggles. Right-click: MIDI learn / forget.`,
            ariaLabel: `${name} solo`,
        });

        row.append(nm, faderCell, muteBtn, soloBtn);
        desk.append(row);
    });

    const hint = document.createElement("div");
    hint.classList.add("sync-hint", "mixer-hint");
    hint.innerText =
        "Level is per bus before master volume. Mute silences a bus. Solo: when any solo is on, only soloed buses are heard (mute still wins on that bus). Both 303s feed the delay; 909 is post-delay.";

    const midiBlock = document.createElement("div");
    midiBlock.classList.add("mixer-midi-block");
    const midiTitle = document.createElement("div");
    midiTitle.classList.add("mixer-midi-title");
    midiTitle.innerText = "MIDI control";
    const midiP = document.createElement("div");
    midiP.classList.add("sync-hint", "mixer-midi-intro");
    midiP.innerText =
        "Right-click a level fader or M / S buttons, choose MIDI learn this control, then move a hardware fader or pad. CC maps level (0–127) or mute/solo (>=64 on). Notes toggle mute/solo. Use the MIDI devices panel to see mappings or forget.";

    const midiDetails = document.createElement("details");
    midiDetails.classList.add("mixer-midi-details");
    const midiSum = document.createElement("summary");
    midiSum.innerText = "Target IDs (for reference)";
    const midiPre = document.createElement("pre");
    midiPre.classList.add("mixer-midi-ids");
    midiPre.textContent = stripNames
        .map((n, i) => {
            const b = `mixer.strip${i}`;
            return `${n}:\n  ${b}.level\n  ${b}.mute\n  ${b}.solo`;
        })
        .join("\n\n");
    midiDetails.append(midiSum, midiPre);

    midiBlock.append(midiTitle, midiP, midiDetails);

    return controlGroup(
        label("Mixer"),
        group(desk, hint, midiBlock),
        "mixer-panel"
    );
}

const autopilotMidiIds = [
    "ap.alterPatterns",
    "ap.twiddleKnobs",
    "ap.muteDrums",
] as const;

function AutopilotControls(
    autoPilot: AutoPilotUnit,
    midiMenu: MidiTargetMenu
) {
    return controlGroup(
        label("Autopilot"),
        group(
            ...autoPilot.switches.map((p, i) =>
                toggleButton(p, {
                    classes: ["autopilot-button"],
                    midiTargetId: autopilotMidiIds[i],
                    midiMenu,
                })
            )
        )
    );
}

function AudioMeter(analyser: AnalyserNode) {
    const liteMode = shouldUseLiteVisualMode();
    const wrap = document.createElement("div");
    wrap.classList.add("acid-meter-wrap");
    const controls = document.createElement("div");
    controls.classList.add("acid-meter-controls");
    const mainWrap = document.createElement("div");
    mainWrap.classList.add("acid-meter-main-wrap");
    const barsCanvas = document.createElement("canvas");
    barsCanvas.style.width = "100%";
    barsCanvas.classList.add("acid-meter-main-canvas");
    const waveCanvas = document.createElement("canvas");
    waveCanvas.style.width = "100%";
    waveCanvas.classList.add("acid-meter-main-canvas");
    const peaksCanvas = document.createElement("canvas");
    peaksCanvas.style.width = "100%";
    peaksCanvas.classList.add("acid-meter-main-canvas");
    mainWrap.append(barsCanvas, waveCanvas, peaksCanvas);
    let wBars = (barsCanvas.width = 340);
    let wWave = (waveCanvas.width = 340);
    let wPeaks = (peaksCanvas.width = 340);
    const hMain = 84;
    barsCanvas.height = hMain;
    waveCanvas.height = hMain;
    peaksCanvas.height = hMain;
    const gBars = barsCanvas.getContext("2d") as CanvasRenderingContext2D;
    const gWave = waveCanvas.getContext("2d") as CanvasRenderingContext2D;
    const gPeaks = peaksCanvas.getContext("2d") as CanvasRenderingContext2D;
    const splitWrap = document.createElement("div");
    splitWrap.classList.add("acid-meter-split-wrap");
    const bandCanvases = {
        low: document.createElement("canvas"),
        mid: document.createElement("canvas"),
        high: document.createElement("canvas"),
    };
    let bw = 340;
    const bh = 84;
    for (const c of [bandCanvases.low, bandCanvases.mid, bandCanvases.high]) {
        c.style.width = "100%";
        c.classList.add("acid-meter-layer-canvas");
        c.width = bw;
        c.height = bh;
        splitWrap.append(c);
    }
    const bg = {
        low: bandCanvases.low.getContext("2d") as CanvasRenderingContext2D,
        mid: bandCanvases.mid.getContext("2d") as CanvasRenderingContext2D,
        high: bandCanvases.high.getContext("2d") as CanvasRenderingContext2D,
    };

    const waveform = new Uint8Array(analyser.fftSize);
    const fft = new Uint8Array(analyser.frequencyBinCount);
    const splitFft = new Uint8Array(analyser.frequencyBinCount);
    const bars = 64;
    const barLevels = new Array<number>(bars).fill(0);
    const peakHold = new Array<number>(bars).fill(0);
    const grain = new Array<number>(24).fill(0).map((_, i) => Math.sin(i * 17.123));
    let showBars = true;
    let showWave = !liteMode;
    let showPeaks = !liteMode;
    let showGrid = true;
    let showScan = !liteMode;
    let showSplitBands = !liteMode;
    let showLowLayer = !liteMode;
    let showMidLayer = !liteMode;
    let showHighLayer = !liteMode;
    let meterTick = 0;
    let meterAlign: "left" | "center" | "right" = "center";

    function setMeterAlign() {
        const all = [mainWrap, splitWrap];
        if (meterAlign === "left") {
            for (const el of all) {
                el.style.marginLeft = "0";
                el.style.marginRight = "auto";
                el.style.maxWidth = "92%";
            }
        } else if (meterAlign === "right") {
            for (const el of all) {
                el.style.marginLeft = "auto";
                el.style.marginRight = "0";
                el.style.maxWidth = "92%";
            }
        } else {
            for (const el of all) {
                el.style.marginLeft = "auto";
                el.style.marginRight = "auto";
                el.style.maxWidth = "100%";
            }
        }
    }
    setMeterAlign();

    function meterToggle(labelText: string, onByDefault: boolean, onChange: (on: boolean) => void) {
        const label = document.createElement("label");
        label.classList.add("acid-meter-toggle");
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = onByDefault;
        chk.addEventListener("change", () => onChange(chk.checked));
        const span = document.createElement("span");
        span.textContent = labelText;
        label.append(chk, span);
        return label;
    }

    const alignSelect = document.createElement("select");
    alignSelect.classList.add("acid-meter-align");
    for (const [v, t] of [
        ["left", "Align left"],
        ["center", "Align center"],
        ["right", "Align right"],
    ] as const) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = t;
        alignSelect.append(opt);
    }
    alignSelect.value = meterAlign;
    alignSelect.addEventListener("change", () => {
        meterAlign = alignSelect.value as "left" | "center" | "right";
        setMeterAlign();
    });

    controls.append(
        meterToggle("Bars", true, (on) => {
            showBars = on;
            barsCanvas.style.display = on ? "block" : "none";
        }),
        meterToggle("Wave", true, (on) => {
            showWave = on;
            waveCanvas.style.display = on ? "block" : "none";
        }),
        meterToggle("Peaks", true, (on) => {
            showPeaks = on;
            peaksCanvas.style.display = on ? "block" : "none";
        }),
        meterToggle("Grid", true, (on) => (showGrid = on)),
        meterToggle("Scan", true, (on) => (showScan = on)),
        meterToggle("Split bands", true, (on) => {
            showSplitBands = on;
            splitWrap.style.display = on ? "grid" : "none";
        }),
        meterToggle("LOW layer", true, (on) => {
            showLowLayer = on;
            bandCanvases.low.style.display = on ? "block" : "none";
        }),
        meterToggle("MID layer", true, (on) => {
            showMidLayer = on;
            bandCanvases.mid.style.display = on ? "block" : "none";
        }),
        meterToggle("HIGH layer", true, (on) => {
            showHighLayer = on;
            bandCanvases.high.style.display = on ? "block" : "none";
        }),
        alignSelect
    );
    if (liteMode) {
        waveCanvas.style.display = "none";
        peaksCanvas.style.display = "none";
        splitWrap.style.display = "none";
    }
    wrap.append(controls, mainWrap, splitWrap);

    function draw() {
        meterTick++;
        if (liteMode && meterTick % 3 !== 0) {
            window.requestAnimationFrame(draw);
            return;
        }
        analyser.getByteTimeDomainData(waveform);
        analyser.getByteFrequencyData(fft);
        const drawSplitThisFrame = !liteMode && meterTick % 2 === 0;
        if (drawSplitThisFrame) analyser.getByteFrequencyData(splitFft);

        if (barsCanvas.clientWidth > 0 && barsCanvas.clientWidth !== wBars) {
            wBars = barsCanvas.width = Math.max(180, Math.floor(barsCanvas.clientWidth));
        }
        if (waveCanvas.clientWidth > 0 && waveCanvas.clientWidth !== wWave) {
            wWave = waveCanvas.width = Math.max(180, Math.floor(waveCanvas.clientWidth));
        }
        if (peaksCanvas.clientWidth > 0 && peaksCanvas.clientWidth !== wPeaks) {
            wPeaks = peaksCanvas.width = Math.max(180, Math.floor(peaksCanvas.clientWidth));
        }
        if (splitWrap.clientWidth > 0 && splitWrap.clientWidth !== bw) {
            bw = Math.max(180, Math.floor(splitWrap.clientWidth));
            bandCanvases.low.width = bw;
            bandCanvases.mid.width = bw;
            bandCanvases.high.width = bw;
        }

        const t = performance.now() * 0.001;
        function drawBackdrop(gg: CanvasRenderingContext2D, ww: number, hh: number) {
            const bgGrad = gg.createLinearGradient(0, 0, 0, hh);
            bgGrad.addColorStop(0, "#1a120f");
            bgGrad.addColorStop(0.45, "#0b0c12");
            bgGrad.addColorStop(1, "#08090d");
            gg.fillStyle = bgGrad;
            gg.fillRect(0, 0, ww, hh);
            if (showScan) {
                for (let y = 0; y < hh; y += 2) {
                    const noise = (Math.sin(y * 3.11 + t * 6.0) * 0.5 + 0.5) * 0.08;
                    gg.fillStyle = `rgba(255,140,90,${0.03 + noise})`;
                    gg.fillRect(0, y, ww, 1);
                }
            }
            if (showGrid) {
                gg.strokeStyle = "rgba(140,150,200,0.14)";
                for (let x = 0; x <= ww; x += 24) {
                    gg.beginPath();
                    gg.moveTo(x + 0.5, 0);
                    gg.lineTo(x + 0.5, hh);
                    gg.stroke();
                }
                for (let y = 0; y <= hh; y += 16) {
                    gg.beginPath();
                    gg.moveTo(0, y + 0.5);
                    gg.lineTo(ww, y + 0.5);
                    gg.stroke();
                }
            }
        }
        if (showBars || showPeaks) {
            for (let i = 0; i < bars; i++) {
                const from = Math.floor((i / bars) * fft.length);
                const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * fft.length));
                let sum = 0;
                for (let k = from; k < to; k++) sum += fft[k];
                const avg = sum / (to - from);
                const value = Math.min(1, Math.max(0, avg / 255));
                const boosted = Math.pow(value, 0.72);
                barLevels[i] = boosted;
                peakHold[i] = Math.max(boosted, peakHold[i] * 0.94);
            }
        }

        if (showBars) {
            drawBackdrop(gBars, wBars, hMain);
            gBars.globalCompositeOperation = "lighter";
            const barW = wBars / bars;
            for (let i = 0; i < bars; i++) {
                const boosted = barLevels[i];
                const x = i * barW;
                const barH = boosted * (hMain * 0.82);
                const hue = 20 + i * 1.4;
                gBars.fillStyle = `hsla(${hue},85%,${28 + boosted * 36}%,0.85)`;
                gBars.fillRect(x + 0.8, hMain - barH, Math.max(1, barW - 1.6), barH);
            }
            gBars.globalCompositeOperation = "source-over";
            gBars.strokeStyle = "rgba(255,180,120,0.25)";
            gBars.beginPath();
            gBars.moveTo(0, hMain * 0.66);
            gBars.lineTo(wBars, hMain * 0.66);
            gBars.stroke();
        }

        if (showPeaks) {
            drawBackdrop(gPeaks, wPeaks, hMain);
            gPeaks.globalCompositeOperation = "lighter";
            const barW = wPeaks / bars;
            for (let i = 0; i < bars; i++) {
                const x = i * barW;
                const peakY = hMain - peakHold[i] * (hMain * 0.82);
                const hue = 20 + i * 1.4;
                gPeaks.fillStyle = `hsla(${hue + 30},95%,70%,0.92)`;
                gPeaks.fillRect(x + 0.6, peakY - 1, Math.max(1, barW - 1.2), 2);
            }
            gPeaks.globalCompositeOperation = "source-over";
            gPeaks.strokeStyle = "rgba(255,200,130,0.28)";
            gPeaks.beginPath();
            gPeaks.moveTo(0, hMain * 0.66);
            gPeaks.lineTo(wPeaks, hMain * 0.66);
            gPeaks.stroke();
        }

        if (showWave) {
            drawBackdrop(gWave, wWave, hMain);
            gWave.strokeStyle = "rgba(185,225,255,0.95)";
            gWave.shadowColor = "rgba(110,200,255,0.55)";
            gWave.shadowBlur = 8;
            gWave.beginPath();
            gWave.moveTo(0, hMain / 2);
            for (let i = 0; i < waveform.length; i++) {
                const v = waveform[i] / 128 - 1;
                const grit = grain[i % grain.length] * 0.01;
                gWave.lineTo((wWave * i) / waveform.length, hMain / 2 + 1.35 * (v + grit) * (hMain / 2));
            }
            gWave.stroke();
            gWave.shadowBlur = 0;
            gWave.strokeStyle = "rgba(140,220,255,0.26)";
            gWave.beginPath();
            gWave.moveTo(0, hMain * 0.5);
            gWave.lineTo(wWave, hMain * 0.5);
            gWave.stroke();
        }

        if (showSplitBands && drawSplitThisFrame) {
            const bands = [
                {
                    name: "LOW",
                    from: 0.0,
                    to: 0.12,
                    col: "rgba(255,120,78,0.92)",
                    ctx: bg.low,
                    visible: showLowLayer,
                },
                {
                    name: "MID",
                    from: 0.12,
                    to: 0.42,
                    col: "rgba(125,214,255,0.9)",
                    ctx: bg.mid,
                    visible: showMidLayer,
                },
                {
                    name: "HIGH",
                    from: 0.42,
                    to: 1.0,
                    col: "rgba(193,126,255,0.92)",
                    ctx: bg.high,
                    visible: showHighLayer,
                },
            ] as const;
            for (const row of bands) {
                const gg = row.ctx;
                if (!row.visible) continue;
                gg.fillStyle = "#07080d";
                gg.fillRect(0, 0, bw, bh);
                const yMid = bh * 0.5;
                const from = Math.floor(row.from * splitFft.length);
                const to = Math.max(from + 1, Math.floor(row.to * splitFft.length));
                const points = Math.min(120, to - from);
                gg.strokeStyle = row.col;
                gg.shadowColor = row.col.replace("0.9", "0.45").replace("0.92", "0.45");
                gg.shadowBlur = 7;
                gg.beginPath();
                gg.moveTo(0, yMid);
                for (let i = 0; i < points; i++) {
                    const idx = from + Math.floor((i / Math.max(1, points - 1)) * (to - from - 1));
                    const v = splitFft[idx] / 255;
                    const amp = (bh * 0.45) * Math.pow(v, 0.7);
                    const px = (i / Math.max(1, points - 1)) * bw;
                    const py = yMid - amp + Math.sin((i * 0.2) + t * 2.4) * (bh * 0.035);
                    gg.lineTo(px, py);
                }
                gg.stroke();
                gg.shadowBlur = 0;
                gg.fillStyle = "rgba(214,224,240,0.68)";
                gg.font = "11px monospace";
                gg.fillText(row.name, 10, 14);
                gg.strokeStyle = "rgba(255,255,255,0.08)";
                gg.beginPath();
                gg.moveTo(0, yMid + 0.5);
                gg.lineTo(bw, yMid + 0.5);
                gg.stroke();
            }
        }

        window.requestAnimationFrame(draw);
    }
    window.requestAnimationFrame(draw);

    return wrap;
}

function modeRadio(
    name: string,
    value: SyncMode,
    current: GeneralisedParameter<SyncMode>,
    labelText: string
) {
    const id = `${name}-${value}`;
    const wrap = document.createElement("label");
    wrap.classList.add("sync-mode-option");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    input.id = id;
    current.subscribe((m) => {
        input.checked = m === value;
    });
    input.addEventListener("change", () => {
        if (input.checked) current.value = value;
    });
    const span = document.createElement("span");
    span.innerText = labelText;
    wrap.append(input, span);
    return wrap;
}

function populateMidiSelect(
    select: HTMLSelectElement,
    midiAccess: MIDIAccess | null,
    kind: "inputs" | "outputs",
    currentId: GeneralisedParameter<string>
) {
    function refill() {
        const keep = select.value;
        select.innerHTML = "";
        const def = document.createElement("option");
        def.value = "";
        def.innerText = kind === "inputs" ? "(first input)" : "(first output)";
        select.append(def);
        if (!midiAccess) return;
        const list =
            kind === "inputs" ? midiAccess.inputs : midiAccess.outputs;
        list.forEach((port) => {
            const opt = document.createElement("option");
            opt.value = port.id;
            opt.innerText = port.name || port.id;
            select.append(opt);
        });
        if (currentId.value && midiPortMapHasId(list, currentId.value)) {
            select.value = currentId.value;
        } else if (keep && midiPortMapHasId(list, keep)) {
            select.value = keep;
        }
    }
    refill();
    return refill;
}

function formatMidiBinding(b: MidiBinding): string {
    const ch = b.channel + 1;
    if (b.kind === "cc") {
        return "Ch " + ch + " CC " + b.number;
    }
    return "Ch " + ch + " Note " + b.number;
}

function chunk<T>(items: T[], size: number): T[][] {
    if (size <= 0) return [items];
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

function triggerValuesForKind(kind: "numeric" | "bool" | "trigger") {
    if (kind === "trigger") {
        return { on: 127, off: 0 };
    }
    if (kind === "bool") {
        return { on: 127, off: 0 };
    }
    return { on: 127, off: 0 };
}

function buildTouchOscBlueprint(state: ProgramState, midiCallbacks: MidiUiCallbacks) {
    const ns = "/mmc";
    const ccAddr = `${ns}/midi/cc`;
    const noteAddr = `${ns}/midi/note`;
    const udpListen = parseInt(state.osc.bridgeUdpListenPort.value.trim(), 10);
    const udpPort = Number.isFinite(udpListen) ? udpListen : 57121;
    const host =
        state.osc.wsHost.value.trim() && !state.osc.wsHost.value.includes("://")
            ? state.osc.wsHost.value.trim()
            : "127.0.0.1";

    const controls = midiCallbacks.getMidiTargets().map((target) => {
        const binding = midiCallbacks.getMidiMappingForTarget(target.id);
        const base = {
            id: target.id,
            label: target.label,
            targetKind: target.kind,
            mapped: binding
                ? `${binding.kind.toUpperCase()} ch${binding.channel + 1} #${binding.number}`
                : "none",
        };
        if (!binding) {
            return {
                ...base,
                mode: "unmapped",
                osc: null,
            };
        }

        if (binding.kind === "cc") {
            const trig = triggerValuesForKind(target.kind);
            return {
                ...base,
                mode: target.kind === "numeric" ? "fader" : "button",
                osc:
                    target.kind === "numeric"
                        ? {
                              change: {
                                  address: ccAddr,
                                  args: [binding.channel + 1, binding.number, "$value_0_127"],
                              },
                          }
                        : {
                              press: {
                                  address: ccAddr,
                                  args: [binding.channel + 1, binding.number, trig.on],
                              },
                              release: {
                                  address: ccAddr,
                                  args: [binding.channel + 1, binding.number, trig.off],
                              },
                          },
            };
        }

        const trig = triggerValuesForKind(target.kind);
        return {
            ...base,
            mode: target.kind === "numeric" ? "fader-note" : "pad",
            osc:
                target.kind === "numeric"
                    ? {
                          change: {
                              address: noteAddr,
                              args: [binding.channel + 1, "$value_0_127", trig.on],
                          },
                      }
                    : {
                          press: {
                              address: noteAddr,
                              args: [binding.channel + 1, binding.number, trig.on],
                          },
                          release: {
                              address: noteAddr,
                              args: [binding.channel + 1, binding.number, trig.off],
                          },
                      },
        };
    });

    const pages = chunk(controls, 12).map((rows, i) => ({
        name: `Acid Banger ${i + 1}`,
        controls: rows,
    }));

    return {
        schema: "acid-banger.touchosc.blueprint.v1",
        exportedAt: new Date().toISOString(),
        touchosc: {
            target: {
                host,
                port: udpPort,
                namespace: ns,
                addresses: {
                    cc: ccAddr,
                    note: noteAddr,
                },
            },
            notes: [
                "Build sheet for TouchOSC layout creation.",
                "Mapped controls include concrete channel and CC/Note values.",
                "Unmapped controls are listed so you can assign your own controls later.",
            ],
            pages,
        },
    };
}

function downloadJsonFile(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function MidiDevicesPanel(
    clock: ClockUnit,
    midiAccess: MIDIAccess | null,
    state: ProgramState,
    midiCallbacks: MidiUiCallbacks
) {
    const box = document.createElement("div");
    box.classList.add("midi-io-panel", "sync-panel-wide");

    const title = document.createElement("div");
    title.classList.add("sync-panel-title");
    title.innerText = "MIDI devices";

    const body = document.createElement("div");
    body.classList.add("midi-io-grid");

    const outCol = document.createElement("div");
    outCol.classList.add("midi-io-col");
    const outHeading = document.createElement("div");
    outHeading.classList.add("midi-io-heading");
    outHeading.innerText = "MIDI output";
    const outSub = document.createElement("div");
    outSub.classList.add("midi-io-sub");
    outSub.innerText = "Clock + acid mirror (ch 1–2) send here";
    const outSel = document.createElement("select");
    outSel.classList.add("sync-select", "midi-io-select");
    outSel.setAttribute("aria-label", "MIDI output device");
    const refillOut = populateMidiSelect(
        outSel,
        midiAccess,
        "outputs",
        clock.midiOutputId
    );
    outSel.addEventListener("change", () => {
        clock.midiOutputId.value = outSel.value;
    });
    clock.midiOutputId.subscribe((id) => {
        if (outSel.value !== id) outSel.value = id;
    });
    outCol.append(outHeading, outSub, outSel);

    const inCol = document.createElement("div");
    inCol.classList.add("midi-io-col");
    const inHeading = document.createElement("div");
    inHeading.classList.add("midi-io-heading");
    inHeading.innerText = "MIDI input";
    const inSub = document.createElement("div");
    inSub.classList.add("midi-io-sub");
    inSub.innerText =
        "External clock (slave), MIDI learn, and CC/note control use this input";
    const inSel = document.createElement("select");
    inSel.classList.add("sync-select", "midi-io-select");
    inSel.setAttribute("aria-label", "MIDI input device");
    const refillIn = populateMidiSelect(
        inSel,
        midiAccess,
        "inputs",
        clock.midiInputId
    );
    inSel.addEventListener("change", () => {
        clock.midiInputId.value = inSel.value;
    });
    clock.midiInputId.subscribe((id) => {
        if (inSel.value !== id) inSel.value = id;
    });
    inCol.append(inHeading, inSub, inSel);

    body.append(outCol, inCol);

    clock.midiDeviceEpoch.subscribe(() => {
        refillIn();
        refillOut();
    });

    const learnBlock = document.createElement("div");
    learnBlock.classList.add("midi-learn-block");

    const learnHead = document.createElement("div");
    learnHead.classList.add("midi-learn-head");
    learnHead.innerText = "MIDI mappings";

    const learnHint = document.createElement("div");
    learnHint.classList.add("sync-hint", "midi-learn-hint");
    learnHint.innerText =
        "Right-click any knob, trigger, or toggle for MIDI learn or forget. Then move a control or pad on the selected input. Same port as MIDI slave. Saved in this browser.";

    const learnStatus = document.createElement("div");
    learnStatus.classList.add("midi-learn-status");
    state.midiLearn.statusLine.subscribe((t) => {
        learnStatus.innerText = t || "";
    });

    const cancelWait = document.createElement("button");
    cancelWait.type = "button";
    cancelWait.classList.add("midi-learn-cancel");
    cancelWait.innerText = "Cancel learn (waiting for MIDI)";
    function syncPendingLearnUi() {
        cancelWait.style.display = midiCallbacks.isMidiLearnPending()
            ? "inline-block"
            : "none";
    }
    state.midiLearn.listEpoch.subscribe(syncPendingLearnUi);
    state.midiLearn.statusLine.subscribe(syncPendingLearnUi);
    cancelWait.addEventListener("click", () => {
        midiCallbacks.cancelPendingMidiLearn();
    });
    syncPendingLearnUi();

    const mapWrap = document.createElement("div");
    mapWrap.classList.add("midi-map-scroll");

    function redrawMappings() {
        mapWrap.innerHTML = "";
        const rows = midiCallbacks.getMidiMappingsList();
        if (rows.length === 0) {
            const empty = document.createElement("div");
            empty.classList.add("sync-hint");
            empty.innerText = "No MIDI mappings yet.";
            mapWrap.append(empty);
            return;
        }
        for (const row of rows) {
            const line = document.createElement("div");
            line.classList.add("midi-map-row");
            const txt = document.createElement("span");
            txt.classList.add("midi-map-label");
            txt.innerText = row.label + " -> " + formatMidiBinding(row.binding);
            const forget = document.createElement("button");
            forget.type = "button";
            forget.classList.add("midi-map-forget");
            forget.innerText = "Forget";
            forget.addEventListener("click", () => {
                midiCallbacks.forgetMidiMapping(row.targetId);
            });
            line.append(txt, forget);
            mapWrap.append(line);
        }
    }
    redrawMappings();
    state.midiLearn.listEpoch.subscribe(() => {
        redrawMappings();
    });

    const clearAll = document.createElement("button");
    clearAll.type = "button";
    clearAll.classList.add("midi-map-clear-all");
    clearAll.innerText = "Clear all MIDI mappings";
    clearAll.addEventListener("click", () => {
        midiCallbacks.clearAllMidiMappings();
    });

    const exportTouchOsc = document.createElement("button");
    exportTouchOsc.type = "button";
    exportTouchOsc.classList.add("midi-map-clear-all");
    exportTouchOsc.innerText = "Export TouchOSC blueprint (JSON)";
    exportTouchOsc.addEventListener("click", () => {
        const payload = buildTouchOscBlueprint(state, midiCallbacks);
        downloadJsonFile("acid_banger_touchosc_blueprint.json", payload);
    });

    learnBlock.append(
        learnHead,
        learnHint,
        learnStatus,
        cancelWait,
        mapWrap,
        clearAll,
        exportTouchOsc
    );

    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.classList.add("sync-refresh");
    refresh.innerText = "Refresh MIDI device list";
    refresh.addEventListener("click", () => {
        refillIn();
        refillOut();
    });

    const foot = document.createElement("div");
    foot.classList.add("sync-hint");
    foot.innerText =
        "Web MIDI needs https or localhost. Choose output for sending notes and clock; choose input when using MIDI slave sync. Incoming CC and notes on the selected input control mapped parameters while the page is open.";

    box.append(title, body, learnBlock, refresh, foot);
    return box;
}

function SyncAndMidiPanel(clock: ClockUnit) {
    const box = document.createElement("div");
    box.classList.add("sync-panel", "sync-panel-wide");

    const title = document.createElement("div");
    title.classList.add("sync-panel-title");
    title.innerText = "Clock sync";

    const body = document.createElement("div");
    body.classList.add("sync-panel-body");

    const modes = document.createElement("div");
    modes.classList.add("sync-modes");
    modes.append(
        modeRadio("sync-mode", "internal", clock.syncMode, "Internal"),
        modeRadio("sync-mode", "midi-master", clock.syncMode, "MIDI master"),
        modeRadio("sync-mode", "midi-slave", clock.syncMode, "MIDI slave"),
        modeRadio(
            "sync-mode",
            "ableton-link",
            clock.syncMode,
            "Ableton Link"
        )
    );

    const linkRow = document.createElement("div");
    linkRow.classList.add("link-ws-fields");

    const linkGuide = document.createElement("div");
    linkGuide.classList.add("link-bridge-guide");

    const linkIntro = document.createElement("div");
    linkIntro.classList.add("sync-hint", "link-bridge-intro");
    linkIntro.innerText =
        "Ableton Link runs in the browser only through a small Node bridge (native abletonlink + WebSocket). Start link-bridge on this PC first, then connect below.";

    const docLink = document.createElement("a");
    docLink.classList.add("link-bridge-doc-link");
    docLink.href = "link-bridge-README.txt";
    docLink.target = "_blank";
    docLink.rel = "noopener noreferrer";
    docLink.innerText =
        "Open link-bridge README (build requirements, LINK_WS_PORT, protocol)";

    const protoHint = document.createElement("div");
    protoHint.classList.add("sync-hint", "link-bridge-protocol-hint");
    protoHint.innerText =
        "The page cannot run Node by itself. On Windows use BridgeLauncherPanel.ps1 or Launch-AcidBanger.ps1 (opens a small window with buttons and F9/F10), or register the URL handler and use the link below.";

    const protoLink = document.createElement("a");
    protoLink.classList.add("link-bridge-doc-link");
    protoLink.href = "acid-banger-linkbridge://start";
    protoLink.innerText =
        "Start link-bridge on this PC (after Register-AcidLinkBridgeProtocol.ps1)";

    const protoTrouble = document.createElement("div");
    protoTrouble.classList.add("sync-hint", "link-bridge-protocol-trouble");
    protoTrouble.innerText =
        "If the link does nothing: allow opening the app when the browser asks; re-run Register-AcidLinkBridgeProtocol.ps1 from this repo after moving the folder; or Win+R and paste acid-banger-linkbridge://start then Enter.";

    const linkDash = document.createElement("a");
    linkDash.classList.add("link-bridge-doc-link");
    linkDash.target = "_blank";
    linkDash.rel = "noopener noreferrer";
    linkDash.innerText =
        "Open bridge status page (live BPM, Link peers, beat/phase, WebSocket client count)";
    function syncLinkDashHref() {
        const h = clock.linkWsHost.value.trim() || "127.0.0.1";
        const p = parseInt(clock.linkWsPort.value.trim(), 10);
        const wsP = Number.isFinite(p) && p > 0 ? p : 9999;
        linkDash.href = `http://${h}:${wsP + 1}/`;
    }
    clock.linkWsHost.subscribe(syncLinkDashHref);
    clock.linkWsPort.subscribe(syncLinkDashHref);
    syncLinkDashHref();

    const linkDashHint = document.createElement("div");
    linkDashHint.classList.add("sync-hint");
    linkDashHint.innerText =
        "While npm start runs in link-bridge: HTTP status uses WS port + 1 by default (set LINK_HTTP_PORT to override).";

    const stepsTitle = document.createElement("div");
    stepsTitle.classList.add("link-bridge-steps-title");
    stepsTitle.innerText = "Quick start";

    const steps = document.createElement("ol");
    steps.classList.add("link-bridge-steps");
    const stepTexts = [
        "Clone or open the acid-banger repo on disk.",
        "In a terminal: cd link-bridge",
        "Run npm install (needs Python + C++ build tools for the native addon; see README if this fails).",
        "Run npm start - leave this terminal open. Default WebSocket port is 9999.",
        "Set Link WS host and port here to match (localhost is 127.0.0.1).",
        "Select Ableton Link above; wait for status to show connected.",
        "Launch Ableton Live or another Link app on the same LAN so tempo and phase align.",
    ];
    for (const t of stepTexts) {
        const li = document.createElement("li");
        li.innerText = t;
        steps.append(li);
    }

    const cmdLabel = document.createElement("div");
    cmdLabel.classList.add("link-bridge-cmd-label");
    cmdLabel.innerText = "Commands (from repo root):";

    const cmdPre = document.createElement("pre");
    cmdPre.classList.add("link-bridge-cmd");
    cmdPre.textContent = "cd link-bridge\nnpm install\nnpm start";

    linkGuide.append(
        linkIntro,
        docLink,
        protoHint,
        protoLink,
        protoTrouble,
        linkDash,
        linkDashHint,
        stepsTitle,
        steps,
        cmdLabel,
        cmdPre
    );

    const linkGrid = document.createElement("div");
    linkGrid.classList.add("osc-host-port-grid");
    const lhCell = document.createElement("div");
    lhCell.classList.add("osc-hp-cell");
    const lhl = document.createElement("span");
    lhl.innerText = "Link WS host";
    const lhi = document.createElement("input");
    lhi.type = "text";
    lhi.classList.add("osc-field-input", "osc-field-input-wide");
    lhi.spellcheck = false;
    clock.linkWsHost.subscribe((v) => {
        if (lhi.value !== v) lhi.value = v;
    });
    lhi.addEventListener("input", () => {
        clock.linkWsHost.value = lhi.value;
    });
    lhCell.append(lhl, lhi);

    const lpCell = document.createElement("div");
    lpCell.classList.add("osc-hp-cell");
    const lpl = document.createElement("span");
    lpl.innerText = "Link WS port";
    const lpi = document.createElement("input");
    lpi.type = "text";
    lpi.classList.add("osc-field-input", "osc-port-input");
    lpi.inputMode = "numeric";
    clock.linkWsPort.subscribe((v) => {
        if (lpi.value !== v) lpi.value = v;
    });
    lpi.addEventListener("input", () => {
        clock.linkWsPort.value = lpi.value;
    });
    lpCell.append(lpl, lpi);
    linkGrid.append(lhCell, lpCell);
    linkRow.append(linkGuide, linkGrid);

    function syncLinkVisibility() {
        const on = clock.syncMode.value === "ableton-link";
        linkRow.style.display = on ? "block" : "none";
    }
    clock.syncMode.subscribe(syncLinkVisibility);
    syncLinkVisibility();

    const status = document.createElement("div");
    status.classList.add("sync-status");
    clock.midiStatusText.subscribe((t) => {
        status.innerText = t;
    });

    const hint = document.createElement("div");
    hint.classList.add("sync-hint");
    hint.innerText =
        "Internal: built-in tempo. MIDI master: clock + acid MIDI out. MIDI slave: MIDI clock in. Ableton Link: start link-bridge (Node) on your machine, then use the fields above - the browser does not load Link by itself.";

    body.append(modes, linkRow, status, hint);

    box.append(title, body);
    return box;
}

function oscBridgeReadmeLink(text: string): HTMLAnchorElement {
    const a = document.createElement("a");
    a.href = "bridge-README.txt";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.classList.add("osc-bridge-readme-link");
    a.innerText = text;
    return a;
}

function oscTextField(labelText: string, param: GeneralisedParameter<string>) {
    const row = document.createElement("div");
    row.classList.add("osc-field-row");
    const lab = document.createElement("span");
    lab.classList.add("osc-field-label-block");
    lab.innerText = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.classList.add("osc-field-input", "osc-field-input-wide");
    input.spellcheck = false;
    param.subscribe((v) => {
        if (input.value !== v) input.value = v;
    });
    input.addEventListener("input", () => {
        param.value = input.value;
    });
    row.append(lab, input);
    return row;
}

function OscPanel(state: ProgramState) {
    const box = document.createElement("div");
    box.classList.add("osc-panel", "sync-panel-wide");

    const title = document.createElement("div");
    title.classList.add("sync-panel-title");
    title.innerText = "OSC (via Node bridge)";

    const refLinkRow = document.createElement("div");
    refLinkRow.classList.add("osc-reference-link-row");
    const refPageLink = document.createElement("a");
    refPageLink.href = "osc-reference.html";
    refPageLink.target = "_blank";
    refPageLink.rel = "noopener noreferrer";
    refPageLink.classList.add("osc-bridge-readme-link");
    refPageLink.innerText =
        "OSC reference page: addresses, ports, incoming and outgoing messages";
    refLinkRow.append(refPageLink);

    const body = document.createElement("div");
    body.classList.add("sync-panel-body");

    const en = document.createElement("div");
    en.classList.add("osc-enable-row");
    en.append(toggleButton(state.osc.enabled, { classes: ["osc-toggle"] }));

    const readmeRow = document.createElement("div");
    readmeRow.classList.add("osc-bridge-readme-row");
    const readmeLink = oscBridgeReadmeLink(
        "Open bridge README (install server.mjs, UDP + WebSocket ports)"
    );
    readmeRow.append(readmeLink);

    const oscProtoHint = document.createElement("div");
    oscProtoHint.classList.add("sync-hint", "osc-bridge-protocol-hint");
    oscProtoHint.innerText =
        "The page cannot start Node by itself. On Windows use BridgeLauncherPanel.ps1 (F10) or Launch-AcidBanger.ps1, or run Register-AcidOscBridgeProtocol.ps1 once, then:";
    const oscProtoLink = document.createElement("a");
    oscProtoLink.classList.add("osc-bridge-readme-link");
    oscProtoLink.href = "acid-banger-oscbridge://start";
    oscProtoLink.innerText =
        "Start OSC bridge on this PC (registered protocol)";
    const oscProtoRow = document.createElement("div");
    oscProtoRow.classList.add("osc-bridge-proto-row");
    oscProtoRow.append(oscProtoHint, oscProtoLink);

    const plainHelp = document.createElement("div");
    plainHelp.classList.add("osc-plain-help");
    const helpTitle = document.createElement("div");
    helpTitle.classList.add("osc-plain-help-title");
    helpTitle.innerText = "What is WebSocket vs UDP? (TouchOSC, etc.)";
    const p1 = document.createElement("div");
    p1.classList.add("sync-hint", "osc-plain-p");
    p1.append(
        document.createTextNode(
            "Browsers cannot speak OSC over UDP. The Node program bridge/server.mjs runs on your computer; see "
        ),
        oscBridgeReadmeLink("bridge README"),
        document.createTextNode(
            " for setup. The status line about connecting to Node at 127.0.0.1 port 8765 is this tab's WebSocket to the bridge. ws:// is not what you type in TouchOSC."
        )
    );
    const p2 = document.createElement("div");
    p2.classList.add("sync-hint", "osc-plain-p");
    p2.innerText =
        "TouchOSC, Lemur, Max, SuperCollider, etc. send OSC as UDP. Point them at the computer running the bridge: use the Bridge OSC UDP listen port (often 57121), not the WS port. On a phone, use your PC's Wi-Fi IP as host and 57121 as port (same firewall rules as any OSC app).";
    const p3 = document.createElement("div");
    p3.classList.add("sync-hint", "osc-plain-p");
    p3.innerText =
        "Quick example: bridge running with defaults, OSC enabled here with host 127.0.0.1 and WS port 8765. TouchOSC on the same PC: Host 127.0.0.1, Port 57121. TouchOSC on a phone: Host = your PC's LAN address (e.g. 192.168.1.x), Port 57121.";
    plainHelp.append(helpTitle, p1, p2, p3);

    const wsHead = document.createElement("div");
    wsHead.classList.add("osc-section-label");
    wsHead.innerText = "Browser to Node (WebSocket)";

    const wsGrid = document.createElement("div");
    wsGrid.classList.add("osc-host-port-grid");
    const wsHostRow = document.createElement("div");
    wsHostRow.classList.add("osc-hp-cell");
    const wl = document.createElement("span");
    wl.innerText = "Bridge machine (host)";
    const wh = document.createElement("input");
    wh.type = "text";
    wh.classList.add("osc-field-input", "osc-field-input-wide");
    wh.spellcheck = false;
    wh.title =
        "Usually 127.0.0.1 if the bridge runs on this PC. Advanced: full ws://127.0.0.1:8765 in this field instead of host+port.";
    state.osc.wsHost.subscribe((v) => {
        if (wh.value !== v) wh.value = v;
    });
    wh.addEventListener("input", () => {
        state.osc.wsHost.value = wh.value;
    });
    wsHostRow.append(wl, wh);

    const wsPortRow = document.createElement("div");
    wsPortRow.classList.add("osc-hp-cell");
    const wpl = document.createElement("span");
    wpl.innerText = "WebSocket port (match OSC_WS_PORT)";
    const wp = document.createElement("input");
    wp.type = "text";
    wp.classList.add("osc-field-input", "osc-port-input");
    wp.inputMode = "numeric";
    state.osc.wsPort.subscribe((v) => {
        if (wp.value !== v) wp.value = v;
    });
    wp.addEventListener("input", () => {
        state.osc.wsPort.value = wp.value;
    });
    wsPortRow.append(wpl, wp);
    wsGrid.append(wsHostRow, wsPortRow);

    const udpRef = oscTextField(
        "UDP port for TouchOSC and other OSC apps (match OSC_UDP_PORT, often 57121)",
        state.osc.bridgeUdpListenPort
    );

    const inHead = document.createElement("div");
    inHead.classList.add("osc-section-label");
    inHead.innerText = "OSC in (last message forwarded from UDP)";

    const lastIn = document.createElement("div");
    lastIn.classList.add("osc-last-in");
    state.osc.lastIncomingOsc.subscribe((t) => {
        lastIn.innerText = t || "(none yet)";
    });

    const debugHead = document.createElement("div");
    debugHead.classList.add("osc-section-label");
    debugHead.innerText = "Debug (recent incoming messages)";

    const debugRow = document.createElement("div");
    debugRow.classList.add("osc-debug-row");
    const debugClear = document.createElement("button");
    debugClear.type = "button";
    debugClear.classList.add("osc-debug-clear");
    debugClear.innerText = "Clear debug";
    debugRow.append(debugClear);

    const debugLog = document.createElement("div");
    debugLog.classList.add("osc-debug-log");
    const lines: string[] = [];
    const MAX_LINES = 80;
    function pushDebug(prefix: string, msg: string) {
        const m = msg.trim();
        if (!m) return;
        lines.push(`[${prefix}] ${m}`);
        if (lines.length > MAX_LINES) {
            lines.splice(0, lines.length - MAX_LINES);
        }
        debugLog.textContent = lines.join("\n");
        debugLog.scrollTop = debugLog.scrollHeight;
    }
    debugClear.addEventListener("click", () => {
        lines.length = 0;
        debugLog.textContent = "";
    });
    state.osc.lastIncomingOsc.subscribe((t) => pushDebug("OSC", t || ""));
    state.midiLearn.lastIncoming.subscribe((t) => pushDebug("MIDI", t || ""));

    const outHead = document.createElement("div");
    outHead.classList.add("osc-section-label");
    outHead.innerText = "OSC out (UDP target for messages from this page)";

    const outGrid = document.createElement("div");
    outGrid.classList.add("osc-host-port-grid");
    const ohRow = document.createElement("div");
    ohRow.classList.add("osc-hp-cell");
    const ohl = document.createElement("span");
    ohl.innerText = "Target IP / host";
    const oh = document.createElement("input");
    oh.type = "text";
    oh.classList.add("osc-field-input", "osc-field-input-wide");
    state.osc.outHost.subscribe((v) => {
        if (oh.value !== v) oh.value = v;
    });
    oh.addEventListener("input", () => {
        state.osc.outHost.value = oh.value;
    });
    ohRow.append(ohl, oh);

    const opRow = document.createElement("div");
    opRow.classList.add("osc-hp-cell");
    const opl = document.createElement("span");
    opl.innerText = "Target UDP port";
    const op = document.createElement("input");
    op.type = "text";
    op.classList.add("osc-field-input", "osc-port-input");
    op.inputMode = "numeric";
    state.osc.outPort.subscribe((v) => {
        if (op.value !== v) op.value = v;
    });
    op.addEventListener("input", () => {
        state.osc.outPort.value = op.value;
    });
    opRow.append(opl, op);
    outGrid.append(ohRow, opRow);

    const emitRow = document.createElement("div");
    emitRow.classList.add("osc-emit-row");
    emitRow.append(
        toggleButton(state.osc.emitStepOsc, { classes: ["osc-emit-btn"] }),
        toggleButton(state.osc.emitBpmOsc, { classes: ["osc-emit-btn"] })
    );
    const emitNote = document.createElement("div");
    emitNote.classList.add("sync-hint");
    emitNote.innerText =
        "Emit step: /acid/step (UDP out). Emit BPM: /acid/bpm. Step/BPM UDP uses Target IP/port.";

    const st = document.createElement("div");
    st.classList.add("sync-status");
    state.osc.status.subscribe((t) => {
        st.innerText = t;
    });

    const statusFoot = document.createElement("div");
    statusFoot.classList.add("sync-hint", "osc-status-readme-foot");
    statusFoot.append(
        document.createTextNode("Help: "),
        oscBridgeReadmeLink("Open bridge README"),
        document.createTextNode(
            " | Start bridge/server.mjs (or Start OSC bridge link) if status stays connecting or disconnected. "
        ),
        (() => {
            const a = document.createElement("a");
            a.href = "osc-reference.html";
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.classList.add("osc-bridge-readme-link");
            a.innerText = "OSC reference";
            return a;
        })(),
        document.createTextNode(".")
    );

    const hint = document.createElement("div");
    hint.classList.add("sync-hint", "osc-bridge-foot-hint");
    hint.append(
        document.createTextNode("Run "),
        oscBridgeReadmeLink("bridge/server.mjs"),
        document.createTextNode(" (details in "),
        oscBridgeReadmeLink("bridge README"),
        document.createTextNode(
            "). UDP uses the listen and target ports; WebSocket host/port is only for this page talking to Node."
        )
    );

    body.append(
        en,
        readmeRow,
        oscProtoRow,
        plainHelp,
        wsHead,
        wsGrid,
        udpRef,
        inHead,
        lastIn,
        debugHead,
        debugRow,
        debugLog,
        outHead,
        outGrid,
        emitRow,
        emitNote,
        st,
        statusFoot,
        hint
    );
    box.append(title, refLinkRow, body);
    return box;
}

function shouldUseLiteVisualMode(): boolean {
    const coarsePointer =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
    const narrowScreen =
        typeof window !== "undefined" && window.innerWidth < 860;
    const lowCoreCount =
        typeof navigator !== "undefined" &&
        typeof navigator.hardwareConcurrency === "number" &&
        navigator.hardwareConcurrency <= 4;
    const navWithMemory = navigator as Navigator & { deviceMemory?: number };
    const lowMemory =
        typeof navigator !== "undefined" &&
        typeof navWithMemory.deviceMemory === "number" &&
        navWithMemory.deviceMemory <= 4;
    return coarsePointer || narrowScreen || lowCoreCount || lowMemory;
}

function visualPanel(state: ProgramState, analyser: AnalyserNode): HTMLElement {
    const host = document.createElement("div");
    host.classList.add("visual-host");
    const liteMode = shouldUseLiteVisualMode();
    if (!liteMode) {
        host.append(Acid303Visual(state, analyser));
        return host;
    }

    host.classList.add("visual-lite");
    const note = document.createElement("p");
    note.classList.add("visual-lite-note");
    note.textContent =
        "Mobile-safe visual mode: 3D hardware render is paused by default to keep knobs, buttons and scrolling responsive.";
    const enableBtn = document.createElement("button");
    enableBtn.type = "button";
    enableBtn.classList.add("visual-lite-enable");
    enableBtn.textContent = "Enable full 3D visual";
    enableBtn.addEventListener("click", () => {
        host.classList.remove("visual-lite");
        host.replaceChildren(Acid303Visual(state, analyser));
    });
    host.append(note, enableBtn);
    return host;
}

export function UI(
    state: ProgramState,
    autoPilot: AutoPilotUnit,
    analyser: AnalyserNode,
    midiAccess: MIDIAccess | null,
    midiCallbacks: MidiUiCallbacks
) {
    const ui = document.createElement("div");
    ui.id = "ui";

    const tempoHeader = createBpmTempoHeader(state.clock);

    const midiTargetMenu = createMidiTargetContextMenu(midiCallbacks);

    const otherControls = controls(
        MidiDevicesPanel(state.clock, midiAccess, state, midiCallbacks),
        SyncAndMidiPanel(state.clock),
        OscPanel(state),
        AutopilotControls(autoPilot, midiTargetMenu),
        NoteGen(state.gen, midiTargetMenu),
        DelayControls(state.delay, ui, midiTargetMenu),
        MixerPanel(state, ui, midiTargetMenu),
        controlGroup(
            label("Clock"),
            DialSet([state.clock.bpm], ui, {
                classes: ["horizontal"],
                midiIds: ["clock.bpm"],
                midiMenu: midiTargetMenu,
            })
        ),
        controlGroup(
            label("Volume"),
            DialSet([state.masterVolume], ui, {
                classes: ["horizontal"],
                midiIds: ["master.volume"],
                midiMenu: midiTargetMenu,
            })
        ),
        controlGroup(label("Visual"), group(visualPanel(state, analyser))),
        controlGroup(label("Meter"), group(AudioMeter(analyser)), "meter")
    );

    const machineContainer = document.createElement("div");
    machineContainer.classList.add("machines");

    const noteMachines = state.notes.map((n, i) =>
        machine(
            label("303-0" + (i + 1)),
            group(
                triggerButton(n.newPattern, {
                    midiTargetId: "note" + i + ".newPattern",
                    midiMenu: midiTargetMenu,
                }),
                PatternDisplay(n.pattern, state.clock.currentStep, ui),
                DialSet(n.parameters, ui, {
                    midiByKey: {
                        cutoff: "note" + i + ".cutoff",
                        resonance: "note" + i + ".resonance",
                        envMod: "note" + i + ".envMod",
                        decay: "note" + i + ".decay",
                    },
                    midiMenu: midiTargetMenu,
                })
            )
        )
    );

    const drumMachine = machine(
        label("909-XX"),
        group(
            triggerButton(state.drums.newPattern, {
                midiTargetId: "drums.newPattern",
                midiMenu: midiTargetMenu,
            }),
            DrumDisplay(
                state.drums.pattern,
                state.drums.mutes,
                state.clock.currentStep,
                ui
            ),
            Mutes(
                state.drums.mutes,
                ["drums.mute0", "drums.mute1", "drums.mute2", "drums.mute3"],
                midiTargetMenu
            )
        )
    );

    machineContainer.append(...noteMachines, drumMachine);
    ui.append(tempoHeader, machineContainer, otherControls);

    return ui;
}
