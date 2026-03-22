# The Endless Acid Banger (fork)

**The Endless Acid Banger** is an algorithmic human–computer techno jam: music and patterns are generated in the browser with TypeScript and the Web Audio API. The on-screen dials, pattern views, and autopilot switches can be driven by hand or left to the algorithm.

![Screenshot](https://github.com/vitling/acid-banger/blob/main/preview.png?raw=true)

**Vitling’s original build (unchanged upstream toy):**  
[www.vitling.xyz/toys/acid-banger](https://www.vitling.xyz/toys/acid-banger)

---

## What this Git repository is

This tree is **[github.com/aday1/acid-banger](https://github.com/aday1/acid-banger)** — a **fork** of [Vitling’s repository](https://github.com/vitling/acid-banger). It is **not** Vitling’s official release; it keeps the same **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** license spirit: reuse is allowed with **attribution to Vitling and the original project**, and to this fork when redistributing this variant.

Vitling has described the original as an art project rather than a conventional music product, and has welcomed others to fork and extend it. This fork adds sync, MIDI, OSC, packaging, and documentation on top of that original idea.

### What aday added on top of Vitling’s version

| Area | Addition |
|------|-----------|
| **Build** | Root `npm run build` (TypeScript → `js/`, webpack → `dist/`), `npm run dev` / `watch`, `build.ps1` / `build.sh`. |
| **Clock** | **Internal** (original-style clock), **MIDI master** / **slave**, **Ableton Link** via local Node **`link-bridge`** + WebSocket; in-app Link guide and `link-bridge-README.txt` in `dist/` after build. |
| **MIDI** | Device pickers, acid lines mirrored to MIDI out **channels 1–2**, **MIDI learn/forget** (right-click controls, CC/note, `localStorage` key `acid-banger-midi-map-v1`). |
| **OSC** | Browser client plus **`bridge/`** Node relay (UDP ↔ WebSocket); panel text for TouchOSC-style UDP vs WebSocket; `bridge-README.txt` in `dist/` after build. |
| **Windows** | **`Launch-AcidBanger.ps1`** (build, serve, Chrome, desktop shortcut). **`link-bridge/Start-LinkBridge.ps1`** for the Link bridge. |
| **UI** | Sync / MIDI / OSC panels, fork credit in `index.html`, CSS theme variables. |

The core musical behaviour, layout, and WebAudio patch still trace to Vitling’s upstream work; the fork layers transport and integration around that core.

---

## Quick start (this fork)

1. Install **Node 18+** and run **`npm install`** in the repo root.
2. Optional: add `909BD.mp3`, `909OH.mp3`, `909CH.mp3`, `909SD.mp3` beside the HTML sources; webpack copies them into `dist/` when present.
3. **Build:** `npm run build` (Windows: `build.ps1`). Output: **`dist/`**.
4. Serve **`dist/`** over HTTP. Web MIDI needs **`https://`** or **`localhost`**.
5. **Develop:** `npm run watch`, or rebuild and use **`npm run dev`** (static server; port may differ if 5173 is in use).

On Windows, **`Launch-AcidBanger.ps1`** from the repo root can build, serve, open Chrome, and refresh the **Endless Acid Banger** desktop shortcut (omit **`-SkipShortcut`** only when a shortcut is not wanted).

---

## Sync and MIDI (reference)

- **Internal:** built-in tempo (original-style).
- **MIDI master:** clock + start out; BPM from the dial; mirror to out ch **1–2**.
- **MIDI slave:** clock in; BPM estimate on the dial; pick **MIDI input** in the panel.
- **Ableton Link:** run **`link-bridge`** (see `link-bridge/README.txt` or **`Start-LinkBridge.ps1`**). In the app: **Ableton Link**, host **127.0.0.1**, port **9999** by default. The Clock sync panel links **`link-bridge-README.txt`** from `dist/` after a build.

### MIDI learn

One input serves both slave clock and learn. **Right-click** a control for learn/forget; mappings are listed in the MIDI panel. Details: CC vs note behaviour, **`acid-banger-midi-map-v1`** in **`localStorage`**.

---

## OSC bridge (reference)

Browsers do not expose OSC UDP directly. The **`bridge/`** Node app relays **UDP ↔ WebSocket JSON**. See **`bridge/README.txt`** and the in-page OSC section; after build, **`dist/bridge-README.txt`**.

---

## Vitling — support, license, upstream

Vitling’s work can be supported via [GitHub Sponsors](https://github.com/sponsors/vitling) and [music releases](https://music.vitling.xyz) / [Bandcamp](https://edgenetwork.bandcamp.com/album/edge001-spaceport-lounge-music).

The project is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). That covers the original work and this fork’s changes: attribute Vitling and the upstream project, and this repository when sharing this fork’s tree.

**Upstream:** [vitling.xyz](https://www.vitling.xyz) · [github.com/vitling/acid-banger](https://github.com/vitling/acid-banger)  
**This fork:** [github.com/aday1/acid-banger](https://github.com/aday1/acid-banger) · maintained by **aday**

---

Thanks to **Vitling** for the original **Endless Acid Banger** — the playful core that made this fork worth building on.
