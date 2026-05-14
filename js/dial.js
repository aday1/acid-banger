/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
function clamp(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
export function Dial(bounds, text, dialColor = "red", textColor = "white") {
    const element = document.createElement("canvas");
    element.classList.add("dial");
    element.style.touchAction = "none";
    const coarsePointer = typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
    const w = element.width = coarsePointer ? 92 : 70;
    const h = element.height = coarsePointer ? 66 : 50;
    const size = coarsePointer ? 26 : 20;
    const g = element.getContext("2d");
    let normalizedValue = 0.5;
    let previousNormalisedValue = 0.5;
    let fadeCounter = 0;
    let fadeTimerHandler = null;
    function paint() {
        g.clearRect(0, 0, w, h);
        const arc = [Math.PI * 0.8, Math.PI * 2.2];
        g.strokeStyle = dialColor;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(w / 2, h / 2, size, arc[0], arc[1]);
        g.stroke();
        g.lineWidth = w / 8;
        const pos = arc[0] + normalizedValue * (arc[1] - arc[0]);
        g.beginPath();
        g.arc(w / 2, h / 2, size, pos - 0.2, pos + 0.2);
        g.stroke();
        if (fadeCounter > 0) {
            g.strokeStyle = "rgba(0,255,0," + clamp(fadeCounter / 10) + ")";
            g.lineWidth = w / 8;
            const pos = arc[0] + normalizedValue * (arc[1] - arc[0]);
            g.beginPath();
            g.arc(w / 2, h / 2, size, pos - 0.2, pos + 0.2);
            g.stroke();
        }
        if (text) {
            g.fillStyle = textColor;
            g.font = "10px Orbitron";
            const tw = g.measureText(text).width;
            g.fillText(text, w / 2 - tw / 2, h / 2 + size);
        }
    }
    function fade(frames) {
        if (fadeTimerHandler)
            window.clearInterval(fadeTimerHandler);
        fadeCounter = Math.min(frames, 10);
        fadeTimerHandler = window.setInterval(() => {
            fadeCounter--;
            paint();
        }, 100);
    }
    function normalise(v) {
        return (v - bounds[0]) / (bounds[1] - bounds[0]);
    }
    function denormalise(n) {
        return bounds[0] + (bounds[1] - bounds[0]) * n;
    }
    function setValue(n) {
        normalizedValue = normalise(n);
        paint();
        if (Math.abs(normalizedValue - previousNormalisedValue) > 0.002) {
            fade(4 + Math.floor(Math.abs(normalizedValue - previousNormalisedValue) / 0.001));
        }
        previousNormalisedValue = normalizedValue;
    }
    function getValue() {
        return denormalise(normalizedValue);
    }
    const state = {
        isDragging: false,
        handler: [(v) => { }],
        pointerId: -1,
        lastX: 0,
        lastY: 0
    };
    function bind(h) {
        state.handler.push(h);
    }
    element.addEventListener("mousedown", (e) => {
        state.isDragging = true;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
    });
    window.addEventListener("mousemove", (e) => {
        if (state.isDragging) {
            const dx = e.clientX - state.lastX;
            const dy = e.clientY - state.lastY;
            state.lastX = e.clientX;
            state.lastY = e.clientY;
            const delta = (dx - dy) / 100;
            normalizedValue = clamp(normalizedValue + delta);
            const actualValue = denormalise(normalizedValue);
            setValue(actualValue);
            state.handler.forEach(h => h(actualValue));
        }
    });
    window.addEventListener("mouseup", (e) => {
        state.isDragging = false;
    });
    function startPointerDrag(e) {
        var _a;
        if (e.pointerType === "mouse" && e.button !== 0)
            return;
        e.preventDefault();
        state.isDragging = true;
        state.pointerId = e.pointerId;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        (_a = element.setPointerCapture) === null || _a === void 0 ? void 0 : _a.call(element, e.pointerId);
    }
    function movePointerDrag(e) {
        if (!state.isDragging || state.pointerId !== e.pointerId)
            return;
        e.preventDefault();
        const dx = e.clientX - state.lastX;
        const dy = e.clientY - state.lastY;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        const delta = (dx - dy) / 100;
        normalizedValue = clamp(normalizedValue + delta);
        const actualValue = denormalise(normalizedValue);
        setValue(actualValue);
        state.handler.forEach(h => h(actualValue));
    }
    function endPointerDrag(e) {
        var _a;
        if (state.pointerId !== e.pointerId)
            return;
        state.isDragging = false;
        state.pointerId = -1;
        try {
            (_a = element.releasePointerCapture) === null || _a === void 0 ? void 0 : _a.call(element, e.pointerId);
        }
        catch (_b) {
            // ignore missing capture
        }
    }
    element.addEventListener("pointerdown", startPointerDrag);
    element.addEventListener("pointermove", movePointerDrag);
    element.addEventListener("pointerup", endPointerDrag);
    element.addEventListener("pointercancel", endPointerDrag);
    element.addEventListener("touchstart", (e) => {
        if (e.touches.length < 1)
            return;
        e.preventDefault();
        const t = e.touches[0];
        state.isDragging = true;
        state.pointerId = 0;
        state.lastX = t.clientX;
        state.lastY = t.clientY;
    }, { passive: false });
    element.addEventListener("touchmove", (e) => {
        if (!state.isDragging || e.touches.length < 1)
            return;
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - state.lastX;
        const dy = t.clientY - state.lastY;
        state.lastX = t.clientX;
        state.lastY = t.clientY;
        const delta = (dx - dy) / 100;
        normalizedValue = clamp(normalizedValue + delta);
        const actualValue = denormalise(normalizedValue);
        setValue(actualValue);
        state.handler.forEach(h => h(actualValue));
    }, { passive: false });
    element.addEventListener("touchend", () => {
        state.isDragging = false;
        state.pointerId = -1;
    });
    element.addEventListener("touchcancel", () => {
        state.isDragging = false;
        state.pointerId = -1;
    });
    paint();
    return {
        element,
        get value() { return getValue(); },
        set value(v) { setValue(v); },
        bind
    };
}
//# sourceMappingURL=dial.js.map