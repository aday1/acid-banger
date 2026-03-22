/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
export function getMidiOutputById(access, id) {
    if (!access || !id)
        return null;
    let found = null;
    access.outputs.forEach((port) => {
        if (port.id === id)
            found = port;
    });
    return found;
}
export function getFirstMidiOutput(access) {
    if (!access)
        return null;
    let found = null;
    access.outputs.forEach((port) => {
        if (!found)
            found = port;
    });
    return found;
}
export function getMidiInputById(access, id) {
    if (!access || !id)
        return null;
    let found = null;
    access.inputs.forEach((port) => {
        if (port.id === id)
            found = port;
    });
    return found;
}
export function getFirstMidiInput(access) {
    if (!access)
        return null;
    let found = null;
    access.inputs.forEach((port) => {
        if (!found)
            found = port;
    });
    return found;
}
export function midiPortMapHasId(map, id) {
    let ok = false;
    map.forEach((port) => {
        if (port.id === id)
            ok = true;
    });
    return ok;
}
//# sourceMappingURL=midi-helpers.js.map