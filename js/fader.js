/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
export function VerticalFader(bounds, opts) {
    var _a, _b;
    const accent = (_a = opts === null || opts === void 0 ? void 0 : opts.accent) !== null && _a !== void 0 ? _a : "#aa88cc";
    const wrap = document.createElement("div");
    wrap.classList.add("mixer-fader");
    wrap.style.setProperty("--mixer-fader-accent", accent);
    const track = document.createElement("div");
    track.classList.add("mixer-fader-track");
    track.tabIndex = 0;
    const thumb = document.createElement("div");
    thumb.classList.add("mixer-fader-thumb");
    track.append(thumb);
    wrap.append(track);
    if (opts === null || opts === void 0 ? void 0 : opts.label) {
        const lab = document.createElement("div");
        lab.className = "mixer-fader-label";
        lab.textContent = opts.label;
        wrap.append(lab);
    }
    const handlers = [];
    function norm(v) {
        return (v - bounds[0]) / (bounds[1] - bounds[0]);
    }
    function denorm(n) {
        return bounds[0] + (bounds[1] - bounds[0]) * n;
    }
    let normalized = 1;
    const TRACK_PAD = 6;
    const THUMB_H = 12;
    function paint() {
        const th = track.clientHeight;
        if (th <= 0)
            return;
        const usable = Math.max(0, th - THUMB_H - 2 * TRACK_PAD);
        const bottomPx = TRACK_PAD + normalized * usable;
        thumb.style.bottom = `${bottomPx}px`;
        const v = denorm(normalized);
        const [lo, hi] = bounds;
        track.setAttribute("aria-valuemin", String(lo));
        track.setAttribute("aria-valuemax", String(hi));
        track.setAttribute("aria-valuenow", String(Math.round(v * 1000) / 1000));
    }
    function emit() {
        const v = denorm(normalized);
        for (const h of handlers) {
            h(v);
        }
    }
    function setFromClientY(clientY) {
        const rect = track.getBoundingClientRect();
        const t = (rect.bottom - clientY) / rect.height;
        normalized = clamp01(t);
        paint();
        emit();
    }
    let dragging = false;
    function endDrag(e) {
        if (!dragging)
            return;
        dragging = false;
        try {
            track.releasePointerCapture(e.pointerId);
        }
        catch (_a) {
            /* not captured */
        }
    }
    track.addEventListener("pointerdown", (e) => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        dragging = true;
        track.setPointerCapture(e.pointerId);
        setFromClientY(e.clientY);
    });
    track.addEventListener("pointermove", (e) => {
        if (!dragging)
            return;
        setFromClientY(e.clientY);
    });
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("keydown", (e) => {
        const dn = 0.02;
        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            normalized = clamp01(normalized + dn);
            paint();
            emit();
        }
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            normalized = clamp01(normalized - dn);
            paint();
            emit();
        }
        else if (e.key === "Home") {
            e.preventDefault();
            normalized = 1;
            paint();
            emit();
        }
        else if (e.key === "End") {
            e.preventDefault();
            normalized = 0;
            paint();
            emit();
        }
    });
    track.setAttribute("role", "slider");
    track.setAttribute("aria-label", (_b = opts === null || opts === void 0 ? void 0 : opts.ariaLabel) !== null && _b !== void 0 ? _b : "Level");
    paint();
    requestAnimationFrame(() => paint());
    const ro = new ResizeObserver(() => paint());
    ro.observe(track);
    return {
        element: wrap,
        get value() {
            return denorm(normalized);
        },
        set value(v) {
            normalized = clamp01(norm(v));
            paint();
        },
        bind(h) {
            handlers.push(h);
        },
    };
}
//# sourceMappingURL=fader.js.map