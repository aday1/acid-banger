# The Endless Acid Banger

An algorithmic human-computer techno jam

![Screenshot](https://github.com/vitling/acid-banger/blob/main/preview.png?raw=true)

Built in TypeScript with the Web Audio API.

**Original live version (Vitling):** [www.vitling.xyz/toys/acid-banger](https://www.vitling.xyz/toys/acid-banger)

---

## This repository: CC BY fork by aday

This repo is **[github.com/aday1/acid-banger](https://github.com/aday1/acid-banger)** — a **derivative fork** of [Vitling’s The Endless Acid Banger](https://github.com/vitling/acid-banger). It is **not** the upstream author’s release; it adds integration and tooling on top of the same **Creative Commons Attribution 4.0 International** ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) basis. If you share or build on this code or the music it makes, **credit Vitling and the original project**, and credit this fork where appropriate.

Upstream describes the piece as an art project, not a traditional music product. This fork extends it for sync, MIDI, and external control while keeping that lineage explicit.

### Features added in this fork (summary)

Compared to the upstream browser toy, this fork includes:

| Area | What was added |
|------|----------------|
| **Build** | Root `npm run build` (TypeScript to `js/`, webpack bundle to `dist/`), `npm run dev` / `watch`, `build.ps1` / `build.sh`. |
| **Clock sync** | **Internal** (original behaviour), **MIDI master** (clock + start out), **MIDI slave** (clock in, BPM estimate on dial), **Ableton Link** (via local Node **link-bridge** + WebSocket; in-app setup guide + copied `link-bridge-README.txt` in `dist/`). |
| **MIDI devices** | Web MIDI input/output selection, refresh, shared input for slave clock + learn. |
| **MIDI mirror** | Acid lines sent to MIDI **out** on **channels 1 and 2** when driving external gear. |
| **MIDI learn / forget** | **Right-click** knobs, triggers, toggles, BPM, volume, delay, mutes, autopilot: map **CC** or **note** per control; list + forget / clear all in the MIDI panel; **`localStorage`** key `acid-banger-midi-map-v1`. |
| **OSC** | Browser client + **`bridge/`** Node relay (UDP in/out, WebSocket to the page). In-app help for **TouchOSC-style UDP** vs **WebSocket**; **`dist/bridge-README.txt`** after build. Optional **Emit step** / **Emit BPM** to a UDP target. |
| **Windows launcher** | **`Launch-AcidBanger.ps1`**: build, serve `dist/`, open Chrome, optional desktop shortcut **Endless Acid Banger**. |
| **Link bridge helper** | **`link-bridge/Start-LinkBridge.ps1`**: install + run the Ableton Link WebSocket bridge (native `abletonlink`; needs Python + C++ build tools on Windows). |
| **UI / docs** | MIDI and sync panels, OSC explanations, fork credit in **`index.html`**, themed CSS variables. |

Upstream remains the source of the core musical idea, UI layout, and WebAudio patch; this fork layers transport, MIDI, OSC, packaging, and documentation around it.

---

## Quick start (this fork)

1. Install **Node 18+** and run **`npm install`** in the repo root.
2. Add 909 samples next to the HTML source if you use them: `909BD.mp3`, `909OH.mp3`, `909CH.mp3`, `909SD.mp3` (webpack copies them into `dist/` when present).
3. **Build:** `npm run build` (Windows: `build.ps1`). Output: **`dist/`**.
4. Serve **`dist/`** over HTTP. Web MIDI needs **`https://`** or **`localhost`**.
5. **Develop:** `npm run watch` (and webpack watch if configured), or rebuild and use **`npm run dev`** (build + static server; port may vary if 5173 is busy).

**Windows one-shot:** run **`Launch-AcidBanger.ps1`** from the repo root (creates/updates a desktop shortcut unless you pass **`-SkipShortcut`**).

---

## Sync and MIDI (detail)

- **Internal:** built-in clock (same idea as original).
- **MIDI master:** MIDI clock (24 ppqn) + Start; BPM from the dial; acid lines mirrored to MIDI out ch **1–2**.
- **MIDI slave:** step on incoming clock; BPM estimate updates the dial (delay time follows). Select **MIDI input** in the panel.
- **Ableton Link:** run **`link-bridge`** on your machine (`link-bridge/README.txt`, or **`Start-LinkBridge.ps1`**). In the app: **Ableton Link**, WebSocket host/port (default **127.0.0.1** / **9999**). After build, open **`link-bridge-README.txt`** from **`dist/`** via the Clock sync panel link.

### MIDI learn and per-control mappings

One MIDI input handles **slave clock** and **learn** together.

- **Right-click** a control → **MIDI learn** or **MIDI forget**; then move a **CC** or play a **note on** to learn.
- **Numeric:** CC or note scaled across parameter range. **Toggles:** CC threshold 64; notes toggle. **Triggers:** note on fires; CC on upward crossing through 64.
- **MIDI devices** panel: mapping list, per-row forget, **Clear all**, **Cancel learn** while waiting.
- Storage: **`localStorage`** `acid-banger-midi-map-v1`.

---

## OSC bridge (detail)

Browsers do not speak OSC over UDP natively. The **`bridge/`** Node process relays **UDP ↔ WebSocket JSON**. See **`bridge/README.txt`** (and **`dist/bridge-README.txt`** after build); the OSC panel links it and explains **WebSocket (browser ↔ Node)** vs **UDP (TouchOSC, Max, etc.)**.

---

## Original author — support and license (Vitling)

You can support Vitling’s work by [Sponsoring on GitHub](https://github.com/sponsors/vitling) or [buying music](https://music.vitling.xyz) / [Bandcamp](https://edgenetwork.bandcamp.com/album/edge001-spaceport-lounge-music).

Vitling’s original README notes the project is offered as finished art and may not accept feature-driven PRs upstream; **forks are explicitly welcome** for further creative work.

This work is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). That applies to the original composition/code and to this fork’s changes: use and remix with **attribution** to the original source (Vitling and the upstream project) and, for this tree, appropriate mention of the fork maintainer if you redistribute this version.

---

**Fork maintainer:** **aday** — [github.com/aday1/acid-banger](https://github.com/aday1/acid-banger)  
**Upstream:** **Vitling** — [vitling.xyz](https://www.vitling.xyz) · [github.com/vitling/acid-banger](https://github.com/vitling/acid-banger)
