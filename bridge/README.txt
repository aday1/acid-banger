acid-banger OSC bridge
----------------------

In the built app, open osc-reference.html (same folder as index.html) or use
the "OSC reference page" link in the OSC panel for addresses, ports, and
incoming/outgoing messages.

Purpose: browsers cannot send or receive OSC over UDP directly. This Node
process:
  - Listens for OSC on UDP (default 57121) and forwards each message to
    every WebSocket client as one line of JSON (OSC in -> browser).
  - Accepts JSON commands from the browser over WebSocket and sends OSC
    packets via UDP to a host and port you set in the page (OSC out).

Setup:
  cd bridge
  npm install
  npm start

PowerShell (from bridge folder):
  powershell -ExecutionPolicy Bypass -File .\Start-OscBridge.ps1
  Skip reinstall:  .\Start-OscBridge.ps1 -SkipInstall
  Wipe node_modules: .\Start-OscBridge.ps1 -Clean

Start from the browser (Windows, optional):
  From repo root once:
    powershell -ExecutionPolicy Bypass -File .\Register-AcidOscBridgeProtocol.ps1
  Then in the app OSC panel use "Start OSC bridge on this PC".
  Unregister: add -Unregister to that command.

Environment defaults (override as needed):
  OSC_UDP_PORT=57121   UDP port the bridge listens on for incoming OSC
  OSC_WS_PORT=8765     WebSocket port the browser connects to

In the acid-banger page:
  - Set "Host or full URL" and "WS port" to match the bridge (e.g. 127.0.0.1
    and 8765), or put ws://127.0.0.1:8765 in the host field.
  - Set "Bridge OSC UDP listen port" to the same value as OSC_UDP_PORT so you
    remember what to use in Max, SuperCollider, etc.
  - For OSC out: set target IP and UDP port; enable "Emit OSC /acid/step"
    and/or "Emit OSC /acid/bpm" or rely on your own tools reading those
    addresses.

Incoming JSON to browser (from UDP):
  {"address":"/acid/bpm","args":[142]}

Outgoing command from browser (to UDP target):
  {"cmd":"oscSend","address":"/foo","args":[1,2],"remoteHost":"127.0.0.1","remotePort":9000}

Test incoming OSC (after bridge is running):
  Send UDP to port 57121 with address /acid/bpm and one float argument.
