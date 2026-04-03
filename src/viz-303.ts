import * as THREE from "three";
import lamejs from "lamejs";
import type { NumericParameter, ProgramState } from "./interface.js";

type KnobBinding = {
    mesh: THREE.Group;
    flash: THREE.Mesh;
    getValue: () => number;
    baseY: number;
    source: "bassline" | "drums";
    prevValue: number;
    flashLevel: number;
};

type PatchCable = {
    line: THREE.Line;
    a: THREE.Object3D;
    b: THREE.Object3D;
    lift: number;
};

type TrippyMaterialBinding = {
    mat: THREE.MeshStandardMaterial;
    baseColor: THREE.Color;
    baseEmissive: THREE.Color;
    rate: number;
    shift: number;
};

type TrippyOrb = {
    mesh: THREE.Mesh;
    base: THREE.Vector3;
    speed: number;
    amp: number;
    phase: number;
};

type CamKeyframe = {
    t: number;
    yaw: number;
    pitch: number;
    radius: number;
    tx: number;
    ty: number;
    tz: number;
};

function norm(p: NumericParameter): number {
    const [lo, hi] = p.bounds;
    const span = hi - lo;
    if (span <= 0) return 0;
    const t = (p.value - lo) / span;
    return Math.min(1, Math.max(0, t));
}

function makeKnob(
    x: number,
    z: number,
    color: THREE.ColorRepresentation = 0x262a30
): { root: THREE.Group; flash: THREE.Mesh } {
    const root = new THREE.Group();
    root.position.set(x, 0.31, z);

    const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.43, 0.18, 24),
        new THREE.MeshStandardMaterial({
            color: 0x17192a,
            roughness: 0.62,
            metalness: 0.06,
        })
    );
    skirt.position.y = 0.03;
    root.add(skirt);

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.33, 0.35, 0.24, 24),
        new THREE.MeshStandardMaterial({
            color,
            roughness: 0.5,
            metalness: 0.18,
        })
    );
    body.position.y = 0.16;
    root.add(body);

    const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.045, 0.24),
        new THREE.MeshStandardMaterial({
            color: 0xfce9b5,
            roughness: 0.42,
            metalness: 0.08,
        })
    );
    marker.position.set(0, 0.28, 0.11);
    root.add(marker);

    const flash = new THREE.Mesh(
        new THREE.TorusGeometry(0.46, 0.055, 10, 28),
        new THREE.MeshStandardMaterial({
            color: 0x9c6cff,
            emissive: 0x2e0f66,
            emissiveIntensity: 0.0,
            roughness: 0.58,
            metalness: 0.12,
            transparent: true,
            opacity: 0.88,
        })
    );
    flash.rotation.x = Math.PI / 2;
    flash.position.y = 0.03;
    root.add(flash);

    return { root, flash };
}

function panelTexture(): THREE.CanvasTexture {
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

    const sec = (x: number, y: number, ww: number, hh: number) => {
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

function drumPanelTexture(): THREE.CanvasTexture {
    const w = 1600;
    const h = 900;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) return new THREE.CanvasTexture(c);

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

function mixerPanelTexture(): THREE.CanvasTexture {
    const w = 1400;
    const h = 760;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) return new THREE.CanvasTexture(c);
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

function speakerGrilleTexture(): THREE.CanvasTexture {
    const w = 512;
    const h = 900;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) return new THREE.CanvasTexture(c);
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

export function Acid303Visual(state: ProgramState, analyser: AnalyserNode): HTMLElement {
    const wrap = document.createElement("div");
    wrap.classList.add("viz303-panel");

    const title = document.createElement("div");
    title.classList.add("sync-panel-title");
    title.innerText = "303 + 909 Visual";
    const hint = document.createElement("div");
    hint.classList.add("sync-hint");
    hint.innerText =
        "Drag to orbit, mouse wheel to zoom. Use mixer rows to toggle rigs, move X/Z, and adjust yaw. VJ shader cycles and patch cables react to scene movement.";

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
    ] as const) {
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
    vjMotionBtn.textContent = "VJ walls motion: on";
    const trippyHwBtn = document.createElement("button");
    trippyHwBtn.type = "button";
    trippyHwBtn.classList.add("viz303-rec-btn");
    trippyHwBtn.textContent = "Trippy hardware: on";
    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.classList.add("viz303-rec-btn");
    fullscreenBtn.textContent = "Fullscreen";
    const sizeSlider = document.createElement("input");
    sizeSlider.type = "range";
    sizeSlider.min = "220";
    sizeSlider.max = "760";
    sizeSlider.value = "320";
    sizeSlider.classList.add("viz303-orbit-speed");
    sizeSlider.title = "Visual height";

    actions.append(
        recBtn,
        orbitToggle,
        orbitSpeed,
        camMode,
        trackRecBtn,
        vjToggle,
        shaderCycleBtn,
        vjMotionBtn,
        trippyHwBtn,
        fullscreenBtn,
        sizeSlider,
        resetCam,
        recStatus
    );
    const visualMixer = document.createElement("div");
    visualMixer.classList.add("viz303-mixer");
    wrap.append(title, hint, actions, visualMixer, mount);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b10);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.append(renderer.domElement);

    let recorder: MediaRecorder | null = null;
    let recChunks: Blob[] = [];
    let audioTapDest: MediaStreamAudioDestinationNode | null = null;
    let chosenVideoMime = "";
    let recordingAudioNode: ScriptProcessorNode | null = null;
    let recordingMuteGain: GainNode | null = null;
    let mp3Encoder: {
        encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
        flush(): Int8Array;
    } | null = null;
    let mp3Chunks: Int8Array[] = [];
    let mp3Leftover: Int16Array = new Int16Array(0);

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
            if (MediaRecorder.isTypeSupported(c)) return c;
        }
        return "";
    }

    function stopRecording() {
        if (!recorder) return;
        const active = recorder;
        recorder = null;
        active.stop();
        if (recordingAudioNode) {
            try {
                recordingAudioNode.disconnect();
            } catch {}
            recordingAudioNode.onaudioprocess = null;
            recordingAudioNode = null;
        }
        if (recordingMuteGain) {
            try {
                recordingMuteGain.disconnect();
            } catch {}
            recordingMuteGain = null;
        }
        if (mp3Encoder) {
            const flush = mp3Encoder.flush();
            if (flush.length > 0) mp3Chunks.push(new Int8Array(flush));
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
            const audioCtx = analyser.context as AudioContext;
            audioTapDest = audioCtx.createMediaStreamDestination();
            try {
                // Tap post-master analyser output so recording matches what you hear.
                if (audioTapDest) {
                    analyser.connect(audioTapDest);
                }
            } catch {
                // Keep video-only recording if audio tap fails.
            }
        }
        const out = new MediaStream();
        for (const t of canvasStream.getVideoTracks()) out.addTrack(t);
        if (audioTapDest) {
            for (const t of audioTapDest.stream.getAudioTracks()) out.addTrack(t);
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
        recordingAudioNode = (analyser.context as AudioContext).createScriptProcessor(
            2048,
            2,
            1
        );
        recordingMuteGain = (analyser.context as AudioContext).createGain();
        recordingMuteGain.gain.value = 0;
        recordingAudioNode.onaudioprocess = (ev: AudioProcessingEvent) => {
            if (!mp3Encoder) return;
            const inBuf = ev.inputBuffer;
            const ch0 = inBuf.getChannelData(0);
            const ch1 =
                inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : inBuf.getChannelData(0);
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
                const mp3buf = mp3Encoder.encodeBuffer(chunk as unknown as Int16Array);
                if (mp3buf.length > 0) mp3Chunks.push(new Int8Array(mp3buf));
                idx += frame;
            }
            mp3Leftover = combo.subarray(idx);
        };
        analyser.connect(recordingAudioNode);
        recordingAudioNode.connect(recordingMuteGain);
        recordingMuteGain.connect((analyser.context as AudioContext).destination);

        recChunks = [];
        recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) recChunks.push(ev.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(recChunks, {
                type: chosenVideoMime || recorder?.mimeType || "video/webm",
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
        if (recorder) stopRecording();
        else startRecording();
    });
    camMode.addEventListener("change", () => {
        const v = camMode.value as "manual" | "orbit" | "fly" | "cuts" | "track";
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
    resetCam.addEventListener("click", () => {
        cam.yaw = 0.18;
        cam.pitch = 0.34;
        cam.radius = 12.2;
        target.set(-1.1, 0.35, 0);
    });
    sizeSlider.addEventListener("input", () => {
        const px = parseInt(sizeSlider.value, 10);
        if (Number.isFinite(px)) {
            mount.style.height = `${Math.max(220, Math.min(760, px))}px`;
            resize();
        }
    });
    fullscreenBtn.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement === mount) {
                await document.exitFullscreen();
                fullscreenBtn.textContent = "Fullscreen";
            } else {
                await mount.requestFullscreen();
                fullscreenBtn.textContent = "Exit fullscreen";
                resize();
            }
        } catch {
            recStatus.textContent = "fullscreen unavailable";
        }
    });
    vjToggle.addEventListener("click", () => {
        vjGroup.visible = !vjGroup.visible;
        vjToggle.textContent = `VJ FX: ${vjGroup.visible ? "on" : "off"}`;
    });
    let shaderCycleEnabled = true;
    let vjMotionEnabled = true;
    let trippyHardwareEnabled = true;
    shaderCycleBtn.addEventListener("click", () => {
        shaderCycleEnabled = !shaderCycleEnabled;
        shaderCycleBtn.textContent = `Shader cycle: ${shaderCycleEnabled ? "on" : "off"}`;
    });
    vjMotionBtn.addEventListener("click", () => {
        vjMotionEnabled = !vjMotionEnabled;
        vjMotionBtn.textContent = `VJ walls motion: ${vjMotionEnabled ? "on" : "off"}`;
    });
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
        } else {
            trackRecording = false;
            trackRecBtn.textContent = "Record cam track";
            if (cameraTrack.length >= 2) {
                trackDuration = Math.max(
                    0.001,
                    cameraTrack[cameraTrack.length - 1].t - cameraTrack[0].t
                );
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
                float alpha = 0.16 + 0.35 * (ring * 0.45 + stripes * 0.55) + drumPunch * 0.3 + uGlitch * 0.09;
                gl_FragColor = vec4(col, alpha);
            }
        `,
    });
    const vjGroup = new THREE.Group();
    scene.add(vjGroup);
    const vjScreen = new THREE.Mesh(new THREE.PlaneGeometry(34, 13), vjMat);
    vjScreen.position.set(0, 5.6, -10);
    vjGroup.add(vjScreen);
    const vjBack = new THREE.Mesh(new THREE.PlaneGeometry(34, 13), vjMat);
    vjBack.position.set(0, 5.6, 10);
    vjBack.rotation.y = Math.PI;
    vjGroup.add(vjBack);
    const vjLeft = new THREE.Mesh(new THREE.PlaneGeometry(20, 9), vjMat);
    vjLeft.position.set(-13, 4.2, 0);
    vjLeft.rotation.y = Math.PI / 2;
    vjGroup.add(vjLeft);
    const vjRight = new THREE.Mesh(new THREE.PlaneGeometry(20, 9), vjMat);
    vjRight.position.set(13, 4.2, 0);
    vjRight.rotation.y = -Math.PI / 2;
    vjGroup.add(vjRight);
    const vjCeiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), vjMat);
    vjCeiling.position.set(0, 10.5, 0);
    vjCeiling.rotation.x = Math.PI / 2;
    vjGroup.add(vjCeiling);

    const rig303 = new THREE.Group();
    rig303.position.set(3.5, 0, 0.1);
    rig303.rotation.y = -0.15;
    const rig303BaseY = rig303.position.y;
    rig303.scale.set(1.12, 1.2, 1.12);
    scene.add(rig303);
    const rig = rig303;

    const bodyBase = new THREE.Mesh(
        new THREE.BoxGeometry(11.3, 0.85, 5.9),
        new THREE.MeshStandardMaterial({
            color: 0x262931,
            roughness: 0.78,
            metalness: 0.2,
        })
    );
    bodyBase.position.y = -0.12;
    rig.add(bodyBase);

    const upperShell = new THREE.Mesh(
        new THREE.BoxGeometry(11.05, 0.42, 5.25),
        new THREE.MeshStandardMaterial({
            color: 0x40454f,
            roughness: 0.62,
            metalness: 0.28,
        })
    );
    upperShell.position.y = 0.16;
    rig.add(upperShell);

    const panelTop = new THREE.Mesh(
        new THREE.PlaneGeometry(10.55, 4.95),
        new THREE.MeshStandardMaterial({
            map: panelTexture(),
            roughness: 0.48,
            metalness: 0.35,
        })
    );
    panelTop.rotation.x = -Math.PI / 2;
    panelTop.position.y = 0.38;
    rig.add(panelTop);

    const frontLip = new THREE.Mesh(
        new THREE.BoxGeometry(11.15, 0.36, 0.24),
        new THREE.MeshStandardMaterial({
            color: 0x1a1c22,
            roughness: 0.7,
            metalness: 0.18,
        })
    );
    frontLip.position.set(0, 0.04, 2.95);
    rig.add(frontLip);

    const sideLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.78, 5.5),
        new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.85, metalness: 0.1 })
    );
    sideLeft.position.set(-5.67, -0.03, 0);
    rig.add(sideLeft);
    const sideRight = sideLeft.clone();
    sideRight.position.x = 5.67;
    rig.add(sideRight);
    const wingL = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.7, 4),
        new THREE.MeshStandardMaterial({ color: 0x5b62ff, roughness: 0.55, metalness: 0.08 })
    );
    wingL.rotation.z = Math.PI / 2;
    wingL.position.set(-5.82, 0.18, -1.9);
    rig.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 5.82;
    wingR.rotation.z = -Math.PI / 2;
    rig.add(wingR);
    const neonStrip = new THREE.Mesh(
        new THREE.BoxGeometry(10.2, 0.07, 0.09),
        new THREE.MeshStandardMaterial({
            color: 0xa67cff,
            emissive: 0x3d1870,
            emissiveIntensity: 1.5,
            roughness: 0.4,
            metalness: 0.08,
        })
    );
    neonStrip.position.set(0, 0.52, 2.06);
    rig.add(neonStrip);

    let tuneValue = 0.5;
    let accentValue = 0;
    const knobs: KnobBinding[] = [];
    const knobsLayout: Array<{ x: number; z: number; getValue: () => number }> = [
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

    const stepLeds: THREE.Mesh[] = [];
    const ledOff = new THREE.Color(0x2a3a1e);
    const ledOn = new THREE.Color(0xc6ff53);
    const ledGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 18);
    for (let i = 0; i < 16; i++) {
        const m = new THREE.Mesh(
            ledGeo,
            new THREE.MeshStandardMaterial({
                color: ledOff,
                emissive: 0x101800,
                emissiveIntensity: 0.35,
                roughness: 0.33,
                metalness: 0.18,
            })
        );
        m.rotation.x = Math.PI / 2;
        m.position.set(-4.2 + i * 0.56, 0.43, 1.05);
        rig.add(m);
        stepLeds.push(m);
    }

    const tempoLed = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 14, 12),
        new THREE.MeshStandardMaterial({
            color: 0x441111,
            emissive: 0x140000,
            emissiveIntensity: 0.4,
            roughness: 0.35,
            metalness: 0.18,
        })
    );
    tempoLed.position.set(4.75, 0.42, 0.86);
    rig.add(tempoLed);

    for (const p of [
        [-5.1, -2.25],
        [5.1, -2.25],
        [-5.1, 2.25],
        [5.1, 2.25],
    ]) {
        const screw = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16),
            new THREE.MeshStandardMaterial({
                color: 0x93969a,
                roughness: 0.5,
                metalness: 0.6,
            })
        );
        screw.rotation.x = Math.PI / 2;
        screw.position.set(p[0], 0.44, p[1]);
        rig.add(screw);
    }

    const rig909 = new THREE.Group();
    rig909.position.set(-6.8, -0.02, -0.4);
    rig909.rotation.y = 0.22;
    const rig909BaseY = rig909.position.y;
    rig909.scale.set(1.08, 1.14, 1.08);
    scene.add(rig909);

    const drumBody = new THREE.Mesh(
        new THREE.BoxGeometry(8.4, 0.78, 5.0),
        new THREE.MeshStandardMaterial({
            color: 0x2b2f36,
            roughness: 0.78,
            metalness: 0.2,
        })
    );
    drumBody.position.y = -0.11;
    rig909.add(drumBody);
    const drumTop = new THREE.Mesh(
        new THREE.PlaneGeometry(8.0, 4.6),
        new THREE.MeshStandardMaterial({
            map: drumPanelTexture(),
            roughness: 0.45,
            metalness: 0.34,
        })
    );
    drumTop.rotation.x = -Math.PI / 2;
    drumTop.position.y = 0.34;
    rig909.add(drumTop);
    for (let i = 0; i < 8; i++) {
        const pad = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.08, 0.36),
            new THREE.MeshStandardMaterial({
                color: i % 2 ? 0xffa46e : 0x8bc8ff,
                emissive: i % 2 ? 0x4c1d0a : 0x163b52,
                emissiveIntensity: 0.8,
                roughness: 0.48,
                metalness: 0.08,
            })
        );
        pad.position.set(-2.6 + i * 0.74, 0.4, 1.7);
        rig909.add(pad);
    }

    const drumLeds: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
        const m = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16),
            new THREE.MeshStandardMaterial({
                color: 0x381e13,
                emissive: 0x1b0e06,
                emissiveIntensity: 0.3,
                roughness: 0.33,
                metalness: 0.16,
            })
        );
        m.rotation.x = Math.PI / 2;
        m.position.set(-2.95 + i * 0.39, 0.39, 0.53);
        rig909.add(m);
        drumLeds.push(m);
    }

    const drumLaneIndicators: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const lamp = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 12, 10),
            new THREE.MeshStandardMaterial({
                color: 0x222222,
                emissive: 0x080808,
                emissiveIntensity: 0.2,
                roughness: 0.35,
                metalness: 0.25,
            })
        );
        lamp.position.set(-3.25, 0.39, 1.28 + i * 0.36);
        rig909.add(lamp);
        drumLaneIndicators.push(lamp);
    }

    const drumLaneEnergy = [0, 0, 0, 0];
    const drumKnobs: KnobBinding[] = [];
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
            getValue: () => drumLaneEnergy[i],
            baseY: knob.root.position.y,
            source: "drums",
            prevValue: 0,
            flashLevel: 0,
        });
    }

    const rigMixer = new THREE.Group();
    rigMixer.position.set(-1.7, -0.04, -4.3);
    rigMixer.rotation.y = 0.08;
    const rigMixerBaseY = rigMixer.position.y;
    rigMixer.scale.set(1.12, 1.12, 1.08);
    scene.add(rigMixer);
    const mixerBody = new THREE.Mesh(
        new THREE.BoxGeometry(5.8, 0.66, 3.3),
        new THREE.MeshStandardMaterial({ color: 0x20252d, roughness: 0.72, metalness: 0.25 })
    );
    mixerBody.position.y = 0.02;
    rigMixer.add(mixerBody);
    const mixerTop = new THREE.Mesh(
        new THREE.PlaneGeometry(5.5, 3.0),
        new THREE.MeshStandardMaterial({
            map: mixerPanelTexture(),
            roughness: 0.42,
            metalness: 0.36,
        })
    );
    mixerTop.rotation.x = -Math.PI / 2;
    mixerTop.position.y = 0.36;
    rigMixer.add(mixerTop);
    const mixerPorts: THREE.Object3D[] = [];
    const mixerMasterPort = new THREE.Object3D();
    mixerMasterPort.position.set(2.35, 0.47, 0.0);
    rigMixer.add(mixerMasterPort);
    for (let i = 0; i < 6; i++) {
        const x = -2.2 + i * 0.88;
        const faderTrack = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.02, 1.5),
            new THREE.MeshStandardMaterial({ color: 0x181b21, roughness: 0.55, metalness: 0.2 })
        );
        faderTrack.position.set(x, 0.37, 0.25);
        rigMixer.add(faderTrack);
        const fader = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.08, 0.18),
            new THREE.MeshStandardMaterial({ color: 0xb7bdc8, roughness: 0.3, metalness: 0.65 })
        );
        fader.position.set(x, 0.44, 0.2);
        rigMixer.add(fader);
        const inputPort = new THREE.Object3D();
        inputPort.position.set(x, 0.47, -1.25);
        rigMixer.add(inputPort);
        mixerPorts.push(inputPort);
        const channelKnob = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.06, 18),
            new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.45, metalness: 0.35 })
        );
        channelKnob.position.set(x, 0.43, -0.72);
        rigMixer.add(channelKnob);
    }
    const mixerSideL = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.54, 3.0),
        new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.76, metalness: 0.16 })
    );
    mixerSideL.position.set(-2.9, 0.07, 0.0);
    rigMixer.add(mixerSideL);
    const mixerSideR = mixerSideL.clone();
    mixerSideR.position.x = 2.9;
    rigMixer.add(mixerSideR);
    const speakersGroup = new THREE.Group();
    speakersGroup.position.set(0.2, 0, -8.6);
    const speakersBaseY = speakersGroup.position.y;
    speakersGroup.scale.set(1.14, 1.14, 1.1);
    scene.add(speakersGroup);
    const speakerWoofers: THREE.Mesh[] = [];
    const speakerTweeters: THREE.Mesh[] = [];
    function makeSpeaker(x: number) {
        const g = new THREE.Group();
        g.position.set(x, 0, 0);
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(2.1, 3.8, 1.8),
            new THREE.MeshStandardMaterial({ color: 0x13161c, roughness: 0.86, metalness: 0.12 })
        );
        box.position.y = 1.35;
        g.add(box);
        const baffle = new THREE.Mesh(
            new THREE.PlaneGeometry(1.9, 3.5),
            new THREE.MeshStandardMaterial({
                map: speakerGrilleTexture(),
                roughness: 0.58,
                metalness: 0.12,
            })
        );
        baffle.position.set(0, 1.35, 0.92);
        g.add(baffle);
        const woofer = new THREE.Mesh(
            new THREE.CylinderGeometry(0.56, 0.56, 0.22, 28),
            new THREE.MeshStandardMaterial({ color: 0x242932, roughness: 0.34, metalness: 0.44 })
        );
        woofer.rotation.x = Math.PI / 2;
        woofer.position.set(0, 1.05, 0.95);
        g.add(woofer);
        speakerWoofers.push(woofer);
        const tweeter = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.24, 0.14, 24),
            new THREE.MeshStandardMaterial({ color: 0x2f3440, roughness: 0.3, metalness: 0.42 })
        );
        tweeter.rotation.x = Math.PI / 2;
        tweeter.position.set(0, 2.22, 0.96);
        g.add(tweeter);
        speakerTweeters.push(tweeter);
        const footL = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.08, 0.28),
            new THREE.MeshStandardMaterial({ color: 0x090b10, roughness: 0.8, metalness: 0.15 })
        );
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
    const patchCables: PatchCable[] = [];
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    function makePatchCable(a: THREE.Object3D, b: THREE.Object3D, lift: number, color = 0xffaa4d) {
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
    function setCableGeometry(c: PatchCable) {
        c.a.getWorldPosition(tmpA);
        c.b.getWorldPosition(tmpB);
        const mid = tmpA.clone().add(tmpB).multiplyScalar(0.5);
        const bendA = tmpA.clone().lerp(mid, 0.35);
        const bendB = tmpA.clone().lerp(mid, 0.7);
        bendA.y += c.lift;
        bendB.y += c.lift * 0.85;
        const pos = c.line.geometry.getAttribute("position") as THREE.BufferAttribute;
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

    function rigControlRow(
        label: string,
        rigObj: THREE.Object3D,
        defaults: { x: number; z: number; yaw: number; pitch?: number },
        options?: { showAngles?: boolean }
    ) {
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
        if (options?.showAngles !== false) {
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
            pitchRange.value = String(
                Math.round((((defaults.pitch ?? rigObj.rotation.x) * 180) / Math.PI))
            );
            pitchRange.classList.add("viz303-mixer-slider");
            pitchRange.addEventListener("input", () => {
                rigObj.rotation.x = (parseInt(pitchRange.value, 10) * Math.PI) / 180;
            });
            row.append(document.createTextNode("Yaw"), yawRange, document.createTextNode("Pitch"), pitchRange);
        }
        visualMixer.append(row);
    }
    rigControlRow("303", rig303, {
        x: rig303.position.x,
        z: rig303.position.z,
        yaw: rig303.rotation.y,
        pitch: rig303.rotation.x,
    });
    rigControlRow("909", rig909, {
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
    vjMotionChk.checked = true;
    vjMotionChk.addEventListener("change", () => {
        vjMotionEnabled = vjMotionChk.checked;
        vjMotionBtn.textContent = `VJ walls motion: ${vjMotionEnabled ? "on" : "off"}`;
    });
    vjMotionRow.append(vjMotionChk, document.createTextNode(" Animate VJ walls"));
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

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        new THREE.MeshStandardMaterial({
            color: 0x0d1018,
            roughness: 0.96,
            metalness: 0.02,
        })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    scene.add(floor);
    const funDeco = new THREE.Group();
    scene.add(funDeco);
    for (let i = 0; i < 24; i++) {
        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.16 + (i % 3) * 0.04, 8, 6),
            new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL((i * 0.13) % 1, 0.8, 0.62),
                emissive: new THREE.Color().setHSL((i * 0.13) % 1, 0.7, 0.2),
                emissiveIntensity: 1.0,
                roughness: 0.5,
                metalness: 0.08,
            })
        );
        orb.position.set(
            -11 + (i % 8) * 3.0 + ((i / 8) | 0) * 0.22,
            0.08 + ((i / 8) | 0) * 0.1,
            -10 + ((i / 8) | 0) * 3.1 + (i % 2 ? 0.65 : -0.3)
        );
        funDeco.add(orb);
    }
    const acidHaloGroup = new THREE.Group();
    scene.add(acidHaloGroup);
    const acidHalos: THREE.Mesh[] = [];
    function addHalo(r: number, y: number, z: number, col: THREE.ColorRepresentation) {
        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(r, 0.1, 8, 24),
            new THREE.MeshStandardMaterial({
                color: col,
                emissive: col,
                emissiveIntensity: 0.85,
                roughness: 0.5,
                metalness: 0.1,
                transparent: true,
                opacity: 0.75,
            })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, y, z);
        acidHaloGroup.add(halo);
        acidHalos.push(halo);
    }
    addHalo(3.1, 1.2, 0.4, 0xff7dd8);
    addHalo(4.25, 1.7, -2.3, 0x7cd4ff);
    function addCartoonBumpers(
        parent: THREE.Object3D,
        points: Array<[number, number, number]>,
        hueStart: number
    ) {
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const hue = (hueStart + i * 0.12) % 1;
            const bump = new THREE.Mesh(
                new THREE.SphereGeometry(0.17 + (i % 2) * 0.06, 10, 8),
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color().setHSL(hue, 0.85, 0.64),
                    emissive: new THREE.Color().setHSL(hue, 0.8, 0.24),
                    emissiveIntensity: 0.9,
                    roughness: 0.45,
                    metalness: 0.08,
                })
            );
            bump.position.set(p[0], p[1], p[2]);
            parent.add(bump);
        }
    }
    addCartoonBumpers(
        rig303,
        [
            [-5.0, 0.62, -2.2],
            [5.0, 0.62, -2.2],
            [-5.0, 0.62, 2.2],
            [5.0, 0.62, 2.2],
        ],
        0.62
    );
    addCartoonBumpers(
        rig909,
        [
            [-3.7, 0.56, -2.0],
            [3.7, 0.56, -2.0],
            [-3.7, 0.56, 2.0],
            [3.7, 0.56, 2.0],
        ],
        0.1
    );
    addCartoonBumpers(
        rigMixer,
        [
            [-2.4, 0.58, -1.3],
            [2.4, 0.58, -1.3],
            [-2.4, 0.58, 1.3],
            [2.4, 0.58, 1.3],
        ],
        0.4
    );
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

    function toonify(root: THREE.Object3D, tint: THREE.ColorRepresentation, amount = 0.22) {
        const tintColor = new THREE.Color(tint);
        root.traverse((obj) => {
            const mat = (obj as THREE.Mesh).material;
            if (!mat || Array.isArray(mat)) return;
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
    const trippyBindings: TrippyMaterialBinding[] = [];
    function registerTrippyMaterials(root: THREE.Object3D, baseRate: number, shift = 0.14) {
        root.traverse((obj) => {
            const mat = (obj as THREE.Mesh).material;
            if (!mat || Array.isArray(mat)) return;
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
    const trippyOrbs: TrippyOrb[] = [];
    function makeTrippyOrb(parent: THREE.Object3D, x: number, y: number, z: number, hue: number) {
        const m = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.08, 0),
            new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(hue, 0.85, 0.62),
                emissive: new THREE.Color().setHSL(hue, 0.8, 0.28),
                emissiveIntensity: 1.1,
                roughness: 0.45,
                metalness: 0.06,
            })
        );
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
        radius: 12.2,
        autoOrbitEnabled: true,
        autoOrbitSpeed: 0.0008,
        drag: false,
        lastX: 0,
        lastY: 0,
    };
    const target = new THREE.Vector3(-1.1, 0.35, 0);
    let cameraMode: "manual" | "orbit" | "fly" | "cuts" | "track" = "orbit";
    let trackRecording = false;
    let trackPlaying = false;
    let trackStartMs = 0;
    let trackDuration = 0;
    const cameraTrack: CamKeyframe[] = [];
    const hotKnobTarget = new THREE.Vector3(-1.1, 0.35, 0);
    const restTarget = new THREE.Vector3(-1.1, 0.35, 0);
    const tmpKnobWorld = new THREE.Vector3();
    let flyPulse = 0;
    let shaderMode = 0;
    let shaderModeNext = 1;
    let shaderBlend = 0;
    let shaderBarsUntilSwitch = 2;
    let glitchPulse = 0;
    let downbeatBars = 0;
    const cutPasses: CamKeyframe[] = [
        { t: 0, yaw: -0.6, pitch: 0.42, radius: 12.8, tx: -0.8, ty: 0.3, tz: 0.0 },
        { t: 0, yaw: 0.1, pitch: 0.28, radius: 10.6, tx: 3.3, ty: 0.25, tz: 0.0 },
        { t: 0, yaw: 0.9, pitch: 0.34, radius: 10.9, tx: -6.7, ty: 0.25, tz: -0.3 },
        { t: 0, yaw: 1.5, pitch: 0.5, radius: 13.4, tx: -1.2, ty: 0.45, tz: -0.2 },
    ];
    let cutIndex = 0;

    function updateCamera() {
        const cp = Math.cos(cam.pitch);
        camera.position.set(
            Math.cos(cam.yaw) * cp * cam.radius,
            Math.sin(cam.pitch) * cam.radius,
            Math.sin(cam.yaw) * cp * cam.radius
        );
        camera.position.add(target);
        camera.lookAt(target);
    }

    function onPointerDown(ev: PointerEvent) {
        cam.drag = true;
        cam.lastX = ev.clientX;
        cam.lastY = ev.clientY;
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
    }
    function onPointerMove(ev: PointerEvent) {
        if (!cam.drag) return;
        const dx = ev.clientX - cam.lastX;
        const dy = ev.clientY - cam.lastY;
        cam.lastX = ev.clientX;
        cam.lastY = ev.clientY;
        cam.yaw -= dx * 0.006;
        cam.pitch = Math.max(0.12, Math.min(1.18, cam.pitch - dy * 0.005));
    }
    function onPointerUp(ev: PointerEvent) {
        cam.drag = false;
        (ev.target as Element).releasePointerCapture?.(ev.pointerId);
    }
    function onWheel(ev: WheelEvent) {
        ev.preventDefault();
        cam.radius = Math.max(6.2, Math.min(18.0, cam.radius + ev.deltaY * 0.01));
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
        perfTick++;
        const t = performance.now() * 0.001;
        const stepNow = Math.max(0, Math.min(15, Math.floor(state.clock.currentStep.value)));
        const stepEdge = stepNow !== prevStep;
        prevStep = stepNow;

        if (cameraMode === "orbit") {
            if (!cam.drag && cam.autoOrbitEnabled) cam.yaw += cam.autoOrbitSpeed;
        } else if (cameraMode === "fly") {
            const phase = t * ((state.clock.bpm.value / 60) * 0.35);
            cam.yaw = Math.sin(phase * 0.9) * 0.45 + phase * 0.08;
            cam.pitch = 0.26 + Math.sin(phase * 1.4) * 0.09;
            cam.radius = 8.2 + Math.sin(phase * 1.7) * 0.9;
        } else if (cameraMode === "cuts" && stepEdge && stepNow === 0) {
            cutIndex = (cutIndex + 1) % cutPasses.length;
            const pass = cutPasses[cutIndex];
            cam.yaw = pass.yaw;
            cam.pitch = pass.pitch;
            cam.radius = pass.radius;
            target.set(pass.tx, pass.ty, pass.tz);
        } else if (cameraMode === "track" && trackPlaying && cameraTrack.length > 1) {
            const elapsed = ((performance.now() - trackStartMs) / 1000) % trackDuration;
            let i = 0;
            while (i + 1 < cameraTrack.length && cameraTrack[i + 1].t < elapsed) i++;
            const a = cameraTrack[i];
            const b = cameraTrack[Math.min(i + 1, cameraTrack.length - 1)];
            const span = Math.max(0.0001, b.t - a.t);
            const s = Math.min(1, Math.max(0, (elapsed - a.t) / span));
            const lerp = (x: number, y: number) => x + (y - x) * s;
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
            const mat = stepLeds[i].material as THREE.MeshStandardMaterial;
            const on = i === activeStep;
            mat.color.copy(on ? ledOn : ledOff);
            mat.emissive.set(on ? 0x5b7f11 : 0x111700);
            mat.emissiveIntensity = on ? 2.0 : 0.24;
        }

        const beatPulse = 0.5 + 0.5 * Math.sin(t * ((state.clock.bpm.value / 60) * Math.PI));
        const tempoMat = tempoLed.material as THREE.MeshStandardMaterial;
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
                if (slot.accent) accentCount++;
            }
            const avg = noteCount > 0 ? noteSum / noteCount : 40;
            tuneValue = Math.min(1, Math.max(0, (avg - 24) / 48));
            accentValue = Math.min(1, Math.max(0, accentCount / Math.max(1, p0.length)));
        } else {
            tuneValue = 0.5;
            accentValue = 0;
        }
        for (let lane = 0; lane < 4; lane++) {
            const arr = drumPat[lane] || [];
            const hit = Number(arr[drumStep] || 0);
            const muted = state.drums.mutes[lane]?.value ? 1 : 0;
            const target = muted ? 0 : Math.min(1, hit / 2);
            drumLaneEnergy[lane] = drumLaneEnergy[lane] * 0.86 + target * 0.14;
            const lampMat = drumLaneIndicators[lane].material as THREE.MeshStandardMaterial;
            lampMat.color.setRGB(
                0.3 + drumLaneEnergy[lane] * 0.7,
                0.1 + drumLaneEnergy[lane] * 0.2,
                0.05
            );
            lampMat.emissive.setRGB(
                0.12 + drumLaneEnergy[lane] * 0.45,
                0.04 + drumLaneEnergy[lane] * 0.12,
                0.02
            );
            lampMat.emissiveIntensity = 0.2 + drumLaneEnergy[lane] * 1.8;
        }
        for (let i = 0; i < drumLeds.length; i++) {
            const mat = drumLeds[i].material as THREE.MeshStandardMaterial;
            const on = i === drumStep;
            mat.color.set(on ? 0xff7f3a : 0x381e13);
            mat.emissive.set(on ? 0x7f2f0f : 0x1b0e06);
            mat.emissiveIntensity = on ? 1.6 : 0.25;
        }

        const acidEnergy =
            (norm(state.notes[0].parameters.cutoff) +
                norm(state.notes[0].parameters.resonance) +
                norm(state.notes[1].parameters.cutoff) +
                norm(state.notes[1].parameters.resonance)) /
            4;
        const drumEnergy =
            (drumLaneEnergy[0] + drumLaneEnergy[1] + drumLaneEnergy[2] + drumLaneEnergy[3]) / 4;
        vjUniforms.uTime.value = t;
        vjUniforms.uBpm.value = state.clock.bpm.value;
        vjUniforms.uAcid.value = acidEnergy;
        vjUniforms.uDrums.value = drumEnergy;

        const allKnobs = knobs.concat(drumKnobs);
        let hottestDelta = 0;
        for (const k of allKnobs) {
            const value01 = Math.min(1, Math.max(0, k.getValue()));
            if (k.source === "bassline") {
                k.mesh.rotation.y = -2.7 + value01 * 5.4;
            } else {
                k.mesh.rotation.y = -2.1 + value01 * 4.2;
            }
            const delta = Math.abs(value01 - k.prevValue);
            k.prevValue = value01;
            const weightedDelta = delta * (k.source === "bassline" ? 1.7 : 0.62);
            if (weightedDelta > hottestDelta) {
                hottestDelta = weightedDelta;
                k.mesh.getWorldPosition(tmpKnobWorld);
            }
            const deltaThreshold = k.source === "bassline" ? 0.0024 : 0.0065;
            const decay = k.source === "bassline" ? 0.9 : 0.86;
            const flashGain = k.source === "bassline" ? 1.15 : 0.62;
            if (delta > deltaThreshold) k.flashLevel = flashGain;
            else k.flashLevel *= decay;
            const flashMat = k.flash.material as THREE.MeshStandardMaterial;
            if (k.source === "bassline") {
                flashMat.color.set(0x8f7dff);
                flashMat.emissive.set(0x3b1a88);
                flashMat.emissiveIntensity = 0.24 + k.flashLevel * 3.5;
                flashMat.opacity = 0.58 + k.flashLevel * 0.5;
                k.mesh.position.y = k.baseY + k.flashLevel * 0.16;
            } else {
                flashMat.color.set(0xff8f5b);
                flashMat.emissive.set(0x55200b);
                flashMat.emissiveIntensity = 0.1 + k.flashLevel * 1.35;
                flashMat.opacity = 0.34 + k.flashLevel * 0.28;
                k.mesh.position.y = k.baseY + k.flashLevel * 0.038;
            }
        }
        if (hottestDelta > 0.0015) {
            hotKnobTarget.lerp(tmpKnobWorld, 0.35);
        } else {
            hotKnobTarget.lerp(restTarget, 0.02);
        }
        flyPulse = flyPulse * 0.9 + Math.min(1.6, hottestDelta * 54);

        if (stepEdge && stepNow === 0) {
            downbeatBars++;
            if (shaderCycleEnabled) {
                shaderBarsUntilSwitch--;
                if (shaderBarsUntilSwitch <= 0) {
                    shaderMode = shaderModeNext;
                    let pick = shaderModeNext;
                    const maxModes = 12;
                    let guard = 0;
                    while ((pick === shaderMode || pick === shaderModeNext) && guard < 12) {
                        pick = Math.floor(Math.random() * maxModes);
                        guard++;
                    }
                    shaderModeNext = pick;
                    shaderBlend = 0;
                    shaderBarsUntilSwitch = 1 + Math.floor(Math.random() * 3);
                }
            }
            glitchPulse = Math.min(1, glitchPulse + 0.45);
        }
        if (cameraMode === "fly") {
            const phase = t * ((state.clock.bpm.value / 60) * 0.35);
            target.lerp(hotKnobTarget, 0.2);
            target.y += 0.08 + Math.sin(phase * 3.8) * 0.04;
            cam.radius = Math.max(3.4, Math.min(7.2, 5.1 - flyPulse + Math.sin(phase * 2.4) * 0.45));
            cam.yaw += 0.02 + hottestDelta * 2.2;
            cam.pitch = Math.max(0.14, Math.min(0.85, 0.22 + flyPulse * 0.2));
        }

        // Exaggerated cartoon motion pass.
        const groove = 0.5 + 0.5 * Math.sin(t * 3.2 + state.clock.bpm.value * 0.01);
        rig303.position.y = rig303BaseY + (0.04 + acidEnergy * 0.1) * Math.sin(t * 2.7);
        rig909.position.y = rig909BaseY + (0.03 + drumEnergy * 0.08) * Math.sin(t * 2.3 + 1.2);
        rigMixer.position.y = rigMixerBaseY + 0.02 * Math.sin(t * 1.8 + 0.6);
        speakersGroup.position.y = speakersBaseY + 0.05 * Math.sin(t * 2.4 + 0.9);
        rig303.rotation.z = Math.sin(t * 1.9) * 0.022;
        rig909.rotation.z = Math.sin(t * 2.1 + 0.8) * 0.02;
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
        funDeco.rotation.y += 0.002 + acidEnergy * 0.003;
        funDeco.rotation.x = Math.sin(t * 0.34) * 0.08;
        if (perfTick % 2 === 0) {
            for (let i = 0; i < acidHalos.length; i++) {
                const h = acidHalos[i];
                h.rotation.z += 0.004 + i * 0.0008 + acidEnergy * 0.003;
                h.rotation.y += 0.003 + drumEnergy * 0.002;
                const pulse = 1 + Math.sin(t * (1.0 + i * 0.2) + i) * (0.06 + acidEnergy * 0.08);
                h.scale.setScalar(pulse);
                const hm = h.material as THREE.MeshStandardMaterial;
                hm.emissiveIntensity = 0.55 + acidEnergy * 0.8 + drumEnergy * 0.4;
                hm.opacity = 0.5 + acidEnergy * 0.2;
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
                    o.mesh.position.set(
                        o.base.x + Math.cos(wobble * 0.8) * o.amp,
                        o.base.y + Math.sin(wobble) * o.amp * 1.2,
                        o.base.z + Math.sin(wobble * 0.6) * o.amp
                    );
                    o.mesh.rotation.x += 0.01 + acidEnergy * 0.012;
                    o.mesh.rotation.y += 0.015 + drumEnergy * 0.012;
                    const m = o.mesh.material as THREE.MeshStandardMaterial;
                    m.emissiveIntensity = 0.5 + acidEnergy * 0.7 + (Math.sin(wobble * 1.8) * 0.5 + 0.5) * 0.4;
                }
            }
        } else {
            for (const b of trippyBindings) {
                b.mat.color.copy(b.baseColor);
                b.mat.emissive.copy(b.baseEmissive);
                b.mat.emissiveIntensity = 0.24;
            }
            for (const o of trippyOrbs) {
                o.mesh.position.copy(o.base);
                (o.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35;
            }
        }

        shaderBlend = Math.min(1, shaderBlend + 0.012 + drumEnergy * 0.02 + acidEnergy * 0.012);
        glitchPulse = glitchPulse * 0.9 + (drumEnergy + acidEnergy) * 0.035;
        vjUniforms.uMode.value = shaderMode;
        vjUniforms.uModeB.value = shaderModeNext;
        vjUniforms.uBlend.value = shaderBlend;
        vjUniforms.uGlitch.value = Math.min(1, glitchPulse);
        if (vjMotionEnabled) {
            vjGroup.rotation.y = t * 0.05 + flyPulse * 0.08;
            const sidePulse = 0.85 + 0.35 * Math.sin(t * 0.9 + vjUniforms.uAcid.value * 5.0);
            vjLeft.scale.y = sidePulse;
            vjRight.scale.y = sidePulse;
        } else {
            vjLeft.scale.y = 1;
            vjRight.scale.y = 1;
        }
        for (const c of patchCables) setCableGeometry(c);
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
