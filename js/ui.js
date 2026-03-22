/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
import { textNoteToNumber } from "./audio.js";
import { Dial } from "./dial.js";
import { VerticalFader } from "./fader.js";
import { midiPortMapHasId } from "./midi-helpers.js";
function syncModeRoleLabel(mode) {
    switch (mode) {
        case "internal":
            return "Internal (master)";
        case "midi-master":
            return "MIDI master";
        case "midi-slave":
            return "MIDI slave";
        case "ableton-link":
            return "Ableton Link";
        default:
            return String(mode);
    }
}
function createBpmTempoHeader(clock) {
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
    const ledEls = [];
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
    function syncBeatLeds(step) {
        const q = step % 4;
        for (let i = 0; i < 4; i++) {
            const on = i === q;
            ledEls[i].classList.toggle("bpm-beat-led--on", on);
            ledEls[i].classList.toggle("bpm-beat-led--downbeat", on && step === 0);
        }
    }
    let flashTimer = null;
    function pulseTransportFlash(isDownbeat) {
        if (flashTimer !== null) {
            window.clearTimeout(flashTimer);
            flashTimer = null;
        }
        wrap.classList.remove("bpm-tempo-header-flash-downbeat", "bpm-tempo-header-flash-beat");
        void wrap.offsetWidth;
        wrap.classList.add(isDownbeat
            ? "bpm-tempo-header-flash-downbeat"
            : "bpm-tempo-header-flash-beat");
        flashTimer = window.setTimeout(() => {
            wrap.classList.remove("bpm-tempo-header-flash-downbeat", "bpm-tempo-header-flash-beat");
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
    const TAP_GAP_MS = 2200;
    let tapTimes = [];
    tapBtn.addEventListener("click", () => {
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
            const gaps = [];
            for (let i = 1; i < tapTimes.length; i++) {
                gaps.push(tapTimes[i] - tapTimes[i - 1]);
            }
            const avg = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
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
function createMidiTargetContextMenu(cb) {
    let menu = null;
    let globalsBound = false;
    function closeMenu() {
        if (menu) {
            menu.remove();
            menu = null;
        }
    }
    function onDocPointerDown(ev) {
        if (!menu)
            return;
        const t = ev.target;
        if (!menu.contains(t)) {
            closeMenu();
        }
    }
    function onKeyDown(ev) {
        if (ev.key === "Escape") {
            closeMenu();
        }
    }
    function bindGlobals() {
        if (globalsBound)
            return;
        globalsBound = true;
        document.addEventListener("pointerdown", onDocPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
    }
    function openMenu(clientX, clientY, targetId) {
        closeMenu();
        bindGlobals();
        const box = document.createElement("div");
        box.className = "midi-ctx-menu";
        function addItem(text, action) {
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
        addItem("MIDI learn this control", () => cb.startMidiLearnForTarget(targetId));
        addItem("MIDI forget this control", () => cb.forgetMidiMapping(targetId));
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
        if (x < pad)
            x = pad;
        if (y < pad)
            y = pad;
        box.style.left = x + "px";
        box.style.top = y + "px";
    }
    return {
        attach(el, targetId) {
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
function readUiColorVars(_host) {
    const s = getComputedStyle(document.documentElement);
    const pick = (name, cssVar) => {
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
function DialSet(parameters, colorHost, opts) {
    var _a;
    const keys = Array.isArray(parameters) ? null : Object.keys(parameters);
    const params = Array.isArray(parameters)
        ? parameters
        : keys.map((k) => parameters[k]);
    const container = document.createElement("div");
    container.classList.add("params", ...((_a = opts === null || opts === void 0 ? void 0 : opts.classes) !== null && _a !== void 0 ? _a : []));
    const applyDialColors = () => {
        const c = readUiColorVars(colorHost);
        return { dial: c.dial, text: c.text };
    };
    params.forEach((param, i) => {
        var _a;
        const cols = applyDialColors();
        const dialLabel = ((_a = opts === null || opts === void 0 ? void 0 : opts.dialShortLabels) === null || _a === void 0 ? void 0 : _a[i]) !== undefined
            ? opts.dialShortLabels[i]
            : param.name;
        const dial = Dial(param.bounds, dialLabel, cols.dial, cols.text);
        dial.bind((v) => {
            param.value = v;
        });
        param.subscribe((v) => (dial.value = v));
        let midiId;
        if (opts === null || opts === void 0 ? void 0 : opts.midiIds) {
            midiId = opts.midiIds[i];
        }
        else if ((opts === null || opts === void 0 ? void 0 : opts.midiByKey) && keys) {
            midiId = opts.midiByKey[keys[i]];
        }
        if (midiId && (opts === null || opts === void 0 ? void 0 : opts.midiMenu)) {
            opts.midiMenu.attach(dial.element, midiId);
            dial.element.title =
                "Drag to set level. Right-click: MIDI learn or forget mapping.";
        }
        container.append(dial.element);
    });
    return container;
}
function triggerButton(target, opts) {
    const but = document.createElement("button");
    but.classList.add("trigger-button");
    but.innerText = "\u21BB";
    target.subscribe((v) => {
        if (v)
            but.classList.add("waiting");
        else
            but.classList.remove("waiting");
    });
    const mid = opts === null || opts === void 0 ? void 0 : opts.midiTargetId;
    if (mid && (opts === null || opts === void 0 ? void 0 : opts.midiMenu)) {
        opts.midiMenu.attach(but, mid);
    }
    but.addEventListener("click", function () {
        target.value = true;
    });
    return but;
}
function toggleButton(param, opts) {
    var _a, _b;
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add(...((_a = opts === null || opts === void 0 ? void 0 : opts.classes) !== null && _a !== void 0 ? _a : []));
    button.innerText = (_b = opts === null || opts === void 0 ? void 0 : opts.labelOverride) !== null && _b !== void 0 ? _b : param.name;
    if (opts === null || opts === void 0 ? void 0 : opts.title) {
        button.title = opts.title;
    }
    if (opts === null || opts === void 0 ? void 0 : opts.ariaLabel) {
        button.setAttribute("aria-label", opts.ariaLabel);
    }
    const mid = opts === null || opts === void 0 ? void 0 : opts.midiTargetId;
    if (mid && (opts === null || opts === void 0 ? void 0 : opts.midiMenu)) {
        opts.midiMenu.attach(button, mid);
    }
    button.addEventListener("click", () => {
        param.value = !param.value;
    });
    param.subscribe((v) => {
        if (v) {
            button.classList.add("on");
            button.classList.remove("off");
        }
        else {
            button.classList.add("off");
            button.classList.remove("on");
        }
    });
    return button;
}
function label(text) {
    const element = document.createElement("div");
    element.classList.add("label");
    element.innerText = text;
    return element;
}
function machine(...contents) {
    const element = document.createElement("div");
    element.classList.add("machine");
    element.append(...contents);
    return element;
}
function controlGroup(labelEl, content, ...classes) {
    const element = document.createElement("div");
    element.classList.add("control-group", ...classes);
    element.append(labelEl, content);
    return element;
}
function controls(...contents) {
    const element = document.createElement("div");
    element.classList.add("controls");
    element.append(...contents);
    return element;
}
function group(...contents) {
    const element = document.createElement("div");
    element.classList.add("group");
    element.append(...contents);
    return element;
}
function PatternDisplay(patternParam, stepParam, colorHost) {
    const canvas = document.createElement("canvas");
    canvas.classList.add("pattern");
    function repaint() {
        const colors = readUiColorVars(colorHost);
        const pattern = patternParam.value;
        const w = (canvas.width = canvas.clientWidth);
        const h = (canvas.height = 200);
        const vScale = h / 50;
        const g = canvas.getContext("2d");
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
            }
            else {
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
        g.fillRect((w * stepParam.value) / pattern.length, 0, w / pattern.length, h);
    }
    patternParam.subscribe(repaint);
    stepParam.subscribe(repaint);
    return canvas;
}
function DrumDisplay(pattern, mutes, stepParam, colorHost) {
    const canvas = document.createElement("canvas");
    canvas.classList.add("pattern");
    function repaint() {
        const colors = readUiColorVars(colorHost);
        const w = (canvas.width = canvas.clientWidth);
        const h = (canvas.height = 100);
        const g = canvas.getContext("2d");
        g.fillStyle = colors.bg;
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 16; i++) {
            const x = (w * i) / 16;
            for (let p = 0; p < pattern.value.length; p++) {
                const y = (p / pattern.value.length) * h;
                if (pattern.value[p][i]) {
                    if (mutes[p].value) {
                        g.fillStyle = "rgba(128,0,0,0.4)";
                    }
                    else {
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
function NoteGen(noteGenerator, midiMenu) {
    const currentNotes = document.createElement("div");
    currentNotes.classList.add("parameter-controlled", "notegen-note-display");
    noteGenerator.noteSet.subscribe((notes) => {
        currentNotes.innerText = notes.join(", ");
    });
    return controlGroup(label("Notegen"), group(triggerButton(noteGenerator.newNotes, {
        midiTargetId: "gen.newNotes",
        midiMenu,
    }), currentNotes), "notegen-box");
}
function Mutes(params, midiIds, midiMenu) {
    const container = document.createElement("div");
    container.classList.add("mutes");
    container.append(...params.map((p, i) => toggleButton(p, {
        midiTargetId: midiIds[i],
        midiMenu,
    })));
    return container;
}
function DelayControls(delayUnit, colorHost, midiMenu) {
    const dialRow = DialSet([delayUnit.dryWet, delayUnit.feedback], colorHost, {
        classes: ["horizontal"],
        midiIds: ["delay.dryWet", "delay.feedback"],
        midiMenu,
    });
    return controlGroup(label("Delay"), dialRow);
}
function mixerStripLevelFader(level, colorHost, midiId, midiMenu, busName) {
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
function MixerPanel(state, colorHost, midiMenu) {
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
        var _a;
        const name = (_a = stripNames[i]) !== null && _a !== void 0 ? _a : `ch${i}`;
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
        faderCell.append(mixerStripLevelFader(strip.level, colorHost, `mixer.strip${i}.level`, midiMenu, name));
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
    return controlGroup(label("Mixer"), group(desk, hint, midiBlock), "mixer-panel");
}
const autopilotMidiIds = [
    "ap.alterPatterns",
    "ap.twiddleKnobs",
    "ap.muteDrums",
];
function AutopilotControls(autoPilot, midiMenu) {
    return controlGroup(label("Autopilot"), group(...autoPilot.switches.map((p, i) => toggleButton(p, {
        classes: ["autopilot-button"],
        midiTargetId: autopilotMidiIds[i],
        midiMenu,
    }))));
}
function AudioMeter(analyser) {
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    let w = (canvas.width = 200);
    const h = (canvas.height = 100);
    const g = canvas.getContext("2d");
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
function modeRadio(name, value, current, labelText) {
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
        if (input.checked)
            current.value = value;
    });
    const span = document.createElement("span");
    span.innerText = labelText;
    wrap.append(input, span);
    return wrap;
}
function populateMidiSelect(select, midiAccess, kind, currentId) {
    function refill() {
        const keep = select.value;
        select.innerHTML = "";
        const def = document.createElement("option");
        def.value = "";
        def.innerText = kind === "inputs" ? "(first input)" : "(first output)";
        select.append(def);
        if (!midiAccess)
            return;
        const list = kind === "inputs" ? midiAccess.inputs : midiAccess.outputs;
        list.forEach((port) => {
            const opt = document.createElement("option");
            opt.value = port.id;
            opt.innerText = port.name || port.id;
            select.append(opt);
        });
        if (currentId.value && midiPortMapHasId(list, currentId.value)) {
            select.value = currentId.value;
        }
        else if (keep && midiPortMapHasId(list, keep)) {
            select.value = keep;
        }
    }
    refill();
    return refill;
}
function formatMidiBinding(b) {
    const ch = b.channel + 1;
    if (b.kind === "cc") {
        return "Ch " + ch + " CC " + b.number;
    }
    return "Ch " + ch + " Note " + b.number;
}
function MidiDevicesPanel(clock, midiAccess, state, midiCallbacks) {
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
    const refillOut = populateMidiSelect(outSel, midiAccess, "outputs", clock.midiOutputId);
    outSel.addEventListener("change", () => {
        clock.midiOutputId.value = outSel.value;
    });
    clock.midiOutputId.subscribe((id) => {
        if (outSel.value !== id)
            outSel.value = id;
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
    const refillIn = populateMidiSelect(inSel, midiAccess, "inputs", clock.midiInputId);
    inSel.addEventListener("change", () => {
        clock.midiInputId.value = inSel.value;
    });
    clock.midiInputId.subscribe((id) => {
        if (inSel.value !== id)
            inSel.value = id;
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
    learnBlock.append(learnHead, learnHint, learnStatus, cancelWait, mapWrap, clearAll);
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
function SyncAndMidiPanel(clock) {
    const box = document.createElement("div");
    box.classList.add("sync-panel", "sync-panel-wide");
    const title = document.createElement("div");
    title.classList.add("sync-panel-title");
    title.innerText = "Clock sync";
    const body = document.createElement("div");
    body.classList.add("sync-panel-body");
    const modes = document.createElement("div");
    modes.classList.add("sync-modes");
    modes.append(modeRadio("sync-mode", "internal", clock.syncMode, "Internal"), modeRadio("sync-mode", "midi-master", clock.syncMode, "MIDI master"), modeRadio("sync-mode", "midi-slave", clock.syncMode, "MIDI slave"), modeRadio("sync-mode", "ableton-link", clock.syncMode, "Ableton Link"));
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
        "The page cannot run Node by itself. On Windows you can register a one-time URL handler, then use the link below to launch Start-LinkBridge.ps1 from the browser.";
    const protoLink = document.createElement("a");
    protoLink.classList.add("link-bridge-doc-link");
    protoLink.href = "acid-banger-linkbridge://start";
    protoLink.innerText =
        "Start link-bridge on this PC (after Register-AcidLinkBridgeProtocol.ps1)";
    const protoTrouble = document.createElement("div");
    protoTrouble.classList.add("sync-hint", "link-bridge-protocol-trouble");
    protoTrouble.innerText =
        "If the link does nothing: allow opening the app when the browser asks; re-run Register-AcidLinkBridgeProtocol.ps1 from this repo after moving the folder; or Win+R and paste acid-banger-linkbridge://start then Enter.";
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
    linkGuide.append(linkIntro, docLink, protoHint, protoLink, protoTrouble, stepsTitle, steps, cmdLabel, cmdPre);
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
        if (lhi.value !== v)
            lhi.value = v;
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
        if (lpi.value !== v)
            lpi.value = v;
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
function oscBridgeReadmeLink(text) {
    const a = document.createElement("a");
    a.href = "bridge-README.txt";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.classList.add("osc-bridge-readme-link");
    a.innerText = text;
    return a;
}
function oscTextField(labelText, param) {
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
        if (input.value !== v)
            input.value = v;
    });
    input.addEventListener("input", () => {
        param.value = input.value;
    });
    row.append(lab, input);
    return row;
}
function OscPanel(state) {
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
    const readmeLink = oscBridgeReadmeLink("Open bridge README (install server.mjs, UDP + WebSocket ports)");
    readmeRow.append(readmeLink);
    const oscProtoHint = document.createElement("div");
    oscProtoHint.classList.add("sync-hint", "osc-bridge-protocol-hint");
    oscProtoHint.innerText =
        "The page cannot start Node by itself. On Windows, run Register-AcidOscBridgeProtocol.ps1 once from the repo root, then:";
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
    p1.append(document.createTextNode("Browsers cannot speak OSC over UDP. The Node program bridge/server.mjs runs on your computer; see "), oscBridgeReadmeLink("bridge README"), document.createTextNode(" for setup. The status line about connecting to Node at 127.0.0.1 port 8765 is this tab's WebSocket to the bridge. ws:// is not what you type in TouchOSC."));
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
        if (wh.value !== v)
            wh.value = v;
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
        if (wp.value !== v)
            wp.value = v;
    });
    wp.addEventListener("input", () => {
        state.osc.wsPort.value = wp.value;
    });
    wsPortRow.append(wpl, wp);
    wsGrid.append(wsHostRow, wsPortRow);
    const udpRef = oscTextField("UDP port for TouchOSC and other OSC apps (match OSC_UDP_PORT, often 57121)", state.osc.bridgeUdpListenPort);
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
        if (oh.value !== v)
            oh.value = v;
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
        if (op.value !== v)
            op.value = v;
    });
    op.addEventListener("input", () => {
        state.osc.outPort.value = op.value;
    });
    opRow.append(opl, op);
    outGrid.append(ohRow, opRow);
    const emitRow = document.createElement("div");
    emitRow.classList.add("osc-emit-row");
    emitRow.append(toggleButton(state.osc.emitStepOsc, { classes: ["osc-emit-btn"] }), toggleButton(state.osc.emitBpmOsc, { classes: ["osc-emit-btn"] }));
    const emitNote = document.createElement("div");
    emitNote.classList.add("sync-hint");
    emitNote.innerText =
        "Emit step: /acid/step (one float, step 0–15). Emit BPM: /acid/bpm when tempo changes. Both go to Target IP/port above. Full tables: OSC reference page link at top of this panel.";
    const st = document.createElement("div");
    st.classList.add("sync-status");
    state.osc.status.subscribe((t) => {
        st.innerText = t;
    });
    const statusFoot = document.createElement("div");
    statusFoot.classList.add("sync-hint", "osc-status-readme-foot");
    statusFoot.append(document.createTextNode("Help: "), oscBridgeReadmeLink("Open bridge README"), document.createTextNode(" | Start bridge/server.mjs (or Start OSC bridge link) if status stays connecting or disconnected. "), (() => {
        const a = document.createElement("a");
        a.href = "osc-reference.html";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.classList.add("osc-bridge-readme-link");
        a.innerText = "OSC reference";
        return a;
    })(), document.createTextNode("."));
    const hint = document.createElement("div");
    hint.classList.add("sync-hint", "osc-bridge-foot-hint");
    hint.append(document.createTextNode("Run "), oscBridgeReadmeLink("bridge/server.mjs"), document.createTextNode(" (details in "), oscBridgeReadmeLink("bridge README"), document.createTextNode("). UDP uses the listen and target ports; WebSocket host/port is only for this page talking to Node."));
    body.append(en, readmeRow, oscProtoRow, plainHelp, wsHead, wsGrid, udpRef, inHead, lastIn, outHead, outGrid, emitRow, emitNote, st, statusFoot, hint);
    box.append(title, refLinkRow, body);
    return box;
}
export function UI(state, autoPilot, analyser, midiAccess, midiCallbacks) {
    const ui = document.createElement("div");
    ui.id = "ui";
    const tempoHeader = createBpmTempoHeader(state.clock);
    const midiTargetMenu = createMidiTargetContextMenu(midiCallbacks);
    const otherControls = controls(MidiDevicesPanel(state.clock, midiAccess, state, midiCallbacks), SyncAndMidiPanel(state.clock), OscPanel(state), AutopilotControls(autoPilot, midiTargetMenu), NoteGen(state.gen, midiTargetMenu), DelayControls(state.delay, ui, midiTargetMenu), MixerPanel(state, ui, midiTargetMenu), controlGroup(label("Clock"), DialSet([state.clock.bpm], ui, {
        classes: ["horizontal"],
        midiIds: ["clock.bpm"],
        midiMenu: midiTargetMenu,
    })), controlGroup(label("Volume"), DialSet([state.masterVolume], ui, {
        classes: ["horizontal"],
        midiIds: ["master.volume"],
        midiMenu: midiTargetMenu,
    })), controlGroup(label("Meter"), group(AudioMeter(analyser)), "meter"));
    const machineContainer = document.createElement("div");
    machineContainer.classList.add("machines");
    const noteMachines = state.notes.map((n, i) => machine(label("303-0" + (i + 1)), group(triggerButton(n.newPattern, {
        midiTargetId: "note" + i + ".newPattern",
        midiMenu: midiTargetMenu,
    }), PatternDisplay(n.pattern, state.clock.currentStep, ui), DialSet(n.parameters, ui, {
        midiByKey: {
            cutoff: "note" + i + ".cutoff",
            resonance: "note" + i + ".resonance",
            envMod: "note" + i + ".envMod",
            decay: "note" + i + ".decay",
        },
        midiMenu: midiTargetMenu,
    }))));
    const drumMachine = machine(label("909-XX"), group(triggerButton(state.drums.newPattern, {
        midiTargetId: "drums.newPattern",
        midiMenu: midiTargetMenu,
    }), DrumDisplay(state.drums.pattern, state.drums.mutes, state.clock.currentStep, ui), Mutes(state.drums.mutes, ["drums.mute0", "drums.mute1", "drums.mute2", "drums.mute3"], midiTargetMenu)));
    machineContainer.append(...noteMachines, drumMachine);
    ui.append(tempoHeader, machineContainer, otherControls);
    return ui;
}
//# sourceMappingURL=ui.js.map