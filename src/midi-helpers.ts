/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/

export function getMidiOutputById(
    access: MIDIAccess | null,
    id: string
): MIDIOutput | null {
    if (!access || !id) return null;
    let found: MIDIOutput | null = null;
    access.outputs.forEach((port) => {
        if (port.id === id) found = port;
    });
    return found;
}

export function getFirstMidiOutput(access: MIDIAccess | null): MIDIOutput | null {
    if (!access) return null;
    let found: MIDIOutput | null = null;
    access.outputs.forEach((port) => {
        if (!found) found = port;
    });
    return found;
}

export function getMidiInputById(
    access: MIDIAccess | null,
    id: string
): MIDIInput | null {
    if (!access || !id) return null;
    let found: MIDIInput | null = null;
    access.inputs.forEach((port) => {
        if (port.id === id) found = port;
    });
    return found;
}

export function getFirstMidiInput(access: MIDIAccess | null): MIDIInput | null {
    if (!access) return null;
    let found: MIDIInput | null = null;
    access.inputs.forEach((port) => {
        if (!found) found = port;
    });
    return found;
}

export function midiPortMapHasId(
    map: MIDIInputMap | MIDIOutputMap,
    id: string
): boolean {
    let ok = false;
    map.forEach((port) => {
        if (port.id === id) ok = true;
    });
    return ok;
}
