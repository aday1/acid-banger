var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as THREE from "three";
import lamejs from "lamejs";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
function norm(p) {
    const [lo, hi] = p.bounds;
    const span = hi - lo;
    if (span <= 0)
        return 0;
    const t = (p.value - lo) / span;
    return Math.min(1, Math.max(0, t));
}
function makeKnob(x, z, color = 0x262a30) {
    const root = new THREE.Group();
    root.position.set(x, 0.31, z);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.18, 24), new THREE.MeshStandardMaterial({
        color: 0x17192a,
        roughness: 0.62,
        metalness: 0.06,
    }));
    skirt.position.y = 0.03;
    root.add(skirt);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.24, 24), new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.18,
    }));
    body.position.y = 0.16;
    root.add(body);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.24), new THREE.MeshStandardMaterial({
        color: 0xfce9b5,
        roughness: 0.42,
        metalness: 0.08,
    }));
    marker.position.set(0, 0.28, 0.11);
    root.add(marker);
    const flash = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 10, 28), new THREE.MeshStandardMaterial({
        color: 0x9c6cff,
        emissive: 0x2e0f66,
        emissiveIntensity: 0.0,
        roughness: 0.58,
        metalness: 0.12,
        transparent: true,
        opacity: 0.88,
    }));
    flash.rotation.x = Math.PI / 2;
    flash.position.y = 0.03;
    root.add(flash);
    return { root, flash };
}
function panelTexture() {
    const w = 2048;
    const h = 1024;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) {
        return new THREE.CanvasTexture(c);
    }
    g.fillStyle = "#9ca2a8";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.07)";
    g.fillRect(0, 0, w, 110);
    g.fillStyle = "rgba(0,0,0,0.09)";
    g.fillRect(0, h - 140, w, 140);
    g.strokeStyle = "#4d535a";
    g.lineWidth = 6;
    g.strokeRect(30, 30, w - 60, h - 60);
    const sec = (x, y, ww, hh) => {
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.fillRect(x, y, ww, hh);
        g.strokeStyle = "rgba(255,255,255,0.14)";
        g.lineWidth = 2;
        g.strokeRect(x, y, ww, hh);
    };
    sec(70, 120, 930, 250);
    sec(1030, 120, 930, 250);
    sec(70, 390, 1890, 250);
    sec(70, 660, 930, 290);
    sec(1030, 660, 930, 290);
    g.font = "bold 24px Arial";
    for (let i = 0; i < 16; i++) {
        const x = 145 + i * 112;
        g.fillStyle = i % 4 === 0 ? "#101010" : "#2d2d2d";
        g.fillRect(x - 38, 482, 74, 42);
        g.fillStyle = "#f2f2f2";
        g.fillRect(x - 10, 496, 20, 3);
    }
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.needsUpdate = true;
    return tx;
}
function drumPanelTexture() {
    const w = 1600;
    const h = 900;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g)
        return new THREE.CanvasTexture(c);
    g.fillStyle = "#8f9499";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(0, 0, w, 95);
    g.fillStyle = "rgba(0,0,0,0.09)";
    g.fillRect(0, h - 130, w, 130);
    g.strokeStyle = "#454a50";
    g.lineWidth = 5;
    g.strokeRect(26, 26, w - 52, h - 52);
    g.fillStyle = "rgba(0,0,0,0.13)";
    g.fillRect(55, 115, w - 110, 200);
    g.fillRect(55, 340, w - 110, 200);
    g.fillRect(55, 560, w - 110, 290);
    g.font = "bold 21px Arial";
    for (let i = 0; i < 16; i++) {
        const x = 200 + i * 84;
        g.fillStyle = i % 4 === 0 ? "#121212" : "#2b2b2b";
        g.fillRect(x - 30, 430, 60, 34);
        g.fillStyle = "#ededed";
        g.fillRect(x - 10, 446, 20, 3);
    }
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.needsUpdate = true;
    return tx;
}
function mixerPanelTexture() {
    const w = 1400;
    const h = 760;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g)
        return new THREE.CanvasTexture(c);
    g.fillStyle = "#4a505a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(0, 0, w, 90);
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(0, h - 130, w, 130);
    g.strokeStyle = "#232730";
    g.lineWidth = 4;
    g.strokeRect(24, 24, w - 48, h - 48);
    for (let i = 0; i < 6; i++) {
        const x = 130 + i * 210;
        g.fillStyle = "rgba(18,19,24,0.75)";
        g.fillRect(x - 18, 160, 36, 420);
        g.fillStyle = "#7ad2ff";
        g.fillRect(x - 8, 470 - ((i % 3) * 60), 16, 16);
        g.fillStyle = "#c6cfde";
    }
    g.fillStyle = "#f7ba7d";
    g.fillRect(w - 170, 140, 120, 20);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.needsUpdate = true;
    return tx;
}
function speakerGrilleTexture() {
    const w = 512;
    const h = 900;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g)
        return new THREE.CanvasTexture(c);
    g.fillStyle = "#11141a";
    g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12) {
        for (let x = 6; x < w; x += 12) {
            g.fillStyle = "rgba(190,198,214,0.12)";
            g.fillRect(x, y, 2, 2);
        }
    }
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect(18, 18, w - 36, 42);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.needsUpdate = true;
    return tx;
}
export function Acid303Visual(state, analyser) {
    const wrap = document.createElement("div");
    wrap.classList.add("viz303-panel");
    const title = document.createElement("div");
    title.classList.add("sync-panel-title");
    title.innerText = "Generic Hardware Visual";
    const hint = document.createElement("div");
    hint.classList.add("sync-hint");
    hint.innerText =
        "Drag to orbit, mouse wheel to zoom farther out. Use mixer rows to toggle rigs, move X/Z, and adjust yaw. Wall and floor shaders cycle after a few bars.";
    const mount = document.createElement("div");
    mount.classList.add("viz303-canvas-wrap");
    const actions = document.createElement("div");
    actions.classList.add("viz303-actions");
    const recBtn = document.createElement("button");
    recBtn.type = "button";
    recBtn.classList.add("viz303-rec-btn");
    recBtn.textContent = "Start recording";
    const recStatus = document.createElement("span");
    recStatus.classList.add("viz303-rec-status");
    recStatus.textContent = "idle";
    const orbitToggle = document.createElement("button");
    orbitToggle.type = "button";
    orbitToggle.classList.add("viz303-rec-btn");
    orbitToggle.textContent = "Auto orbit: on";
    const orbitSpeed = document.createElement("input");
    orbitSpeed.type = "range";
    orbitSpeed.min = "0";
    orbitSpeed.max = "100";
    orbitSpeed.value = "20";
    orbitSpeed.classList.add("viz303-orbit-speed");
    orbitSpeed.title = "Orbit speed";
    const resetCam = document.createElement("button");
    resetCam.type = "button";
    resetCam.classList.add("viz303-rec-btn");
    resetCam.textContent = "Reset camera";
    const camMode = document.createElement("select");
    camMode.classList.add("viz303-cam-mode");
    for (const mode of [
        ["manual", "Camera: manual"],
        ["orbit", "Camera: orbit"],
        ["fly", "Camera: flythrough"],
        ["cuts", "Camera: BPM cuts"],
        ["track", "Camera: track playback"],
    ]) {
        const o = document.createElement("option");
        o.value = mode[0];
        o.textContent = mode[1];
        camMode.append(o);
    }
    camMode.value = "orbit";
    const trackRecBtn = document.createElement("button");
    trackRecBtn.type = "button";
    trackRecBtn.classList.add("viz303-rec-btn");
    trackRecBtn.textContent = "Record cam track";
    const vjToggle = document.createElement("button");
    vjToggle.type = "button";
    vjToggle.classList.add("viz303-rec-btn");
    vjToggle.textContent = "VJ FX: on";
    const shaderCycleBtn = document.createElement("button");
    shaderCycleBtn.type = "button";
    shaderCycleBtn.classList.add("viz303-rec-btn");
    shaderCycleBtn.textContent = "Shader cycle: on";
    const vjMotionBtn = document.createElement("button");
    vjMotionBtn.type = "button";
    vjMotionBtn.classList.add("viz303-rec-btn");
    vjMotionBtn.textContent = "VJ walls motion: disabled";
    const trippyHwBtn = document.createElement("button");
    trippyHwBtn.type = "button";
    trippyHwBtn.classList.add("viz303-rec-btn");
    trippyHwBtn.textContent = "Trippy hardware: on";
    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.classList.add("viz303-rec-btn");
    fullscreenBtn.textContent = "Fullscreen";
    const exportObjBtn = document.createElement("button");
    exportObjBtn.type = "button";
    exportObjBtn.classList.add("viz303-rec-btn");
    exportObjBtn.textContent = "Export OBJ";
    const exportBlenderBtn = document.createElement("button");
    exportBlenderBtn.type = "button";
    exportBlenderBtn.classList.add("viz303-rec-btn");
    exportBlenderBtn.textContent = "Export Blender(GLB)";
    const exportGifBtn = document.createElement("button");
    exportGifBtn.type = "button";
    exportGifBtn.classList.add("viz303-rec-btn");
    exportGifBtn.textContent = "Export GIF";
    const sizeSlider = document.createElement("input");
    sizeSlider.type = "range";
    sizeSlider.min = "220";
    sizeSlider.max = "760";
    sizeSlider.value = "320";
    sizeSlider.classList.add("viz303-orbit-speed");
    sizeSlider.title = "Visual height";
    const flySpeed = document.createElement("input");
    flySpeed.type = "range";
    flySpeed.min = "2";
    flySpeed.max = "100";
    flySpeed.value = "44";
    flySpeed.classList.add("viz303-orbit-speed");
    flySpeed.title = "Flythrough speed";
    const flySmooth = document.createElement("input");
    flySmooth.type = "range";
    flySmooth.min = "1";
    flySmooth.max = "100";
    flySmooth.value = "26";
    flySmooth.classList.add("viz303-orbit-speed");
    flySmooth.title = "Fly camera smoothing";
    const fxSize = document.createElement("input");
    fxSize.type = "range";
    fxSize.min = "60";
    fxSize.max = "260";
    fxSize.value = "145";
    fxSize.classList.add("viz303-orbit-speed");
    fxSize.title = "Acid geometry size";
    const flyFocus = document.createElement("input");
    flyFocus.type = "range";
    flyFocus.min = "0";
    flyFocus.max = "100";
    flyFocus.value = "18";
    flyFocus.classList.add("viz303-orbit-speed");
    flyFocus.title = "Fly focus pull";
    const fxSpread = document.createElement("input");
    fxSpread.type = "range";
    fxSpread.min = "60";
    fxSpread.max = "260";
    fxSpread.value = "160";
    fxSpread.classList.add("viz303-orbit-speed");
    fxSpread.title = "Acid geometry spread";
    const fxRoam = document.createElement("input");
    fxRoam.type = "range";
    fxRoam.min = "10";
    fxRoam.max = "220";
    fxRoam.value = "95";
    fxRoam.classList.add("viz303-orbit-speed");
    fxRoam.title = "Acid geometry roam speed";
    const fxHit = document.createElement("input");
    fxHit.type = "range";
    fxHit.min = "0";
    fxHit.max = "180";
    fxHit.value = "70";
    fxHit.classList.add("viz303-orbit-speed");
    fxHit.title = "Acid geometry hit bounce";
    function sliderWrap(label, input) {
        const row = document.createElement("label");
        row.classList.add("viz303-slider-wrap");
        const text = document.createElement("span");
        text.classList.add("viz303-slider-label");
        text.textContent = label;
        row.append(text, input);
        return row;
    }
    actions.append(recBtn, orbitToggle, sliderWrap("Orbit", orbitSpeed), camMode, trackRecBtn, sliderWrap("Fly speed", flySpeed), sliderWrap("Fly smooth", flySmooth), sliderWrap("Fly focus", flyFocus), sliderWrap("FX size", fxSize), sliderWrap("FX spread", fxSpread), sliderWrap("FX roam", fxRoam), sliderWrap("FX hit", fxHit), vjToggle, shaderCycleBtn, vjMotionBtn, trippyHwBtn, exportObjBtn, exportBlenderBtn, exportGifBtn, fullscreenBtn, sliderWrap("Height", sizeSlider), resetCam, recStatus);
    const visualMixer = document.createElement("div");
    visualMixer.classList.add("viz303-mixer");
    wrap.append(title, hint, actions, visualMixer, mount);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b10);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const coarsePointer = typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
    const maxPixelRatio = coarsePointer ? 1 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.append(renderer.domElement);
    let recorder = null;
    let recChunks = [];
    let audioTapDest = null;
    let chosenVideoMime = "";
    let recordingAudioNode = null;
    let recordingMuteGain = null;
    let mp3Encoder = null;
    let mp3Chunks = [];
    let mp3Leftover = new Int16Array(0);
    let gifExporting = false;
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.append(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    function downloadText(text, filename, mime = "text/plain;charset=utf-8") {
        downloadBlob(new Blob([text], { type: mime }), filename);
    }
    function recordingMimeType() {
        const candidates = [
            "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
            "video/mp4",
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm;codecs=vp9",
            "video/webm",
        ];
        for (const c of candidates) {
            if (MediaRecorder.isTypeSupported(c))
                return c;
        }
        return "";
    }
    function stopRecording() {
        if (!recorder)
            return;
        const active = recorder;
        recorder = null;
        active.stop();
        if (recordingAudioNode) {
            try {
                recordingAudioNode.disconnect();
            }
            catch (_a) { }
            recordingAudioNode.onaudioprocess = null;
            recordingAudioNode = null;
        }
        if (recordingMuteGain) {
            try {
                recordingMuteGain.disconnect();
            }
            catch (_b) { }
            recordingMuteGain = null;
        }
        if (mp3Encoder) {
            const flush = mp3Encoder.flush();
            if (flush.length > 0)
                mp3Chunks.push(new Int8Array(flush));
            const mp3Blob = new Blob(mp3Chunks, { type: "audio/mpeg" });
            const mp3Url = URL.createObjectURL(mp3Blob);
            const a2 = document.createElement("a");
            a2.href = mp3Url;
            a2.download = "acid-banger-visual-audio-mix.mp3";
            document.body.append(a2);
            a2.click();
            a2.remove();
            window.setTimeout(() => URL.revokeObjectURL(mp3Url), 0);
            mp3Encoder = null;
            mp3Chunks = [];
            mp3Leftover = new Int16Array(0);
        }
        recBtn.textContent = "Start recording";
        recStatus.textContent = "stopping...";
    }
    function startRecording() {
        const canvasStream = renderer.domElement.captureStream(60);
        if (!audioTapDest) {
            const audioCtx = analyser.context;
            audioTapDest = audioCtx.createMediaStreamDestination();
            try {
                // Tap post-master analyser output so recording matches what you hear.
                if (audioTapDest) {
                    analyser.connect(audioTapDest);
                }
            }
            catch (_a) {
                // Keep video-only recording if audio tap fails.
            }
        }
        const out = new MediaStream();
        for (const t of canvasStream.getVideoTracks())
            out.addTrack(t);
        if (audioTapDest) {
            for (const t of audioTapDest.stream.getAudioTracks())
                out.addTrack(t);
        }
        const mimeType = recordingMimeType();
        chosenVideoMime = mimeType;
        recorder = mimeType
            ? new MediaRecorder(out, { mimeType })
            : new MediaRecorder(out);
        const sampleRate = analyser.context.sampleRate || 44100;
        mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 160);
        mp3Chunks = [];
        mp3Leftover = new Int16Array(0);
        recordingAudioNode = analyser.context.createScriptProcessor(2048, 2, 1);
        recordingMuteGain = analyser.context.createGain();
        recordingMuteGain.gain.value = 0;
        recordingAudioNode.onaudioprocess = (ev) => {
            if (!mp3Encoder)
                return;
            const inBuf = ev.inputBuffer;
            const ch0 = inBuf.getChannelData(0);
            const ch1 = inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : inBuf.getChannelData(0);
            const merged = new Int16Array(ch0.length);
            for (let i = 0; i < ch0.length; i++) {
                const v = (ch0[i] + ch1[i]) * 0.5;
                const s = Math.max(-1, Math.min(1, v));
                merged[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
            }
            const combo = new Int16Array(mp3Leftover.length + merged.length);
            combo.set(mp3Leftover, 0);
            combo.set(merged, mp3Leftover.length);
            let idx = 0;
            const frame = 1152;
            while (idx + frame <= combo.length) {
                const chunk = combo.subarray(idx, idx + frame);
                const mp3buf = mp3Encoder.encodeBuffer(chunk);
                if (mp3buf.length > 0)
                    mp3Chunks.push(new Int8Array(mp3buf));
                idx += frame;
            }
            mp3Leftover = combo.subarray(idx);
        };
        analyser.connect(recordingAudioNode);
        recordingAudioNode.connect(recordingMuteGain);
        recordingMuteGain.connect(analyser.context.destination);
        recChunks = [];
        recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0)
                recChunks.push(ev.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(recChunks, {
                type: chosenVideoMime || (recorder === null || recorder === void 0 ? void 0 : recorder.mimeType) || "video/webm",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const ext = (chosenVideoMime || "").includes("mp4") ? "mp4" : "webm";
            a.download = `acid-banger-visual.${ext}`;
            document.body.append(a);
            a.click();
            a.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
            recStatus.textContent = "saved";
        };
        recorder.start(250);
        recBtn.textContent = "Stop recording";
        const vidTag = chosenVideoMime.includes("mp4") ? "mp4" : "webm";
        recStatus.textContent = `recording ${vidTag}+mp3 (mixed)`;
    }
    recBtn.addEventListener("click", () => {
        if (recorder)
            stopRecording();
        else
            startRecording();
    });
    exportObjBtn.addEventListener("click", () => {
        try {
            const exporter = new OBJExporter();
            const objText = exporter.parse(scene);
            downloadText(objText, "acid-banger-visual.obj", "text/plain;charset=utf-8");
            recStatus.textContent = "saved OBJ";
        }
        catch (_a) {
            recStatus.textContent = "OBJ export failed";
        }
    });
    exportBlenderBtn.addEventListener("click", () => {
        try {
            const exporter = new GLTFExporter();
            exporter.parse(scene, (result) => {
                if (result instanceof ArrayBuffer) {
                    downloadBlob(new Blob([result], { type: "model/gltf-binary" }), "acid-banger-visual.glb");
                    recStatus.textContent = "saved GLB (Blender)";
                }
                else {
                    const json = JSON.stringify(result);
                    downloadText(json, "acid-banger-visual.gltf", "model/gltf+json");
                    recStatus.textContent = "saved glTF";
                }
            }, (err) => {
                recStatus.textContent = "GLB export failed";
                console.error(err);
            }, { binary: true, onlyVisible: true });
        }
        catch (_a) {
            recStatus.textContent = "GLB export failed";
        }
    });
    exportGifBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
        if (gifExporting)
            return;
        gifExporting = true;
        exportGifBtn.disabled = true;
        const oldText = exportGifBtn.textContent;
        exportGifBtn.textContent = "Exporting GIF...";
        recStatus.textContent = "capturing GIF...";
        try {
            const src = renderer.domElement;
            const srcW = Math.max(160, src.width);
            const srcH = Math.max(120, src.height);
            const maxW = 560;
            const scale = Math.min(1, maxW / srcW);
            const w = Math.max(160, Math.floor(srcW * scale));
            const h = Math.max(120, Math.floor(srcH * scale));
            const sample = document.createElement("canvas");
            sample.width = w;
            sample.height = h;
            const sg = sample.getContext("2d", { willReadFrequently: true });
            const fps = 12;
            const frameCount = 48;
            const gif = GIFEncoder();
            const delay = Math.max(2, Math.round(100 / fps));
            for (let i = 0; i < frameCount; i++) {
                yield new Promise((resolve) => {
                    window.requestAnimationFrame(() => resolve());
                });
                sg.drawImage(src, 0, 0, w, h);
                const rgba = sg.getImageData(0, 0, w, h).data;
                const palette = quantize(rgba, 256);
                const indexed = applyPalette(rgba, palette);
                gif.writeFrame(indexed, w, h, { palette, delay });
            }
            gif.finish();
            const gifBytes = gif.bytes();
            downloadBlob(new Blob([gifBytes], { type: "image/gif" }), "acid-banger-visual.gif");
            recStatus.textContent = "saved GIF";
        }
        catch (err) {
            recStatus.textContent = "GIF export failed";
            console.error(err);
        }
        finally {
            gifExporting = false;
            exportGifBtn.disabled = false;
            exportGifBtn.textContent = oldText || "Export GIF";
        }
    }));
    camMode.addEventListener("change", () => {
        const v = camMode.value;
        cameraMode = v;
        if (v !== "track") {
            trackPlaying = false;
        }
    });
    orbitToggle.addEventListener("click", () => {
        cam.autoOrbitEnabled = !cam.autoOrbitEnabled;
        orbitToggle.textContent = `Auto orbit: ${cam.autoOrbitEnabled ? "on" : "off"}`;
    });
    orbitSpeed.addEventListener("input", () => {
        const v = parseInt(orbitSpeed.value, 10);
        const t = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) / 100 : 0.2;
        cam.autoOrbitSpeed = t * 0.004;
    });
    flySpeed.addEventListener("input", () => {
        const v = parseInt(flySpeed.value, 10);
        const t = Number.isFinite(v) ? Math.max(2, Math.min(100, v)) / 100 : 0.2;
        // Lower cap keeps flythrough from becoming disorienting.
        flyPathRate = 0.002 + t * 0.045;
    });
    flySmooth.addEventListener("input", () => {
        const v = parseInt(flySmooth.value, 10);
        const t = Number.isFinite(v) ? Math.max(1, Math.min(100, v)) / 100 : 0.26;
        // Lower value = smoother/slower camera response.
        flyCamSmoothing = 0.02 + t * 0.16;
    });
    flyFocus.addEventListener("input", () => {
        const v = parseInt(flyFocus.value, 10);
        const t = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) / 100 : 0.18;
        flyFocusPull = t;
    });
    fxSize.addEventListener("input", () => {
        const v = parseInt(fxSize.value, 10);
        const t = Number.isFinite(v) ? Math.max(60, Math.min(260, v)) / 100 : 1.45;
        acidFxSize = t;
    });
    fxSpread.addEventListener("input", () => {
        const v = parseInt(fxSpread.value, 10);
        const t = Number.isFinite(v) ? Math.max(60, Math.min(260, v)) / 100 : 1.6;
        acidFxSpread = t;
    });
    fxRoam.addEventListener("input", () => {
        const v = parseInt(fxRoam.value, 10);
        const t = Number.isFinite(v) ? Math.max(10, Math.min(220, v)) / 100 : 0.95;
        acidFxRoamSpeed = t;
    });
    fxHit.addEventListener("input", () => {
        const v = parseInt(fxHit.value, 10);
        const t = Number.isFinite(v) ? Math.max(0, Math.min(180, v)) / 100 : 0.7;
        acidFxHit = t;
    });
    resetCam.addEventListener("click", () => {
        cam.yaw = 0.18;
        cam.pitch = 0.34;
        cam.radius = 16.5;
        target.set(-1.5, 0.5, -1.4);
    });
    sizeSlider.addEventListener("input", () => {
        const px = parseInt(sizeSlider.value, 10);
        if (Number.isFinite(px)) {
            mount.style.height = `${Math.max(220, Math.min(760, px))}px`;
            resize();
        }
    });
    fullscreenBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
        try {
            if (document.fullscreenElement === mount) {
                yield document.exitFullscreen();
                fullscreenBtn.textContent = "Fullscreen";
            }
            else {
                yield mount.requestFullscreen();
                fullscreenBtn.textContent = "Exit fullscreen";
                resize();
            }
        }
        catch (_a) {
            recStatus.textContent = "fullscreen unavailable";
        }
    }));
    vjToggle.addEventListener("click", () => {
        vjGroup.visible = !vjGroup.visible;
        vjToggle.textContent = `VJ FX: ${vjGroup.visible ? "on" : "off"}`;
    });
    let shaderCycleEnabled = true;
    let vjMotionEnabled = false;
    let trippyHardwareEnabled = true;
    let flyPathRate = 0.02;
    let flyCamSmoothing = 0.055;
    let flyFocusPull = 0.18;
    let acidFxSize = 1.45;
    let acidFxSpread = 1.6;
    let acidFxRoamSpeed = 0.95;
    let acidFxHit = 0.7;
    shaderCycleBtn.addEventListener("click", () => {
        shaderCycleEnabled = !shaderCycleEnabled;
        shaderCycleBtn.textContent = `Shader cycle: ${shaderCycleEnabled ? "on" : "off"}`;
    });
    vjMotionBtn.disabled = true;
    trippyHwBtn.addEventListener("click", () => {
        trippyHardwareEnabled = !trippyHardwareEnabled;
        trippyHwBtn.textContent = `Trippy hardware: ${trippyHardwareEnabled ? "on" : "off"}`;
    });
    trackRecBtn.addEventListener("click", () => {
        if (!trackRecording) {
            cameraTrack.length = 0;
            trackRecording = true;
            trackPlaying = false;
            trackStartMs = performance.now();
            trackRecBtn.textContent = "Stop cam track";
        }
        else {
            trackRecording = false;
            trackRecBtn.textContent = "Record cam track";
            if (cameraTrack.length >= 2) {
                trackDuration = Math.max(0.001, cameraTrack[cameraTrack.length - 1].t - cameraTrack[0].t);
                trackPlaying = true;
                trackStartMs = performance.now();
                cameraMode = "track";
                camMode.value = "track";
            }
        }
    });
    const keyLight = new THREE.DirectionalLight(0xfff0da, 1.28);
    keyLight.position.set(4, 7, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x7ec8ff, 0.52);
    fillLight.position.set(-7, 4, -2);
    scene.add(fillLight);
    const magentaFill = new THREE.DirectionalLight(0xe06dff, 0.34);
    magentaFill.position.set(1, 3, -8);
    scene.add(magentaFill);
    scene.add(new THREE.AmbientLight(0x6b67a2, 0.56));
    const vjUniforms = {
        uTime: { value: 0 },
        uBpm: { value: 120 },
        uAcid: { value: 0 },
        uDrums: { value: 0 },
        uMode: { value: 0 },
        uModeB: { value: 1 },
        uBlend: { value: 0 },
        uGlitch: { value: 0 },
        uChaos: { value: 0 },
    };
    const vjMat = new THREE.ShaderMaterial({
        uniforms: vjUniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uBpm;
            uniform float uAcid;
            uniform float uDrums;
            uniform float uMode;
            uniform float uModeB;
            uniform float uBlend;
            uniform float uGlitch;
            uniform float uChaos;
            vec3 modeCol(float mode, vec2 uv, float bpmPhase, float ring, float stripes, float acidWarp, float drumPunch) {
                if (mode < 0.5) {
                    return vec3(
                        0.2 + ring * 0.5 + drumPunch * 0.4,
                        0.1 + stripes * 0.4 + acidWarp * 0.3,
                        0.3 + acidWarp * 0.6
                    );
                } else if (mode < 1.5) {
                    float tunnel = sin((atan(uv.y, uv.x) + bpmPhase) * 16.0) * 0.5 + 0.5;
                    return vec3(
                        0.35 + tunnel * 0.5,
                        0.08 + ring * 0.4,
                        0.1 + stripes * 0.4 + drumPunch * 0.5
                    );
                } else if (mode < 2.5) {
                    float cells = sin((uv.x * uv.y) * 140.0 + bpmPhase * 7.0 + uAcid * 12.0) * 0.5 + 0.5;
                    return vec3(
                        0.12 + cells * 0.6,
                        0.18 + stripes * 0.55,
                        0.35 + ring * 0.35 + drumPunch * 0.4
                    );
                } else if (mode < 3.5) {
                    float plasma = sin(uv.x * 26.0 + bpmPhase * 5.0) + sin(uv.y * 24.0 - bpmPhase * 4.0);
                    plasma = plasma * 0.25 + 0.5;
                    return vec3(
                        0.28 + plasma * 0.6,
                        0.08 + acidWarp * 0.5,
                        0.2 + stripes * 0.55
                    );
                } else if (mode < 4.5) {
                    float chevrons = sin((abs(uv.x) + uv.y * 0.65) * 34.0 - bpmPhase * 7.0) * 0.5 + 0.5;
                    return vec3(
                        0.22 + chevrons * 0.62,
                        0.08 + ring * 0.28 + drumPunch * 0.35,
                        0.14 + stripes * 0.32
                    );
                } else if (mode < 5.5) {
                    float radial = sin(length(uv + vec2(sin(bpmPhase * 0.3), cos(bpmPhase * 0.23)) * 0.25) * 46.0 - bpmPhase * 12.0);
                    radial = radial * 0.5 + 0.5;
                    return vec3(
                        0.1 + radial * 0.35 + drumPunch * 0.4,
                        0.2 + acidWarp * 0.55,
                        0.34 + radial * 0.5
                    );
                } else if (mode < 6.5) {
                    float grid = sin(uv.x * 40.0 + bpmPhase * 4.0) * sin(uv.y * 40.0 - bpmPhase * 6.0);
                    grid = grid * 0.5 + 0.5;
                    return vec3(
                        0.16 + grid * 0.68,
                        0.05 + stripes * 0.32 + drumPunch * 0.42,
                        0.18 + ring * 0.55
                    );
                } else if (mode < 7.5) {
                    float sonar = sin(length(uv * vec2(0.8, 1.3)) * 56.0 - bpmPhase * 13.0 + uAcid * 7.0) * 0.5 + 0.5;
                    return vec3(
                        0.08 + sonar * 0.72,
                        0.18 + ring * 0.42,
                        0.22 + drumPunch * 0.52 + stripes * 0.21
                    );
                } else if (mode < 8.5) {
                    float diagonal = sin((uv.x * 1.8 + uv.y) * 36.0 + bpmPhase * 9.0) * 0.5 + 0.5;
                    return vec3(
                        0.14 + diagonal * 0.66,
                        0.08 + acidWarp * 0.54,
                        0.26 + ring * 0.52
                    );
                } else if (mode < 9.5) {
                    float hatch = sin(uv.x * 70.0 + bpmPhase * 6.0) * 0.5 + 0.5;
                    hatch *= sin(uv.y * 70.0 - bpmPhase * 5.0) * 0.5 + 0.5;
                    return vec3(
                        0.2 + hatch * 0.62,
                        0.07 + stripes * 0.42 + drumPunch * 0.38,
                        0.17 + acidWarp * 0.36
                    );
                } else if (mode < 10.5) {
                    float pulse = sin((uv.x * uv.x + uv.y * uv.y) * 110.0 - bpmPhase * 17.0) * 0.5 + 0.5;
                    return vec3(
                        0.12 + pulse * 0.74,
                        0.11 + ring * 0.38 + drumPunch * 0.41,
                        0.28 + pulse * 0.49
                    );
                } else if (mode < 11.5) {
                    float kaleido = abs(sin(atan(uv.y, uv.x) * 8.0 + bpmPhase * 3.0));
                    float burst = sin(length(uv) * 80.0 - bpmPhase * 18.0 + uChaos * 9.0) * 0.5 + 0.5;
                    return vec3(
                        0.18 + kaleido * 0.62,
                        0.08 + burst * 0.48 + drumPunch * 0.24,
                        0.2 + ring * 0.42
                    );
                } else if (mode < 12.5) {
                    float ripple = sin((uv.x + sin(uv.y * 8.0 + bpmPhase)) * 42.0 + bpmPhase * 11.0) * 0.5 + 0.5;
                    return vec3(
                        0.1 + ripple * 0.68,
                        0.16 + acidWarp * 0.5,
                        0.24 + stripes * 0.4 + uChaos * 0.2
                    );
                } else if (mode < 13.5) {
                    float checker = step(0.0, sin(uv.x * 34.0 + bpmPhase * 5.0) * sin(uv.y * 34.0 - bpmPhase * 6.0));
                    float softness = sin((uv.x * 4.0 + uv.y * 5.0 + bpmPhase) * 5.0) * 0.5 + 0.5;
                    return vec3(
                        0.12 + checker * 0.55,
                        0.08 + softness * 0.45 + drumPunch * 0.2,
                        0.28 + acidWarp * 0.46
                    );
                } else if (mode < 14.5) {
                    float helix = sin((uv.x * 2.2 - uv.y * 2.2) * 18.0 + bpmPhase * 10.0 + uChaos * 14.0) * 0.5 + 0.5;
                    return vec3(
                        0.2 + helix * 0.58,
                        0.09 + ring * 0.32 + drumPunch * 0.3,
                        0.18 + helix * 0.4 + stripes * 0.3
                    );
                }
                float smoke = sin((uv.x * 8.0 + uv.y * 10.0 + sin(bpmPhase)) * 6.0 + bpmPhase * 4.2 + uAcid * 8.0) * 0.5 + 0.5;
                return vec3(
                    0.18 + smoke * 0.62,
                    0.09 + acidWarp * 0.48,
                    0.24 + stripes * 0.44 + drumPunch * 0.26
                );
            }
            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                float bpmPhase = uTime * (uBpm / 60.0) * 0.8;
                float ring = sin(length(uv) * 30.0 - bpmPhase * 9.0) * 0.5 + 0.5;
                float stripes = sin((uv.x + uv.y * 0.4) * 24.0 + bpmPhase * 6.0) * 0.5 + 0.5;
                float acidWarp = sin(uv.y * 18.0 + bpmPhase * 4.0 + uAcid * 9.0) * 0.5 + 0.5;
                float drumPunch = smoothstep(0.2, 1.0, uDrums) * (sin(bpmPhase * 8.0) * 0.5 + 0.5);
                vec2 glitchUv = uv + vec2(sin(uv.y * 26.0 + bpmPhase * 7.0), cos(uv.x * 23.0 - bpmPhase * 9.0)) * (uGlitch * 0.08);
                vec3 colA = modeCol(uMode, uv, bpmPhase, ring, stripes, acidWarp, drumPunch);
                vec3 colB = modeCol(uModeB, glitchUv, bpmPhase * 1.08, ring, stripes, acidWarp, drumPunch);
                vec3 col = mix(colA, colB, smoothstep(0.0, 1.0, uBlend));
                float crackle = (sin((uv.x * 180.0 + bpmPhase * 30.0)) * sin((uv.y * 160.0 - bpmPhase * 24.0))) * 0.5 + 0.5;
                col += vec3(0.18, 0.06, 0.22) * crackle * uGlitch * 0.28;
                float haze = sin((uv.x * 6.0 + uv.y * 7.0 + bpmPhase) * (3.2 + uChaos * 2.0)) * 0.5 + 0.5;
                col += vec3(0.08, 0.03, 0.12) * haze * (0.22 + uChaos * 0.35);
                float alpha = 0.16 + 0.35 * (ring * 0.45 + stripes * 0.55) + drumPunch * 0.3 + uGlitch * 0.09;
                gl_FragColor = vec4(col, alpha);
            }
        `,
    });
    const vjGroup = new THREE.Group();
    scene.add(vjGroup);
    const vjScreen = new THREE.Mesh(new THREE.PlaneGeometry(31.5, 12), vjMat);
    vjScreen.position.set(0, 5.6, -10.6);
    vjGroup.add(vjScreen);
    const vjBack = new THREE.Mesh(new THREE.PlaneGeometry(31.5, 12), vjMat);
    vjBack.position.set(0, 5.6, 10.6);
    vjBack.rotation.y = Math.PI;
    vjGroup.add(vjBack);
    const vjLeft = new THREE.Mesh(new THREE.PlaneGeometry(18, 8.5), vjMat);
    vjLeft.position.set(-13.8, 4.2, 0);
    vjLeft.rotation.y = Math.PI / 2;
    vjGroup.add(vjLeft);
    const vjRight = new THREE.Mesh(new THREE.PlaneGeometry(18, 8.5), vjMat);
    vjRight.position.set(13.8, 4.2, 0);
    vjRight.rotation.y = -Math.PI / 2;
    vjGroup.add(vjRight);
    const vjCeiling = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), vjMat);
    vjCeiling.position.set(0, 10.8, 0);
    vjCeiling.rotation.x = Math.PI / 2;
    vjGroup.add(vjCeiling);
    const rig303 = new THREE.Group();
    rig303.position.set(6.3, 0, 1.2);
    rig303.rotation.y = -0.15;
    const rig303BaseY = rig303.position.y;
    rig303.scale.set(1.12, 1.2, 1.12);
    scene.add(rig303);
    const rig = rig303;
    const bodyBase = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.85, 5.9), new THREE.MeshStandardMaterial({
        color: 0x262931,
        roughness: 0.78,
        metalness: 0.2,
    }));
    bodyBase.position.y = -0.12;
    rig.add(bodyBase);
    const upperShell = new THREE.Mesh(new THREE.BoxGeometry(11.05, 0.42, 5.25), new THREE.MeshStandardMaterial({
        color: 0x40454f,
        roughness: 0.62,
        metalness: 0.28,
    }));
    upperShell.position.y = 0.16;
    rig.add(upperShell);
    const panelTop = new THREE.Mesh(new THREE.PlaneGeometry(10.55, 4.95), new THREE.MeshStandardMaterial({
        map: panelTexture(),
        roughness: 0.48,
        metalness: 0.35,
    }));
    panelTop.rotation.x = -Math.PI / 2;
    panelTop.position.y = 0.38;
    rig.add(panelTop);
    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(11.15, 0.36, 0.24), new THREE.MeshStandardMaterial({
        color: 0x1a1c22,
        roughness: 0.7,
        metalness: 0.18,
    }));
    frontLip.position.set(0, 0.04, 2.95);
    rig.add(frontLip);
    const sideLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.78, 5.5), new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.85, metalness: 0.1 }));
    sideLeft.position.set(-5.67, -0.03, 0);
    rig.add(sideLeft);
    const sideRight = sideLeft.clone();
    sideRight.position.x = 5.67;
    rig.add(sideRight);
    const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0x5b62ff, roughness: 0.55, metalness: 0.08 }));
    wingL.rotation.z = Math.PI / 2;
    wingL.position.set(-5.82, 0.18, -1.9);
    rig.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 5.82;
    wingR.rotation.z = -Math.PI / 2;
    rig.add(wingR);
    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.07, 0.09), new THREE.MeshStandardMaterial({
        color: 0xa67cff,
        emissive: 0x3d1870,
        emissiveIntensity: 1.5,
        roughness: 0.4,
        metalness: 0.08,
    }));
    neonStrip.position.set(0, 0.52, 2.06);
    rig.add(neonStrip);
    let tuneValue = 0.5;
    let accentValue = 0;
    const knobs = [];
    const knobsLayout = [
        // TB-303 style top row representation (single machine).
        { x: -3.9, z: -1.68, getValue: () => tuneValue }, // Tuning
        { x: -2.55, z: -1.68, getValue: () => norm(state.notes[0].parameters.cutoff) }, // Cutoff
        { x: -1.2, z: -1.68, getValue: () => norm(state.notes[0].parameters.resonance) }, // Resonance
        { x: 0.15, z: -1.68, getValue: () => norm(state.notes[0].parameters.envMod) }, // Env mod
        { x: 1.5, z: -1.68, getValue: () => norm(state.notes[0].parameters.decay) }, // Decay
        { x: 2.85, z: -1.68, getValue: () => accentValue }, // Accent intensity
        { x: 4.2, z: -1.68, getValue: () => state.mixer.strips[0].level.value }, // Volume
    ];
    for (const k of knobsLayout) {
        const knob = makeKnob(k.x, k.z);
        rig.add(knob.root);
        knobs.push({
            mesh: knob.root,
            flash: knob.flash,
            getValue: k.getValue,
            baseY: knob.root.position.y,
            source: "bassline",
            prevValue: k.getValue(),
            flashLevel: 0,
        });
    }
    const stepLeds = [];
    const ledOff = new THREE.Color(0x2a3a1e);
    const ledOn = new THREE.Color(0xc6ff53);
    const ledGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 18);
    for (let i = 0; i < 16; i++) {
        const m = new THREE.Mesh(ledGeo, new THREE.MeshStandardMaterial({
            color: ledOff,
            emissive: 0x101800,
            emissiveIntensity: 0.35,
            roughness: 0.33,
            metalness: 0.18,
        }));
        m.rotation.x = Math.PI / 2;
        m.position.set(-4.2 + i * 0.56, 0.43, 1.05);
        rig.add(m);
        stepLeds.push(m);
    }
    const tempoLed = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), new THREE.MeshStandardMaterial({
        color: 0x441111,
        emissive: 0x140000,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.18,
    }));
    tempoLed.position.set(4.75, 0.42, 0.86);
    rig.add(tempoLed);
    for (const p of [
        [-5.1, -2.25],
        [5.1, -2.25],
        [-5.1, 2.25],
        [5.1, 2.25],
    ]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), new THREE.MeshStandardMaterial({
            color: 0x93969a,
            roughness: 0.5,
            metalness: 0.6,
        }));
        screw.rotation.x = Math.PI / 2;
        screw.position.set(p[0], 0.44, p[1]);
        rig.add(screw);
    }
    const rig909 = new THREE.Group();
    rig909.position.set(-9.2, -0.02, 0.5);
    rig909.rotation.y = 0.22;
    const rig909BaseY = rig909.position.y;
    rig909.scale.set(1.08, 1.14, 1.08);
    scene.add(rig909);
    const drumBody = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.78, 5.0), new THREE.MeshStandardMaterial({
        color: 0x2b2f36,
        roughness: 0.78,
        metalness: 0.2,
    }));
    drumBody.position.y = -0.11;
    rig909.add(drumBody);
    const drumTop = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 4.6), new THREE.MeshStandardMaterial({
        map: drumPanelTexture(),
        roughness: 0.45,
        metalness: 0.34,
    }));
    drumTop.rotation.x = -Math.PI / 2;
    drumTop.position.y = 0.34;
    rig909.add(drumTop);
    for (let i = 0; i < 8; i++) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.36), new THREE.MeshStandardMaterial({
            color: i % 2 ? 0xffa46e : 0x8bc8ff,
            emissive: i % 2 ? 0x4c1d0a : 0x163b52,
            emissiveIntensity: 0.8,
            roughness: 0.48,
            metalness: 0.08,
        }));
        pad.position.set(-2.6 + i * 0.74, 0.4, 1.7);
        rig909.add(pad);
    }
    const drumLeds = [];
    for (let i = 0; i < 16; i++) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), new THREE.MeshStandardMaterial({
            color: 0x381e13,
            emissive: 0x1b0e06,
            emissiveIntensity: 0.3,
            roughness: 0.33,
            metalness: 0.16,
        }));
        m.rotation.x = Math.PI / 2;
        m.position.set(-2.95 + i * 0.39, 0.39, 0.53);
        rig909.add(m);
        drumLeds.push(m);
    }
    const drumLaneIndicators = [];
    for (let i = 0; i < 4; i++) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({
            color: 0x222222,
            emissive: 0x080808,
            emissiveIntensity: 0.2,
            roughness: 0.35,
            metalness: 0.25,
        }));
        lamp.position.set(-3.25, 0.39, 1.28 + i * 0.36);
        rig909.add(lamp);
        drumLaneIndicators.push(lamp);
    }
    const drumLaneEnergy = [0, 0, 0, 0];
    const drumLanePunch = [0, 0, 0, 0];
    const drumKnobs = [];
    const drumKnobPositions = [
        { x: -2.75, z: -1.32 },
        { x: -1.75, z: -1.32 },
        { x: -0.75, z: -1.32 },
        { x: 0.25, z: -1.32 },
    ];
    for (let i = 0; i < 4; i++) {
        const knob = makeKnob(drumKnobPositions[i].x, drumKnobPositions[i].z, 0x343b44);
        rig909.add(knob.root);
        drumKnobs.push({
            mesh: knob.root,
            flash: knob.flash,
            getValue: () => Math.min(1, drumLaneEnergy[i] * 0.72 +
                drumLanePunch[i] * 0.6 +
                state.mixer.strips[2].level.value * 0.28),
            baseY: knob.root.position.y,
            source: "drums",
            prevValue: 0,
            flashLevel: 0,
        });
    }
    const rigMixer = new THREE.Group();
    rigMixer.position.set(-1.5, -0.04, -6.8);
    rigMixer.rotation.y = 0.08;
    const rigMixerBaseY = rigMixer.position.y;
    rigMixer.scale.set(1.12, 1.12, 1.08);
    scene.add(rigMixer);
    const mixerBody = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.66, 3.3), new THREE.MeshStandardMaterial({ color: 0x20252d, roughness: 0.72, metalness: 0.25 }));
    mixerBody.position.y = 0.02;
    rigMixer.add(mixerBody);
    const mixerTop = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.0), new THREE.MeshStandardMaterial({
        map: mixerPanelTexture(),
        roughness: 0.42,
        metalness: 0.36,
    }));
    mixerTop.rotation.x = -Math.PI / 2;
    mixerTop.position.y = 0.36;
    rigMixer.add(mixerTop);
    const mixerPorts = [];
    const mixerMasterPort = new THREE.Object3D();
    mixerMasterPort.position.set(2.35, 0.47, 0.0);
    rigMixer.add(mixerMasterPort);
    for (let i = 0; i < 6; i++) {
        const x = -2.2 + i * 0.88;
        const faderTrack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 1.5), new THREE.MeshStandardMaterial({ color: 0x181b21, roughness: 0.55, metalness: 0.2 }));
        faderTrack.position.set(x, 0.37, 0.25);
        rigMixer.add(faderTrack);
        const fader = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.18), new THREE.MeshStandardMaterial({ color: 0xb7bdc8, roughness: 0.3, metalness: 0.65 }));
        fader.position.set(x, 0.44, 0.2);
        rigMixer.add(fader);
        const inputPort = new THREE.Object3D();
        inputPort.position.set(x, 0.47, -1.25);
        rigMixer.add(inputPort);
        mixerPorts.push(inputPort);
        const channelKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 18), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.45, metalness: 0.35 }));
        channelKnob.position.set(x, 0.43, -0.72);
        rigMixer.add(channelKnob);
    }
    const mixerSideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 3.0), new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.76, metalness: 0.16 }));
    mixerSideL.position.set(-2.9, 0.07, 0.0);
    rigMixer.add(mixerSideL);
    const mixerSideR = mixerSideL.clone();
    mixerSideR.position.x = 2.9;
    rigMixer.add(mixerSideR);
    const speakersGroup = new THREE.Group();
    speakersGroup.position.set(0.2, 0, -12.4);
    const speakersBaseY = speakersGroup.position.y;
    speakersGroup.scale.set(1.14, 1.14, 1.1);
    scene.add(speakersGroup);
    const speakerWoofers = [];
    const speakerTweeters = [];
    function makeSpeaker(x) {
        const g = new THREE.Group();
        g.position.set(x, 0, 0);
        const box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x13161c, roughness: 0.86, metalness: 0.12 }));
        box.position.y = 1.35;
        g.add(box);
        const baffle = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.5), new THREE.MeshStandardMaterial({
            map: speakerGrilleTexture(),
            roughness: 0.58,
            metalness: 0.12,
        }));
        baffle.position.set(0, 1.35, 0.92);
        g.add(baffle);
        const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.22, 28), new THREE.MeshStandardMaterial({ color: 0x242932, roughness: 0.34, metalness: 0.44 }));
        woofer.rotation.x = Math.PI / 2;
        woofer.position.set(0, 1.05, 0.95);
        g.add(woofer);
        speakerWoofers.push(woofer);
        const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0x2f3440, roughness: 0.3, metalness: 0.42 }));
        tweeter.rotation.x = Math.PI / 2;
        tweeter.position.set(0, 2.22, 0.96);
        g.add(tweeter);
        speakerTweeters.push(tweeter);
        const footL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.28), new THREE.MeshStandardMaterial({ color: 0x090b10, roughness: 0.8, metalness: 0.15 }));
        footL.position.set(-0.56, -0.55, 0.36);
        g.add(footL);
        const footR = footL.clone();
        footR.position.x = 0.56;
        g.add(footR);
        const input = new THREE.Object3D();
        input.position.set(0, 0.55, -0.92);
        g.add(input);
        speakersGroup.add(g);
        return { group: g, input };
    }
    const spkL = makeSpeaker(-3.2);
    const spkR = makeSpeaker(3.2);
    const wireGroup = new THREE.Group();
    scene.add(wireGroup);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xffaa4d, transparent: true, opacity: 0.6 });
    const patchCables = [];
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    let cablePulse = 0;
    function makePatchCable(a, b, lift, color = 0xffaa4d) {
        const mat = wireMat.clone();
        mat.color.set(color);
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
        ]);
        const line = new THREE.Line(geo, mat);
        wireGroup.add(line);
        patchCables.push({ line, a, b, lift });
    }
    function setCableGeometry(c) {
        c.a.getWorldPosition(tmpA);
        c.b.getWorldPosition(tmpB);
        const mid = tmpA.clone().add(tmpB).multiplyScalar(0.5);
        const bendA = tmpA.clone().lerp(mid, 0.35);
        const bendB = tmpA.clone().lerp(mid, 0.7);
        bendA.y += c.lift + cablePulse * 0.28;
        bendB.y += c.lift * 0.85 + cablePulse * 0.22;
        const pos = c.line.geometry.getAttribute("position");
        pos.setXYZ(0, tmpA.x, tmpA.y, tmpA.z);
        pos.setXYZ(1, bendA.x, bendA.y, bendA.z);
        pos.setXYZ(2, bendB.x, bendB.y, bendB.z);
        pos.setXYZ(3, tmpB.x, tmpB.y, tmpB.z);
        pos.needsUpdate = true;
    }
    const port303 = new THREE.Object3D();
    port303.position.set(4.95, 0.45, -2.35);
    rig303.add(port303);
    const port909 = new THREE.Object3D();
    port909.position.set(3.75, 0.42, -2.05);
    rig909.add(port909);
    makePatchCable(port303, mixerPorts[1], 1.4, 0xfca94d);
    makePatchCable(port909, mixerPorts[4], 1.6, 0xf3905d);
    makePatchCable(mixerMasterPort, spkL.input, 2.2, 0xffd17e);
    makePatchCable(mixerMasterPort, spkR.input, 2.2, 0xffd17e);
    function rigControlRow(label, rigObj, defaults, options) {
        var _a;
        const row = document.createElement("div");
        row.classList.add("viz303-mixer-row");
        const title = document.createElement("label");
        title.classList.add("viz303-mixer-title");
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = true;
        chk.addEventListener("change", () => {
            rigObj.visible = chk.checked;
        });
        title.append(chk, document.createTextNode(" " + label));
        const xRange = document.createElement("input");
        xRange.type = "range";
        xRange.min = "-140";
        xRange.max = "140";
        xRange.value = String(Math.round(defaults.x * 10));
        xRange.classList.add("viz303-mixer-slider");
        const zRange = document.createElement("input");
        zRange.type = "range";
        zRange.min = "-140";
        zRange.max = "140";
        zRange.value = String(Math.round(defaults.z * 10));
        zRange.classList.add("viz303-mixer-slider");
        xRange.addEventListener("input", () => {
            rigObj.position.x = parseInt(xRange.value, 10) / 10;
        });
        zRange.addEventListener("input", () => {
            rigObj.position.z = parseInt(zRange.value, 10) / 10;
        });
        row.append(title, document.createTextNode("X"), xRange, document.createTextNode("Z"), zRange);
        if ((options === null || options === void 0 ? void 0 : options.showAngles) !== false) {
            const yawRange = document.createElement("input");
            yawRange.type = "range";
            yawRange.min = "-180";
            yawRange.max = "180";
            yawRange.value = String(Math.round((defaults.yaw * 180) / Math.PI));
            yawRange.classList.add("viz303-mixer-slider");
            yawRange.addEventListener("input", () => {
                rigObj.rotation.y = (parseInt(yawRange.value, 10) * Math.PI) / 180;
            });
            const pitchRange = document.createElement("input");
            pitchRange.type = "range";
            pitchRange.min = "-45";
            pitchRange.max = "45";
            pitchRange.value = String(Math.round(((((_a = defaults.pitch) !== null && _a !== void 0 ? _a : rigObj.rotation.x) * 180) / Math.PI)));
            pitchRange.classList.add("viz303-mixer-slider");
            pitchRange.addEventListener("input", () => {
                rigObj.rotation.x = (parseInt(pitchRange.value, 10) * Math.PI) / 180;
            });
            row.append(document.createTextNode("Yaw"), yawRange, document.createTextNode("Pitch"), pitchRange);
        }
        visualMixer.append(row);
    }
    rigControlRow("Hardware A", rig303, {
        x: rig303.position.x,
        z: rig303.position.z,
        yaw: rig303.rotation.y,
        pitch: rig303.rotation.x,
    });
    rigControlRow("Hardware B", rig909, {
        x: rig909.position.x,
        z: rig909.position.z,
        yaw: rig909.rotation.y,
        pitch: rig909.rotation.x,
    });
    rigControlRow("Mixer", rigMixer, {
        x: rigMixer.position.x,
        z: rigMixer.position.z,
        yaw: rigMixer.rotation.y,
        pitch: rigMixer.rotation.x,
    });
    rigControlRow("Speakers", speakersGroup, {
        x: speakersGroup.position.x,
        z: speakersGroup.position.z,
        yaw: speakersGroup.rotation.y,
        pitch: speakersGroup.rotation.x,
    });
    rigControlRow("VJ walls", vjGroup, {
        x: vjGroup.position.x,
        z: vjGroup.position.z,
        yaw: vjGroup.rotation.y,
        pitch: vjGroup.rotation.x,
    });
    const vjMotionRow = document.createElement("div");
    vjMotionRow.classList.add("viz303-mixer-row");
    const vjMotionChk = document.createElement("input");
    vjMotionChk.type = "checkbox";
    vjMotionChk.checked = false;
    vjMotionChk.disabled = true;
    vjMotionChk.addEventListener("change", () => {
        vjMotionEnabled = vjMotionChk.checked;
        vjMotionBtn.textContent = "VJ walls motion: disabled";
    });
    vjMotionRow.append(vjMotionChk, document.createTextNode(" Animate VJ walls (disabled)"));
    visualMixer.append(vjMotionRow);
    const wireRow = document.createElement("div");
    wireRow.classList.add("viz303-mixer-row");
    const wireChk = document.createElement("input");
    wireChk.type = "checkbox";
    wireChk.checked = true;
    wireChk.addEventListener("change", () => {
        wireGroup.visible = wireChk.checked;
    });
    wireRow.append(wireChk, document.createTextNode(" Show patch cables"));
    visualMixer.append(wireRow);
    const floorUniforms = {
        uTime: { value: 0 },
        uBpm: { value: state.clock.bpm.value },
        uAcid: { value: 0 },
        uDrums: { value: 0 },
        uMode: { value: 0 },
        uModeB: { value: 1 },
        uBlend: { value: 0 },
        uChaos: { value: 0 },
    };
    const floorMat = new THREE.ShaderMaterial({
        uniforms: floorUniforms,
        transparent: false,
        side: THREE.DoubleSide,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uBpm;
            uniform float uAcid;
            uniform float uDrums;
            uniform float uMode;
            uniform float uModeB;
            uniform float uBlend;
            uniform float uChaos;
            vec3 floorMode(float mode, vec2 uv, float bpmPhase, float acid, float drums, float chaos) {
                float r = length(uv);
                float a = atan(uv.y, uv.x);
                float grid = abs(fract((uv.x + 1.0) * 12.0) - 0.5) + abs(fract((uv.y + 1.0) * 12.0) - 0.5);
                float rings = sin(r * (36.0 + chaos * 26.0) - bpmPhase * (9.0 + chaos * 6.0)) * 0.5 + 0.5;
                float stripes = sin((uv.x * 22.0 + uv.y * 8.0) + bpmPhase * 6.0) * 0.5 + 0.5;
                float swirl = sin(a * (7.0 + chaos * 4.0) + r * 20.0 - bpmPhase * 5.0) * 0.5 + 0.5;
                if (mode < 1.5) {
                    return vec3(0.03 + rings * 0.42, 0.02 + swirl * 0.16, 0.09 + stripes * 0.5);
                } else if (mode < 2.5) {
                    float checker = mod(floor((uv.x + 1.0) * 18.0) + floor((uv.y + 1.0) * 18.0), 2.0);
                    return vec3(0.06 + checker * 0.36, 0.03 + stripes * 0.18, 0.08 + rings * 0.48);
                } else if (mode < 3.5) {
                    float laser = sin((uv.x * uv.y) * 90.0 + bpmPhase * 12.0 + chaos * 9.0) * 0.5 + 0.5;
                    return vec3(0.04 + laser * 0.56, 0.02 + swirl * 0.14, 0.09 + rings * 0.52);
                } else if (mode < 4.5) {
                    float tunnel = sin((r * 44.0 - bpmPhase * 18.0) + cos(a * 9.0) * 4.0) * 0.5 + 0.5;
                    return vec3(0.05 + tunnel * 0.52, 0.02 + grid * 0.06, 0.12 + swirl * 0.44);
                } else if (mode < 5.5) {
                    float plasma = sin((uv.x + sin(uv.y * 6.0 + bpmPhase)) * 34.0 + bpmPhase * 10.0) * 0.5 + 0.5;
                    return vec3(0.04 + plasma * 0.5, 0.03 + rings * 0.2, 0.1 + stripes * 0.46);
                } else if (mode < 6.5) {
                    float spiral = sin(a * 16.0 + bpmPhase * 6.0 + r * 24.0) * 0.5 + 0.5;
                    float lava = sin((uv.x - uv.y) * 28.0 + bpmPhase * 8.0 + chaos * 7.0) * 0.5 + 0.5;
                    return vec3(0.03 + spiral * 0.48, 0.04 + rings * 0.2, 0.1 + lava * 0.44);
                } else {
                    float noiseish = sin((uv.x * 130.0 + bpmPhase * 17.0) * sin(uv.y * 11.0 + chaos * 4.0)) * 0.5 + 0.5;
                    return vec3(0.05 + noiseish * 0.5, 0.02 + swirl * 0.18, 0.08 + rings * 0.46);
                }
            }
            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                float bpmPhase = uTime * (uBpm / 60.0);
                float acid = smoothstep(0.0, 1.0, uAcid);
                float drums = smoothstep(0.0, 1.0, uDrums);
                float chaos = clamp(uChaos, 0.0, 1.4);
                vec2 uvA = uv + vec2(sin(uv.y * 10.0 + bpmPhase * 1.8), cos(uv.x * 12.0 - bpmPhase * 1.4)) * (0.04 + acid * 0.06);
                vec2 uvB = uv + vec2(cos(uv.y * 8.0 - bpmPhase * 1.5), sin(uv.x * 7.0 + bpmPhase * 1.7)) * (0.03 + drums * 0.08);
                vec3 colA = floorMode(uMode, uvA, bpmPhase, acid, drums, chaos);
                vec3 colB = floorMode(uModeB, uvB, bpmPhase * 1.05, acid, drums, chaos);
                vec3 col = mix(colA, colB, smoothstep(0.0, 1.0, uBlend));
                float pulse = sin((uv.x + uv.y) * 8.0 + bpmPhase * 5.0) * 0.5 + 0.5;
                col += vec3(0.1, 0.03, 0.12) * pulse * (0.15 + acid * 0.4);
                col *= 0.82 + drums * 0.28;
                gl_FragColor = vec4(col, 1.0);
            }
        `,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    scene.add(floor);
    const funDeco = new THREE.Group();
    scene.add(funDeco);
    const decoMovers = [];
    for (let i = 0; i < 24; i++) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (i % 3) * 0.04, 8, 6), new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL((i * 0.13) % 1, 0.8, 0.62),
            emissive: new THREE.Color().setHSL((i * 0.13) % 1, 0.7, 0.2),
            emissiveIntensity: 1.0,
            roughness: 0.5,
            metalness: 0.08,
        }));
        const baseY = 0.08 + Math.random() * 0.7;
        orb.position.set((Math.random() * 2 - 1) * 10.5, baseY, (Math.random() * 2 - 1) * 9.5);
        const dir = new THREE.Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).normalize();
        const speed = 0.22 + Math.random() * 0.45;
        decoMovers.push({
            mesh: orb,
            baseY,
            vel: dir.multiplyScalar(speed),
            phase: Math.random() * Math.PI * 2,
            spin: new THREE.Vector3((Math.random() * 2 - 1) * 0.014, (Math.random() * 2 - 1) * 0.016, (Math.random() * 2 - 1) * 0.012),
        });
        funDeco.add(orb);
    }
    const acidHaloGroup = new THREE.Group();
    scene.add(acidHaloGroup);
    const acidHalos = [];
    const acidHaloMeta = [];
    function addHalo(r, y, z, col) {
        const halo = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 8, 24), new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.85,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.75,
        }));
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, y, z);
        acidHaloGroup.add(halo);
        acidHalos.push(halo);
        acidHaloMeta.push({
            baseY: y,
            baseR: Math.max(0.6, r * 0.68),
            phase: Math.random() * Math.PI * 2,
            speed: 0.45 + Math.random() * 0.65,
            wobble: 0.75 + Math.random() * 1.4,
        });
    }
    addHalo(3.1, 1.2, 0.4, 0xff7dd8);
    addHalo(4.25, 1.7, -2.3, 0x7cd4ff);
    function addCartoonBumpers(parent, points, hueStart) {
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const hue = (hueStart + i * 0.12) % 1;
            const bump = new THREE.Mesh(new THREE.SphereGeometry(0.17 + (i % 2) * 0.06, 10, 8), new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(hue, 0.85, 0.64),
                emissive: new THREE.Color().setHSL(hue, 0.8, 0.24),
                emissiveIntensity: 0.9,
                roughness: 0.45,
                metalness: 0.08,
            }));
            bump.position.set(p[0], p[1], p[2]);
            parent.add(bump);
        }
    }
    addCartoonBumpers(rig303, [
        [-5.0, 0.62, -2.2],
        [5.0, 0.62, -2.2],
        [-5.0, 0.62, 2.2],
        [5.0, 0.62, 2.2],
    ], 0.62);
    addCartoonBumpers(rig909, [
        [-3.7, 0.56, -2.0],
        [3.7, 0.56, -2.0],
        [-3.7, 0.56, 2.0],
        [3.7, 0.56, 2.0],
    ], 0.1);
    addCartoonBumpers(rigMixer, [
        [-2.4, 0.58, -1.3],
        [2.4, 0.58, -1.3],
        [-2.4, 0.58, 1.3],
        [2.4, 0.58, 1.3],
    ], 0.4);
    const floorRow = document.createElement("div");
    floorRow.classList.add("viz303-mixer-row");
    const floorChk = document.createElement("input");
    floorChk.type = "checkbox";
    floorChk.checked = true;
    floorChk.addEventListener("change", () => {
        floor.visible = floorChk.checked;
    });
    floorRow.append(floorChk, document.createTextNode(" Show floor"));
    visualMixer.append(floorRow);
    const decoRow = document.createElement("div");
    decoRow.classList.add("viz303-mixer-row");
    const decoChk = document.createElement("input");
    decoChk.type = "checkbox";
    decoChk.checked = true;
    decoChk.addEventListener("change", () => {
        funDeco.visible = decoChk.checked;
    });
    decoRow.append(decoChk, document.createTextNode(" Show fun deco"));
    visualMixer.append(decoRow);
    const haloRow = document.createElement("div");
    haloRow.classList.add("viz303-mixer-row");
    const haloChk = document.createElement("input");
    haloChk.type = "checkbox";
    haloChk.checked = true;
    haloChk.addEventListener("change", () => {
        acidHaloGroup.visible = haloChk.checked;
    });
    haloRow.append(haloChk, document.createTextNode(" Show acid halos"));
    visualMixer.append(haloRow);
    const trippyRow = document.createElement("div");
    trippyRow.classList.add("viz303-mixer-row");
    const trippyChk = document.createElement("input");
    trippyChk.type = "checkbox";
    trippyChk.checked = true;
    trippyChk.addEventListener("change", () => {
        trippyHardwareEnabled = trippyChk.checked;
        trippyHwBtn.textContent = `Trippy hardware: ${trippyHardwareEnabled ? "on" : "off"}`;
    });
    trippyRow.append(trippyChk, document.createTextNode(" Trippy hardware fx"));
    visualMixer.append(trippyRow);
    function toonify(root, tint, amount = 0.22) {
        const tintColor = new THREE.Color(tint);
        root.traverse((obj) => {
            const mat = obj.material;
            if (!mat || Array.isArray(mat))
                return;
            if (mat instanceof THREE.MeshStandardMaterial) {
                mat.color.lerp(tintColor, amount);
                mat.emissive.lerp(tintColor, amount * 0.16);
                mat.roughness = Math.max(mat.roughness, 0.5);
                mat.metalness = Math.min(mat.metalness, 0.18);
                mat.flatShading = true;
                mat.needsUpdate = true;
            }
        });
    }
    // Stylized cartoon look: chunkier lighting and brighter palette.
    toonify(rig303, 0x6d79ff, 0.5);
    toonify(rig909, 0xff7b5b, 0.5);
    toonify(rigMixer, 0x58d6ff, 0.42);
    toonify(speakersGroup, 0xb07bff, 0.42);
    const trippyBindings = [];
    function registerTrippyMaterials(root, baseRate, shift = 0.14) {
        root.traverse((obj) => {
            const mat = obj.material;
            if (!mat || Array.isArray(mat))
                return;
            if (mat instanceof THREE.MeshStandardMaterial) {
                trippyBindings.push({
                    mat,
                    baseColor: mat.color.clone(),
                    baseEmissive: mat.emissive.clone(),
                    rate: baseRate + Math.random() * 0.7,
                    shift,
                });
            }
        });
    }
    registerTrippyMaterials(rig303, 1.35, 0.14);
    registerTrippyMaterials(rig909, 1.1, 0.12);
    registerTrippyMaterials(rigMixer, 0.9, 0.1);
    registerTrippyMaterials(speakersGroup, 0.95, 0.1);
    const trippyOrbs = [];
    function makeTrippyOrb(parent, x, y, z, hue) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.08, 0), new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, 0.85, 0.62),
            emissive: new THREE.Color().setHSL(hue, 0.8, 0.28),
            emissiveIntensity: 1.1,
            roughness: 0.45,
            metalness: 0.06,
        }));
        m.position.set(x, y, z);
        parent.add(m);
        trippyOrbs.push({
            mesh: m,
            base: m.position.clone(),
            speed: 1.5 + Math.random() * 1.8,
            amp: 0.07 + Math.random() * 0.16,
            phase: Math.random() * Math.PI * 2,
        });
    }
    for (let i = 0; i < 8; i++) {
        makeTrippyOrb(rig303, -4.8 + i * 0.72, 0.62 + (i % 2) * 0.16, 2.15 - (i % 3) * 0.34, (i * 0.07) % 1);
    }
    for (let i = 0; i < 6; i++) {
        makeTrippyOrb(rig909, -3.2 + i * 0.66, 0.58 + (i % 3) * 0.1, 1.7 - (i % 2) * 0.3, (0.35 + i * 0.08) % 1);
    }
    function resize() {
        const w = Math.max(220, mount.clientWidth);
        const h = Math.max(200, mount.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(() => resize());
    ro.observe(mount);
    resize();
    const cam = {
        yaw: 0.18,
        pitch: 0.34,
        radius: 16.5,
        autoOrbitEnabled: true,
        autoOrbitSpeed: 0.0008,
        drag: false,
        lastX: 0,
        lastY: 0,
    };
    const target = new THREE.Vector3(-1.5, 0.5, -1.4);
    let cameraMode = "orbit";
    let trackRecording = false;
    let trackPlaying = false;
    let trackStartMs = 0;
    let trackDuration = 0;
    const cameraTrack = [];
    const hotKnobTarget = new THREE.Vector3(-1.5, 0.5, -1.4);
    const restTarget = new THREE.Vector3(-1.5, 0.5, -1.4);
    const tmpKnobWorld = new THREE.Vector3();
    let flyPulse = 0;
    let shaderMode = 0;
    let shaderModeNext = 1;
    let shaderBlend = 0;
    let shaderBarsUntilSwitch = 2;
    let floorShaderMode = 0;
    let floorShaderModeNext = 1;
    let floorShaderBlend = 0;
    let floorShaderBarsUntilSwitch = 3;
    let glitchPulse = 0;
    let downbeatBars = 0;
    const cutPasses = [
        { t: 0, yaw: -0.72, pitch: 0.44, radius: 20.4, tx: -1.4, ty: 0.6, tz: -1.8 },
        { t: 0, yaw: 0.28, pitch: 0.22, radius: 6.1, tx: 6.2, ty: 0.62, tz: 1.15 },
        { t: 0, yaw: 1.02, pitch: 0.24, radius: 6.6, tx: 6.75, ty: 0.62, tz: 0.2 },
        { t: 0, yaw: 2.35, pitch: 0.28, radius: 7.0, tx: -9.05, ty: 0.58, tz: 0.4 },
        { t: 0, yaw: 2.84, pitch: 0.24, radius: 7.4, tx: -8.45, ty: 0.6, tz: 1.2 },
        { t: 0, yaw: -1.26, pitch: 0.36, radius: 8.2, tx: -1.35, ty: 0.55, tz: -6.7 },
        { t: 0, yaw: -0.18, pitch: 0.52, radius: 19.2, tx: -1.4, ty: 0.75, tz: -1.5 },
        { t: 0, yaw: 0.62, pitch: 0.3, radius: 10.0, tx: -9.2, ty: 0.55, tz: 0.55 },
        { t: 0, yaw: -0.48, pitch: 0.26, radius: 9.5, tx: 6.3, ty: 0.58, tz: 1.05 },
    ];
    const flyPasses = [
        { t: 0.0, yaw: -0.9, pitch: 0.33, radius: 21.0, tx: -1.5, ty: 0.7, tz: -1.8 },
        { t: 0.12, yaw: 0.22, pitch: 0.22, radius: 6.4, tx: 6.45, ty: 0.66, tz: 1.15 },
        { t: 0.24, yaw: 0.48, pitch: 0.2, radius: 5.6, tx: 6.95, ty: 0.63, tz: 0.25 },
        { t: 0.36, yaw: 1.86, pitch: 0.24, radius: 6.2, tx: -9.05, ty: 0.64, tz: 0.5 },
        { t: 0.48, yaw: 2.52, pitch: 0.22, radius: 5.9, tx: -8.35, ty: 0.62, tz: 1.25 },
        { t: 0.62, yaw: -1.18, pitch: 0.3, radius: 7.4, tx: -1.4, ty: 0.58, tz: -6.8 },
        { t: 0.74, yaw: -2.1, pitch: 0.27, radius: 8.1, tx: 0.2, ty: 0.62, tz: -12.2 },
        { t: 0.88, yaw: -0.42, pitch: 0.46, radius: 18.4, tx: -1.5, ty: 0.72, tz: -1.6 },
        { t: 1.0, yaw: -0.9, pitch: 0.33, radius: 21.0, tx: -1.5, ty: 0.7, tz: -1.8 },
    ];
    let cutIndex = 0;
    function updateCamera() {
        const cp = Math.cos(cam.pitch);
        camera.position.set(Math.cos(cam.yaw) * cp * cam.radius, Math.sin(cam.pitch) * cam.radius, Math.sin(cam.yaw) * cp * cam.radius);
        camera.position.add(target);
        camera.lookAt(target);
    }
    function onPointerDown(ev) {
        var _a, _b;
        cam.drag = true;
        cam.lastX = ev.clientX;
        cam.lastY = ev.clientY;
        (_b = (_a = ev.target).setPointerCapture) === null || _b === void 0 ? void 0 : _b.call(_a, ev.pointerId);
    }
    function onPointerMove(ev) {
        if (!cam.drag)
            return;
        const dx = ev.clientX - cam.lastX;
        const dy = ev.clientY - cam.lastY;
        cam.lastX = ev.clientX;
        cam.lastY = ev.clientY;
        cam.yaw -= dx * 0.006;
        cam.pitch = Math.max(0.12, Math.min(1.18, cam.pitch - dy * 0.005));
    }
    function onPointerUp(ev) {
        var _a, _b;
        cam.drag = false;
        (_b = (_a = ev.target).releasePointerCapture) === null || _b === void 0 ? void 0 : _b.call(_a, ev.pointerId);
    }
    function onWheel(ev) {
        ev.preventDefault();
        cam.radius = Math.max(4.8, Math.min(34.0, cam.radius + ev.deltaY * 0.012));
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    let raf = 0;
    let prevStep = 0;
    let perfTick = 0;
    function frame() {
        var _a;
        perfTick++;
        const t = performance.now() * 0.001;
        const stepNow = Math.max(0, Math.min(15, Math.floor(state.clock.currentStep.value)));
        const stepEdge = stepNow !== prevStep;
        prevStep = stepNow;
        if (cameraMode === "orbit") {
            if (!cam.drag && cam.autoOrbitEnabled)
                cam.yaw += cam.autoOrbitSpeed;
        }
        else if (cameraMode === "fly") {
            const phase = (t * (state.clock.bpm.value / 60) * flyPathRate) % 1;
            let seg = 0;
            while (seg + 1 < flyPasses.length && flyPasses[seg + 1].t < phase)
                seg++;
            const a = flyPasses[seg];
            const b = flyPasses[Math.min(seg + 1, flyPasses.length - 1)];
            const span = Math.max(0.0001, b.t - a.t);
            const s = Math.min(1, Math.max(0, (phase - a.t) / span));
            const lerp = (x, y) => x + (y - x) * s;
            cam.yaw += (lerp(a.yaw, b.yaw) - cam.yaw) * flyCamSmoothing;
            cam.pitch += (lerp(a.pitch, b.pitch) - cam.pitch) * flyCamSmoothing;
            cam.radius += (lerp(a.radius, b.radius) - cam.radius) * flyCamSmoothing;
            restTarget.set(lerp(a.tx, b.tx), lerp(a.ty, b.ty), lerp(a.tz, b.tz));
        }
        else if (cameraMode === "cuts" && stepEdge && stepNow === 0) {
            cutIndex = (cutIndex + 1) % cutPasses.length;
            const pass = cutPasses[cutIndex];
            cam.yaw = pass.yaw;
            cam.pitch = pass.pitch;
            cam.radius = pass.radius;
            target.set(pass.tx, pass.ty, pass.tz);
        }
        else if (cameraMode === "track" && trackPlaying && cameraTrack.length > 1) {
            const elapsed = ((performance.now() - trackStartMs) / 1000) % trackDuration;
            let i = 0;
            while (i + 1 < cameraTrack.length && cameraTrack[i + 1].t < elapsed)
                i++;
            const a = cameraTrack[i];
            const b = cameraTrack[Math.min(i + 1, cameraTrack.length - 1)];
            const span = Math.max(0.0001, b.t - a.t);
            const s = Math.min(1, Math.max(0, (elapsed - a.t) / span));
            const lerp = (x, y) => x + (y - x) * s;
            cam.yaw = lerp(a.yaw, b.yaw);
            cam.pitch = lerp(a.pitch, b.pitch);
            cam.radius = lerp(a.radius, b.radius);
            target.set(lerp(a.tx, b.tx), lerp(a.ty, b.ty), lerp(a.tz, b.tz));
        }
        if (trackRecording) {
            const nowT = (performance.now() - trackStartMs) / 1000;
            const last = cameraTrack[cameraTrack.length - 1];
            if (!last || nowT - last.t > 0.06) {
                cameraTrack.push({
                    t: nowT,
                    yaw: cam.yaw,
                    pitch: cam.pitch,
                    radius: cam.radius,
                    tx: target.x,
                    ty: target.y,
                    tz: target.z,
                });
            }
        }
        const activeStep = stepNow;
        for (let i = 0; i < stepLeds.length; i++) {
            const mat = stepLeds[i].material;
            const on = i === activeStep;
            mat.color.copy(on ? ledOn : ledOff);
            mat.emissive.set(on ? 0x5b7f11 : 0x111700);
            mat.emissiveIntensity = on ? 2.0 : 0.24;
        }
        const beatPulse = 0.5 + 0.5 * Math.sin(t * ((state.clock.bpm.value / 60) * Math.PI));
        const tempoMat = tempoLed.material;
        tempoMat.color.setRGB(0.35 + beatPulse * 0.6, 0.11 + beatPulse * 0.15, 0.08);
        tempoMat.emissive.setRGB(0.18 + beatPulse * 0.4, 0.04, 0.03);
        tempoMat.emissiveIntensity = 0.45 + beatPulse * 1.0;
        const drumPat = state.drums.pattern.value;
        const drumStep = activeStep % 16;
        const p0 = state.notes[0].pattern.value;
        if (p0.length > 0) {
            let noteSum = 0;
            let noteCount = 0;
            let accentCount = 0;
            for (const slot of p0) {
                if (slot.note !== "-") {
                    noteSum += Number(slot.note);
                    noteCount++;
                }
                if (slot.accent)
                    accentCount++;
            }
            const avg = noteCount > 0 ? noteSum / noteCount : 40;
            tuneValue = Math.min(1, Math.max(0, (avg - 24) / 48));
            accentValue = Math.min(1, Math.max(0, accentCount / Math.max(1, p0.length)));
        }
        else {
            tuneValue = 0.5;
            accentValue = 0;
        }
        for (let lane = 0; lane < 4; lane++) {
            const arr = drumPat[lane] || [];
            const hit = Number(arr[drumStep] || 0);
            const muted = ((_a = state.drums.mutes[lane]) === null || _a === void 0 ? void 0 : _a.value) ? 1 : 0;
            const target = muted ? 0 : Math.min(1, hit / 2);
            drumLaneEnergy[lane] = drumLaneEnergy[lane] * 0.72 + target * 0.28;
            if (!muted && hit > 0)
                drumLanePunch[lane] = 1;
            else
                drumLanePunch[lane] *= 0.82;
            const lampMat = drumLaneIndicators[lane].material;
            lampMat.color.setRGB(0.3 + (drumLaneEnergy[lane] + drumLanePunch[lane] * 0.35) * 0.7, 0.1 + (drumLaneEnergy[lane] + drumLanePunch[lane] * 0.25) * 0.2, 0.05);
            lampMat.emissive.setRGB(0.12 + (drumLaneEnergy[lane] + drumLanePunch[lane] * 0.4) * 0.45, 0.04 + (drumLaneEnergy[lane] + drumLanePunch[lane] * 0.3) * 0.12, 0.02);
            lampMat.emissiveIntensity = 0.2 + (drumLaneEnergy[lane] + drumLanePunch[lane] * 0.35) * 1.8;
        }
        for (let i = 0; i < drumLeds.length; i++) {
            const mat = drumLeds[i].material;
            const on = i === drumStep;
            mat.color.set(on ? 0xff7f3a : 0x381e13);
            mat.emissive.set(on ? 0x7f2f0f : 0x1b0e06);
            mat.emissiveIntensity = on ? 1.6 : 0.25;
        }
        const acidEnergy = (norm(state.notes[0].parameters.cutoff) +
            norm(state.notes[0].parameters.resonance) +
            norm(state.notes[1].parameters.cutoff) +
            norm(state.notes[1].parameters.resonance)) /
            4;
        const drumEnergy = (drumLaneEnergy[0] + drumLaneEnergy[1] + drumLaneEnergy[2] + drumLaneEnergy[3]) / 4;
        vjUniforms.uTime.value = t;
        vjUniforms.uBpm.value = state.clock.bpm.value;
        vjUniforms.uAcid.value = acidEnergy;
        vjUniforms.uDrums.value = drumEnergy;
        const allKnobs = knobs.concat(drumKnobs);
        let hottestDelta = 0;
        for (const k of allKnobs) {
            const value01 = Math.min(1, Math.max(0, k.getValue()));
            if (k.source === "bassline") {
                k.mesh.rotation.y = -3.0 + value01 * 6.1;
            }
            else {
                k.mesh.rotation.y = -2.45 + value01 * 4.9;
            }
            const delta = Math.abs(value01 - k.prevValue);
            k.prevValue = value01;
            const weightedDelta = delta * (k.source === "bassline" ? 1.7 : 0.62);
            if (weightedDelta > hottestDelta) {
                hottestDelta = weightedDelta;
                k.mesh.getWorldPosition(tmpKnobWorld);
            }
            const deltaThreshold = k.source === "bassline" ? 0.0016 : 0.0032;
            const decay = k.source === "bassline" ? 0.91 : 0.9;
            const flashGain = k.source === "bassline" ? 1.24 : 1.08;
            if (delta > deltaThreshold)
                k.flashLevel = flashGain;
            else
                k.flashLevel *= decay;
            const flashMat = k.flash.material;
            if (k.source === "bassline") {
                const h = 0.72 + 0.08 * Math.sin(t * 2.2 + value01 * 6.0);
                flashMat.color.setHSL(h, 0.9, 0.67);
                flashMat.emissive.setHSL(h, 0.85, 0.24);
                flashMat.emissiveIntensity = 0.26 + k.flashLevel * 3.7;
                flashMat.opacity = 0.58 + k.flashLevel * 0.5;
                k.mesh.position.y = k.baseY + k.flashLevel * 0.16;
                k.mesh.rotation.x = Math.sin(t * 10.0 + value01 * 14.0) * k.flashLevel * 0.08;
                k.mesh.rotation.z = Math.cos(t * 9.5 + value01 * 11.0) * k.flashLevel * 0.06;
            }
            else {
                const h = 0.05 + 0.04 * Math.sin(t * 2.0 + value01 * 5.0);
                flashMat.color.setHSL(h, 0.95, 0.63);
                flashMat.emissive.setHSL(h, 0.9, 0.2);
                flashMat.emissiveIntensity = 0.14 + k.flashLevel * 2.15;
                flashMat.opacity = 0.44 + k.flashLevel * 0.38;
                k.mesh.position.y = k.baseY + k.flashLevel * 0.11;
                k.mesh.rotation.x = Math.sin(t * 8.4 + value01 * 10.0) * k.flashLevel * 0.065;
                k.mesh.rotation.z = Math.cos(t * 7.6 + value01 * 9.0) * k.flashLevel * 0.05;
            }
        }
        if (hottestDelta > 0.0015) {
            hotKnobTarget.lerp(tmpKnobWorld, 0.08 + flyFocusPull * 0.14);
        }
        else {
            hotKnobTarget.lerp(restTarget, 0.012);
        }
        flyPulse = flyPulse * 0.9 + Math.min(1.6, hottestDelta * 54);
        if (stepEdge && stepNow === 0) {
            downbeatBars++;
            if (shaderCycleEnabled) {
                shaderBarsUntilSwitch--;
                if (shaderBarsUntilSwitch <= 0) {
                    shaderMode = shaderModeNext;
                    let pick = shaderModeNext;
                    const maxModes = 16;
                    let guard = 0;
                    while ((pick === shaderMode || pick === shaderModeNext) && guard < 12) {
                        pick = Math.floor(Math.random() * maxModes);
                        guard++;
                    }
                    shaderModeNext = pick;
                    shaderBlend = 0;
                    shaderBarsUntilSwitch = 1 + Math.floor(Math.random() * 3);
                }
                floorShaderBarsUntilSwitch--;
                if (floorShaderBarsUntilSwitch <= 0) {
                    floorShaderMode = floorShaderModeNext;
                    let floorPick = floorShaderModeNext;
                    const floorMaxModes = 7;
                    let floorGuard = 0;
                    while ((floorPick === floorShaderMode || floorPick === floorShaderModeNext) && floorGuard < 12) {
                        floorPick = Math.floor(Math.random() * floorMaxModes);
                        floorGuard++;
                    }
                    floorShaderModeNext = floorPick;
                    floorShaderBlend = 0;
                    floorShaderBarsUntilSwitch = 2 + Math.floor(Math.random() * 4);
                }
            }
            glitchPulse = Math.min(1, glitchPulse + 0.45);
        }
        if (cameraMode === "fly") {
            const phase = t * ((state.clock.bpm.value / 60) * (0.16 + flyPathRate * 0.9));
            target.lerp(restTarget, 0.06 + flyCamSmoothing * 0.12);
            target.lerp(hotKnobTarget, 0.025 + flyFocusPull * 0.09 + Math.min(0.035, hottestDelta * 1.2));
            target.y += 0.003 + Math.sin(phase * 2.0) * 0.003;
            const desiredPitch = 0.22 + flyPulse * 0.03;
            cam.pitch = Math.max(0.14, Math.min(0.88, cam.pitch + (desiredPitch - cam.pitch) * (0.02 + flyCamSmoothing * 0.08)));
        }
        const acidCrazy = 0.42 + acidEnergy * 0.82 + Math.min(0.62, hottestDelta * 2.5);
        const groove = 0.5 + 0.5 * Math.sin(t * 3.2 + state.clock.bpm.value * 0.01);
        const drumHitPulse = Math.max(drumLanePunch[0], drumLanePunch[1], drumLanePunch[2], drumLanePunch[3]) * 0.85 +
            drumEnergy * 0.55;
        // Exaggerated cartoon motion pass.
        rig303.position.y = rig303BaseY + (0.05 + acidCrazy * 0.14) * Math.sin(t * 2.9);
        rig909.position.y = rig909BaseY + (0.035 + drumEnergy * 0.1) * Math.sin(t * 2.5 + 1.2);
        rigMixer.position.y = rigMixerBaseY + (0.02 + acidCrazy * 0.025) * Math.sin(t * 2.0 + 0.6);
        speakersGroup.position.y = speakersBaseY + (0.05 + acidCrazy * 0.04) * Math.sin(t * 2.6 + 0.9);
        rig303.rotation.z = Math.sin(t * 2.2) * (0.03 + acidCrazy * 0.04);
        rig909.rotation.z = Math.sin(t * 2.1 + 0.8) * (0.02 + acidCrazy * 0.03);
        rigMixer.rotation.z = Math.sin(t * 1.7 + 0.4) * (0.012 + acidCrazy * 0.018);
        const squish303 = 1 + Math.sin(t * 2.5) * (0.035 + acidEnergy * 0.05);
        rig303.scale.set(1.12 / squish303, 1.2 * squish303, 1.12 / squish303);
        const squish909 = 1 + Math.sin(t * 2.1 + 0.8) * (0.03 + drumEnergy * 0.045);
        rig909.scale.set(1.08 / squish909, 1.14 * squish909, 1.08 / squish909);
        const squishMix = 1 + Math.sin(t * 1.8 + 1.3) * 0.025;
        rigMixer.scale.set(1.12, 1.12 * squishMix, 1.08);
        speakersGroup.rotation.z = Math.sin(t * 1.3 + drumEnergy * 2.0) * 0.045;
        for (const w of speakerWoofers) {
            w.scale.setScalar(1 + (drumEnergy * 0.06 + groove * 0.025));
        }
        for (const tw of speakerTweeters) {
            tw.scale.setScalar(1 + acidEnergy * 0.04);
        }
        const fxBoundsX = 8.5 + acidFxSpread * 5.5;
        const fxBoundsZ = 7.5 + acidFxSpread * 4.8;
        for (let i = 0; i < decoMovers.length; i++) {
            const d = decoMovers[i];
            const moveStep = 0.01 * acidFxRoamSpeed * (0.85 + drumEnergy * 0.35);
            d.mesh.position.x += d.vel.x * moveStep;
            d.mesh.position.z += d.vel.z * moveStep;
            if (Math.abs(d.mesh.position.x) > fxBoundsX) {
                d.vel.x *= -1;
                d.mesh.position.x = Math.max(-fxBoundsX, Math.min(fxBoundsX, d.mesh.position.x));
            }
            if (Math.abs(d.mesh.position.z) > fxBoundsZ) {
                d.vel.z *= -1;
                d.mesh.position.z = Math.max(-fxBoundsZ, Math.min(fxBoundsZ, d.mesh.position.z));
            }
            if (stepEdge && stepNow % 4 === 0) {
                d.vel.x += (Math.random() * 2 - 1) * 0.32 * acidFxHit;
                d.vel.z += (Math.random() * 2 - 1) * 0.32 * acidFxHit;
                const sp = Math.hypot(d.vel.x, d.vel.z);
                const maxSp = 1.5 + acidFxRoamSpeed * 1.2;
                if (sp > maxSp && sp > 0.0001) {
                    d.vel.multiplyScalar(maxSp / sp);
                }
            }
            d.mesh.position.y =
                d.baseY + Math.sin(t * (1.7 + d.phase) + d.phase) * (0.12 + acidFxHit * 0.16) + drumHitPulse * 0.2 * acidFxHit;
            d.mesh.scale.setScalar(acidFxSize * (0.8 + drumHitPulse * 0.24));
            d.mesh.rotation.x += d.spin.x * (0.7 + acidFxRoamSpeed * 0.5);
            d.mesh.rotation.y += d.spin.y * (0.7 + acidFxRoamSpeed * 0.5);
            d.mesh.rotation.z += d.spin.z * (0.7 + acidFxRoamSpeed * 0.5);
        }
        acidHaloGroup.scale.setScalar(acidFxSize * (0.9 + drumHitPulse * 0.2));
        if (perfTick % 2 === 0) {
            for (let i = 0; i < acidHalos.length; i++) {
                const h = acidHalos[i];
                const m = acidHaloMeta[i];
                const ang = t * (0.2 + m.speed * 0.22) + m.phase;
                const driftR = m.baseR * acidFxSpread;
                h.position.x = Math.cos(ang) * driftR;
                h.position.z = Math.sin(ang) * driftR;
                h.position.y = m.baseY + Math.sin(t * 0.9 + m.phase) * 0.2 * m.wobble + drumHitPulse * 0.12;
                h.rotation.z += 0.004 + i * 0.0008 + acidEnergy * 0.003;
                h.rotation.y += 0.003 + drumEnergy * 0.002;
                const pulse = 1 + Math.sin(t * (1.0 + i * 0.2) + i) * (0.06 + acidEnergy * 0.08) + drumHitPulse * 0.12 * acidFxHit;
                h.scale.setScalar(pulse);
                const hm = h.material;
                hm.emissiveIntensity = 0.55 + acidEnergy * 0.8 + drumEnergy * 0.4;
                hm.opacity = 0.5 + acidEnergy * 0.2;
            }
        }
        cablePulse = Math.sin(t * 4.2 + acidEnergy * 6.0) * (0.12 + acidCrazy * 0.2);
        if (perfTick % 2 === 0) {
            const cableHue = 0.08 + Math.sin(t * 1.5 + acidEnergy * 4.0) * 0.08;
            for (const c of patchCables) {
                const lm = c.line.material;
                lm.color.setHSL(cableHue, 0.95, 0.64);
                lm.opacity = 0.45 + acidCrazy * 0.35;
            }
        }
        if (trippyHardwareEnabled) {
            if (perfTick % 2 === 0) {
                for (let i = 0; i < trippyBindings.length; i++) {
                    const b = trippyBindings[i];
                    const wobble = Math.sin(t * b.rate + i * 0.4 + acidEnergy * 2.2 + drumEnergy * 1.2);
                    b.mat.color.copy(b.baseColor).offsetHSL(wobble * b.shift, 0.06, 0.05);
                    b.mat.emissive.copy(b.baseEmissive).offsetHSL(wobble * (b.shift * 0.6), 0.08, 0.07);
                    b.mat.emissiveIntensity = 0.35 + 0.6 * (0.5 + 0.5 * wobble);
                }
                for (let i = 0; i < trippyOrbs.length; i++) {
                    const o = trippyOrbs[i];
                    const wobble = t * o.speed + o.phase;
                    const roam = acidFxSpread * 0.2;
                    o.mesh.position.set(o.base.x + Math.cos(wobble * 0.8) * o.amp * acidFxSpread + Math.sin(wobble * 0.17 + i) * roam, o.base.y + Math.sin(wobble) * o.amp * (1.2 + acidFxHit * 0.6), o.base.z + Math.sin(wobble * 0.6) * o.amp * acidFxSpread + Math.cos(wobble * 0.19 + i) * roam);
                    o.mesh.scale.setScalar(acidFxSize * (0.72 + drumHitPulse * 0.22 * acidFxHit));
                    o.mesh.rotation.x += 0.01 + acidEnergy * 0.012;
                    o.mesh.rotation.y += 0.015 + drumEnergy * 0.012;
                    const m = o.mesh.material;
                    m.emissiveIntensity = 0.5 + acidEnergy * 0.7 + (Math.sin(wobble * 1.8) * 0.5 + 0.5) * 0.4;
                }
            }
        }
        else {
            for (const b of trippyBindings) {
                b.mat.color.copy(b.baseColor);
                b.mat.emissive.copy(b.baseEmissive);
                b.mat.emissiveIntensity = 0.24;
            }
            for (const o of trippyOrbs) {
                o.mesh.position.copy(o.base);
                o.mesh.scale.setScalar(acidFxSize * 0.72);
                o.mesh.material.emissiveIntensity = 0.35;
            }
        }
        shaderBlend = Math.min(1, shaderBlend + 0.012 + drumEnergy * 0.02 + acidEnergy * 0.012);
        floorShaderBlend = Math.min(1, floorShaderBlend + 0.01 + acidEnergy * 0.016 + drumEnergy * 0.01);
        glitchPulse = glitchPulse * 0.9 + (drumEnergy + acidEnergy) * 0.035;
        vjUniforms.uMode.value = shaderMode;
        vjUniforms.uModeB.value = shaderModeNext;
        vjUniforms.uBlend.value = shaderBlend;
        vjUniforms.uGlitch.value = Math.min(1, glitchPulse);
        vjUniforms.uChaos.value = Math.min(1.25, acidCrazy + hottestDelta * 1.2);
        floorUniforms.uTime.value = t;
        floorUniforms.uBpm.value = state.clock.bpm.value;
        floorUniforms.uAcid.value = acidEnergy;
        floorUniforms.uDrums.value = drumEnergy;
        floorUniforms.uMode.value = floorShaderMode;
        floorUniforms.uModeB.value = floorShaderModeNext;
        floorUniforms.uBlend.value = floorShaderBlend;
        floorUniforms.uChaos.value = Math.min(1.35, acidCrazy + drumEnergy * 0.75 + hottestDelta * 1.5);
        if (vjMotionEnabled) {
            vjGroup.rotation.y = t * 0.05 + flyPulse * 0.08;
            const sidePulse = 0.85 + 0.35 * Math.sin(t * 0.9 + vjUniforms.uAcid.value * 5.0);
            vjLeft.scale.y = sidePulse;
            vjRight.scale.y = sidePulse;
        }
        else {
            vjLeft.scale.y = 1;
            vjRight.scale.y = 1;
        }
        for (const c of patchCables)
            setCableGeometry(c);
        updateCamera();
        renderer.render(scene, camera);
        raf = window.requestAnimationFrame(frame);
    }
    raf = window.requestAnimationFrame(frame);
    window.addEventListener("beforeunload", () => {
        window.cancelAnimationFrame(raf);
        stopRecording();
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointerleave", onPointerUp);
        renderer.domElement.removeEventListener("wheel", onWheel);
        renderer.dispose();
    });
    return wrap;
}
//# sourceMappingURL=viz-303.js.map