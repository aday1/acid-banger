# The Endless Acid Banger

An algorithmic human-computer techno jam

![Screenshot](https://github.com/vitling/acid-banger/blob/main/preview.png?raw=true)

Built in Typescript with the WebAudio API.

Live version running at [www.vitling.xyz/toys/acid-banger](https://www.vitling.xyz/toys/acid-banger)


## Support

You can support my work by [Sponsoring me on GitHub](https://github.com/sponsors/vitling) or [buying](https://music.vitling.xyz) [my music](https://edgenetwork.bandcamp.com/album/edge001-spaceport-lounge-music)


## License & Intended use

This is an art project, not a software tool for music creation. I consider it to be finished, and as such I will likely not be accepting feature requests or feature-driven PRs. Please feel encouraged to fork the project and do something else with it if you would like - I love to see further creative work built on top of it.

This work is licensed under a [Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/). I am aware that this is an unusual choice for code, but it reflects its status as an art project. IANAL, so I'm not sure how this stands up legally, but in my mind this is an infinite interactive composition and as such it should be licensed like music or other creative works.

This means you can use the ideas and/or the code and/or the music output in derivative works, but you must give credit to the original source (ie. me and this project).


# Forked by aday - Gonna recolor this and see what I can do about MIDI Sync
# Kudos to vitling for creating this fun toy

## Quick start (this fork)

1. Install Node 18+ and run `npm install` in the repo root.
2. Add 909 drum samples next to `index.html` if you have them: `909BD.mp3`, `909OH.mp3`, `909CH.mp3`, `909SD.mp3` (same names as upstream). The webpack copy step includes them when present; drums fail to load at runtime if they are missing.
3. Build: `npm run build` (Windows: `build.ps1` does the same). Output is in `dist/`.
4. Serve `dist/` over HTTP (or open via a static server). Web MIDI needs `https://` or `localhost`.
5. Develop with TypeScript watch: `npm run watch` in one terminal; use a static server from the repo root so `index.html` loads `js/app.js` as an ES module, or rebuild with `npm run build` and use `npm run dev` (build + `serve` on port 5173).

## Sync and MIDI

- **Internal**: built-in clock (same as original).
- **MIDI master**: sends MIDI clock (24 ppqn) and Start; BPM follows the BPM dial; acid lines are mirrored to MIDI out on channels 1 and 2.
- **MIDI slave**: advances on incoming MIDI clock; BPM estimate updates the dial for delay sync. Use MIDI **input** device selector.

### MIDI learn and per-control mappings

The selected **MIDI input** is shared by MIDI slave sync and by **MIDI learn**: only one `onmidimessage` handler runs, so clock and mappings work on the same port.

- **Right-click** a knob, pattern trigger, mute, autopilot switch, BPM, volume, or delay dial and choose **MIDI learn this control**, then move a **CC** or send **note on** on that input. **MIDI forget this control** clears that target only. The **MIDI devices** panel lists all mappings, per-row **Forget**, **Clear all**, and **Cancel learn** while waiting for MIDI.
- **Numeric** targets: CC value (or note number) is scaled across the parameter range. **Toggles**: CC 64+ is on, below 64 is off; each **note on** toggles. **Triggers** (new pattern / new notes): **note on** fires; CC fires on an upward crossing through 64.
- Mappings persist in **localStorage** under `acid-banger-midi-map-v1` for this origin.

- **Ableton Link**: requires the **link-bridge** Node process in this repo (`link-bridge/README.txt`). After `npm run build`, the same text is copied to `dist/link-bridge-README.txt` so the Clock sync panel can open it in a new tab. In the app, choose Ableton Link and follow the on-screen steps: `cd link-bridge`, `npm install`, `npm start`, match WebSocket host/port (default `127.0.0.1:9999`), then run Live or another Link peer on the LAN.

Optional **OSC bridge**: see `bridge/README.txt` in the repo (also copied to `dist/bridge-README.txt` when you build, with a link in the OSC panel). Configure WebSocket host/port in the page, UDP listen port for incoming OSC, and target IP/port for OSC messages sent from the page (step/BPM toggles).

**Credits:** original [The Endless Acid Banger](https://www.vitling.xyz) by **Vitling** (CC BY 4.0). This fork is maintained by **aday** ([repo](https://github.com/aday1/acid-banger)).
