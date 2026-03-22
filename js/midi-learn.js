/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
const STORAGE_KEY = "acid-banger-midi-map-v1";
function loadRaw() {
    try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (!s)
            return {};
        const j = JSON.parse(s);
        const out = {};
        for (const k of Object.keys(j)) {
            const b = j[k];
            if ((b.kind === "cc" || b.kind === "note") &&
                typeof b.channel === "number" &&
                typeof b.number === "number" &&
                b.channel >= 0 &&
                b.channel <= 15 &&
                b.number >= 0 &&
                b.number <= 127) {
                out[k] = {
                    kind: b.kind,
                    channel: b.channel,
                    number: b.number,
                };
            }
        }
        return out;
    }
    catch (_a) {
        return {};
    }
}
function saveRaw(m) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    }
    catch (_a) {
        /* ignore */
    }
}
function bindingKey(b) {
    return `${b.kind}:${b.channel}:${b.number}`;
}
export function buildMidiTargetRegistry(state, autoPilot) {
    const m = new Map();
    m.set("clock.bpm", {
        id: "clock.bpm",
        label: "BPM",
        kind: "numeric",
        bounds: state.clock.bpm.bounds,
        set: (v) => {
            state.clock.bpm.value = v;
        },
    });
    m.set("master.volume", {
        id: "master.volume",
        label: "Volume",
        kind: "numeric",
        bounds: state.masterVolume.bounds,
        set: (v) => {
            state.masterVolume.value = v;
        },
    });
    const mixerLabels = ["303-01", "303-02", "909"];
    state.mixer.strips.forEach((strip, i) => {
        var _a;
        const tag = (_a = mixerLabels[i]) !== null && _a !== void 0 ? _a : `ch${i}`;
        m.set(`mixer.strip${i}.level`, {
            id: `mixer.strip${i}.level`,
            label: `${tag} mixer level`,
            kind: "numeric",
            bounds: strip.level.bounds,
            set: (v) => {
                strip.level.value = v;
            },
        });
        m.set(`mixer.strip${i}.mute`, {
            id: `mixer.strip${i}.mute`,
            label: `${tag} mixer mute`,
            kind: "bool",
            set: (v) => {
                strip.mute.value = v;
            },
            get: () => strip.mute.value,
        });
        m.set(`mixer.strip${i}.solo`, {
            id: `mixer.strip${i}.solo`,
            label: `${tag} mixer solo`,
            kind: "bool",
            set: (v) => {
                strip.solo.value = v;
            },
            get: () => strip.solo.value,
        });
    });
    m.set("delay.dryWet", {
        id: "delay.dryWet",
        label: "Delay dry/wet",
        kind: "numeric",
        bounds: state.delay.dryWet.bounds,
        set: (v) => {
            state.delay.dryWet.value = v;
        },
    });
    m.set("delay.feedback", {
        id: "delay.feedback",
        label: "Delay feedback",
        kind: "numeric",
        bounds: state.delay.feedback.bounds,
        set: (v) => {
            state.delay.feedback.value = v;
        },
    });
    state.notes.forEach((note, i) => {
        var _a;
        const prefix = `note${i}`;
        const labels = {
            cutoff: `303-${i + 1} cutoff`,
            resonance: `303-${i + 1} resonance`,
            envMod: `303-${i + 1} env mod`,
            decay: `303-${i + 1} decay`,
        };
        for (const key of Object.keys(note.parameters)) {
            const p = note.parameters[key];
            const id = `${prefix}.${key}`;
            m.set(id, {
                id,
                label: (_a = labels[key]) !== null && _a !== void 0 ? _a : id,
                kind: "numeric",
                bounds: p.bounds,
                set: (v) => {
                    p.value = v;
                },
            });
        }
        const npId = `${prefix}.newPattern`;
        m.set(npId, {
            id: npId,
            label: `303-${i + 1} new pattern`,
            kind: "trigger",
            set: (v) => {
                if (v)
                    note.newPattern.value = true;
            },
        });
    });
    m.set("gen.newNotes", {
        id: "gen.newNotes",
        label: "Notegen new notes",
        kind: "trigger",
        set: (v) => {
            if (v)
                state.gen.newNotes.value = true;
        },
    });
    m.set("drums.newPattern", {
        id: "drums.newPattern",
        label: "909 new pattern",
        kind: "trigger",
        set: (v) => {
            if (v)
                state.drums.newPattern.value = true;
        },
    });
    state.drums.mutes.forEach((mute, i) => {
        var _a;
        const id = `drums.mute${i}`;
        const names = ["BD", "OH", "CH", "SD"];
        m.set(id, {
            id,
            label: `909 mute ${(_a = names[i]) !== null && _a !== void 0 ? _a : i}`,
            kind: "bool",
            set: (v) => {
                mute.value = v;
            },
            get: () => mute.value,
        });
    });
    const ap = [
        { id: "ap.alterPatterns", label: "Autopilot alter patterns", idx: 0 },
        { id: "ap.twiddleKnobs", label: "Autopilot twiddle knobs", idx: 1 },
        { id: "ap.muteDrums", label: "Autopilot mute drums", idx: 2 },
    ];
    for (const row of ap) {
        const sw = autoPilot.switches[row.idx];
        if (!sw)
            continue;
        m.set(row.id, {
            id: row.id,
            label: row.label,
            kind: "bool",
            set: (v) => {
                sw.value = v;
            },
            get: () => sw.value,
        });
    }
    return m;
}
export function createMidiLearnController(opts) {
    const { targetsById, bumpListEpoch, setStatus } = opts;
    let bindings = loadRaw();
    let pendingTargetId = null;
    const lastCcValue = new Map();
    function persist() {
        saveRaw(bindings);
        bumpListEpoch();
    }
    function forgetTarget(targetId) {
        delete bindings[targetId];
        persist();
        setStatus("MIDI learn: mapping removed");
    }
    function clearAll() {
        bindings = {};
        persist();
        pendingTargetId = null;
        lastCcValue.clear();
        setStatus("MIDI learn: all mappings cleared");
    }
    function getBindingsList() {
        return Object.keys(bindings)
            .map((targetId) => {
            var _a;
            const def = targetsById.get(targetId);
            return {
                targetId,
                label: (_a = def === null || def === void 0 ? void 0 : def.label) !== null && _a !== void 0 ? _a : targetId,
                binding: bindings[targetId],
            };
        })
            .sort((a, b) => a.label.localeCompare(b.label));
    }
    function tryLearnFromMessage(kind, channel, number) {
        var _a, _b;
        if (!pendingTargetId)
            return false;
        const key = bindingKey({ kind, channel, number });
        for (const tid of Object.keys(bindings)) {
            if (bindingKey(bindings[tid]) === key && tid !== pendingTargetId) {
                delete bindings[tid];
            }
        }
        bindings[pendingTargetId] = { kind, channel, number };
        const label = (_b = (_a = targetsById.get(pendingTargetId)) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : pendingTargetId;
        setStatus(`MIDI learn: mapped ${label}`);
        pendingTargetId = null;
        persist();
        return true;
    }
    function startLearnForTarget(targetId) {
        var _a, _b;
        if (!targetsById.has(targetId))
            return;
        pendingTargetId = targetId;
        const label = (_b = (_a = targetsById.get(targetId)) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : targetId;
        setStatus(`MIDI learn: move a fader or pad for "${label}"…`);
        bumpListEpoch();
    }
    function cancelPendingLearn() {
        if (!pendingTargetId)
            return;
        pendingTargetId = null;
        setStatus("");
        bumpListEpoch();
    }
    function isLearnPending() {
        return pendingTargetId !== null;
    }
    function dispatchMappedMessage(data) {
        var _a;
        if (data.length < 2)
            return;
        const st = data[0];
        const ch = st & 0x0f;
        if (st >= 0xb0 && st <= 0xbf) {
            const cc = data[1];
            const val = data.length > 2 ? data[2] : 0;
            const bkey = bindingKey({ kind: "cc", channel: ch, number: cc });
            for (const targetId of Object.keys(bindings)) {
                const b = bindings[targetId];
                if (bindingKey(b) !== bkey)
                    continue;
                const def = targetsById.get(targetId);
                if (!def)
                    continue;
                if (def.kind === "numeric" && def.bounds) {
                    const [lo, hi] = def.bounds;
                    def.set(lo + (hi - lo) * (val / 127));
                }
                else if (def.kind === "bool") {
                    def.set(val >= 64);
                }
                else if (def.kind === "trigger") {
                    const prev = (_a = lastCcValue.get(targetId)) !== null && _a !== void 0 ? _a : -1;
                    lastCcValue.set(targetId, val);
                    if (prev < 64 && val >= 64) {
                        def.set(true);
                    }
                }
            }
            return;
        }
        if (st >= 0x90 && st <= 0x9f) {
            const note = data[1];
            const vel = data.length > 2 ? data[2] : 0;
            if (vel <= 0)
                return;
            const bkey = bindingKey({ kind: "note", channel: ch, number: note });
            for (const targetId of Object.keys(bindings)) {
                const b = bindings[targetId];
                if (bindingKey(b) !== bkey)
                    continue;
                const def = targetsById.get(targetId);
                if (!def)
                    continue;
                if (def.kind === "numeric" && def.bounds) {
                    const [lo, hi] = def.bounds;
                    def.set(lo + (hi - lo) * (note / 127));
                }
                else if (def.kind === "bool") {
                    const cur = def.get ? def.get() : false;
                    def.set(!cur);
                }
                else if (def.kind === "trigger") {
                    def.set(true);
                }
            }
        }
    }
    function handleMidiMessage(ev) {
        const data = ev.data;
        if (!data || data.length < 2)
            return;
        const st = data[0];
        if (st < 0x80 || st > 0xef)
            return;
        if (st >= 0xb0 && st <= 0xbf && data.length >= 3) {
            const ch = st & 0x0f;
            const cc = data[1];
            if (tryLearnFromMessage("cc", ch, cc))
                return;
            dispatchMappedMessage(data);
            return;
        }
        if (st >= 0x90 && st <= 0x9f) {
            const ch = st & 0x0f;
            const note = data[1];
            const vel = data.length > 2 ? data[2] : 0;
            if (vel > 0) {
                if (tryLearnFromMessage("note", ch, note))
                    return;
            }
            dispatchMappedMessage(data);
        }
    }
    return {
        handleMidiMessage,
        startLearnForTarget,
        cancelPendingLearn,
        isLearnPending,
        forgetTarget,
        clearAll,
        getBindingsList,
        reloadFromStorage() {
            bindings = loadRaw();
            bumpListEpoch();
        },
    };
}
//# sourceMappingURL=midi-learn.js.map