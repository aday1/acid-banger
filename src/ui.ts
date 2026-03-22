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
import { midiPortMapHasId } from "./midi-helpers.js";

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
};

export type MidiTargetMenu = {
    attach(el: HTMLElement, targetId: string): void;
};

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
        const dial = Dial(param.bounds, param.name, cols.dial, cols.text);
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
    }
) {
    const button = document.createElement("button");
    button.classList.add(...(opts?.classes ?? []));
    button.innerText = param.name;
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
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    let w = (canvas.width = 200);
    const h = (canvas.height = 100);
    const g = canvas.getContext("2d") as CanvasRenderingContext2D;

    const output = new Uint8Array(analyser.fftSize);

    function draw() {
        analyser.getByteTimeDomainData(output);

        g.clearRect(0, 0, w, h);
        g.strokeStyle = "white";
        g.beginPath();
        g.moveTo(0, h / 2);
        for (let i = 0; i < output.length; i++) {
            const v = output[i] / 128 - 1;
            g.lineTo((w * i) / output.length, h / 2 + 1.5 * v * (h / 2));
        }

        g.stroke();
        window.requestAnimationFrame(draw);
    }
    window.requestAnimationFrame(draw);

    return canvas;
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

    learnBlock.append(
        learnHead,
        learnHint,
        learnStatus,
        cancelWait,
        mapWrap,
        clearAll
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

    const stepsTitle = document.createElement("div");
    stepsTitle.classList.add("link-bridge-steps-title");
    stepsTitle.innerText = "Quick start";

    const steps = document.createElement("ol");
    steps.classList.add("link-bridge-steps");
    const stepTexts = [
        "Clone or open the acid-banger repo on disk.",
        "In a terminal: cd link-bridge",
        "Run npm install (needs Python + C++ build tools for the native addon; see README if this fails).",
        "Run npm start — leave this terminal open. Default WebSocket port is 9999.",
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
        "Internal: built-in tempo. MIDI master: clock + acid MIDI out. MIDI slave: MIDI clock in. Ableton Link: start link-bridge (Node) on your machine, then use the fields above — the browser does not load Link by itself.";

    body.append(modes, linkRow, status, hint);

    box.append(title, body);
    return box;
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

    const body = document.createElement("div");
    body.classList.add("sync-panel-body");

    const en = document.createElement("div");
    en.classList.add("osc-enable-row");
    en.append(toggleButton(state.osc.enabled, { classes: ["osc-toggle"] }));

    const readmeRow = document.createElement("div");
    readmeRow.classList.add("osc-bridge-readme-row");
    const readmeLink = document.createElement("a");
    readmeLink.href = "bridge-README.txt";
    readmeLink.target = "_blank";
    readmeLink.rel = "noopener noreferrer";
    readmeLink.classList.add("osc-bridge-readme-link");
    readmeLink.innerText =
        "Open bridge/README.txt (install server.mjs, UDP port, WebSocket)";
    readmeRow.append(readmeLink);

    const plainHelp = document.createElement("div");
    plainHelp.classList.add("osc-plain-help");
    const helpTitle = document.createElement("div");
    helpTitle.classList.add("osc-plain-help-title");
    helpTitle.innerText = "What is WebSocket vs UDP? (TouchOSC, etc.)";
    const p1 = document.createElement("div");
    p1.classList.add("sync-hint", "osc-plain-p");
    p1.innerText =
        "Browsers cannot speak OSC over UDP. The Node program bridge/server.mjs runs on your computer and relays messages. The status line that says connected to Node at 127.0.0.1 port 8765 is only the link from this tab to that program. ws:// just means WebSocket on your machine; you do not type that into TouchOSC.";
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
        "Emit step: sends /acid/step with 16th index. Emit BPM: sends /acid/bpm when tempo changes. Both use the UDP target above.";

    const st = document.createElement("div");
    st.classList.add("sync-status");
    state.osc.status.subscribe((t) => {
        st.innerText = t;
    });

    const hint = document.createElement("div");
    hint.classList.add("sync-hint");
    hint.innerText =
        "Run bridge/server.mjs (README link above). UDP goes in/out on the listen and target ports; the WebSocket fields are only for this page talking to Node.";

    body.append(
        en,
        readmeRow,
        plainHelp,
        wsHead,
        wsGrid,
        udpRef,
        inHead,
        lastIn,
        outHead,
        outGrid,
        emitRow,
        emitNote,
        st,
        hint
    );
    box.append(title, body);
    return box;
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

    const midiTargetMenu = createMidiTargetContextMenu(midiCallbacks);

    const otherControls = controls(
        MidiDevicesPanel(state.clock, midiAccess, state, midiCallbacks),
        SyncAndMidiPanel(state.clock),
        OscPanel(state),
        AutopilotControls(autoPilot, midiTargetMenu),
        NoteGen(state.gen, midiTargetMenu),
        DelayControls(state.delay, ui, midiTargetMenu),
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
    ui.append(machineContainer, otherControls);

    return ui;
}
