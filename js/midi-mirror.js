/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
import { textNoteToNumber } from "./audio.js";
export function createAcidMidiMirror(getOutput, channels) {
    const lastNote = [-1, -1];
    function step(notes, stepIndex) {
        const out = getOutput();
        if (!out)
            return;
        notes.forEach((machine, i) => {
            const ch = (channels[i] - 1) & 0x0f;
            const pat = machine.pattern.value;
            if (!pat.length)
                return;
            const slot = pat[stepIndex % 16];
            const prev = lastNote[i];
            if (prev >= 0) {
                out.send([0x80 | ch, prev, 64]);
                lastNote[i] = -1;
            }
            if (slot.note !== "-") {
                const noteNum = textNoteToNumber(slot.note);
                const vel = slot.accent ? 118 : 92;
                out.send([0x90 | ch, noteNum, vel]);
                lastNote[i] = noteNum;
            }
        });
    }
    function allNotesOff(notes) {
        const out = getOutput();
        if (!out)
            return;
        notes.forEach((_, i) => {
            const ch = (channels[i] - 1) & 0x0f;
            const prev = lastNote[i];
            if (prev >= 0) {
                out.send([0x80 | ch, prev, 64]);
                lastNote[i] = -1;
            }
        });
    }
    return { step, allNotesOff };
}
//# sourceMappingURL=midi-mirror.js.map