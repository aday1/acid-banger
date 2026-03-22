Ableton Link bridge for acid-banger
------------------------------------

The browser cannot join an Ableton Link session directly. This small Node
process links to Link using the native npm package "abletonlink" and streams
timing to the page over WebSocket.

Windows (if npm install fails with node-gyp / Python errors)
------------------------------------------------------------
  If the log shows many lines like "python.exe could not be run" with paths under
  Program Files or AppData: those are often stale Windows registrations from an old
  Python uninstall. node-gyp tries each path and none execute. Fix by installing a
  current Python 3 from https://www.python.org/downloads/ with "Add python.exe to PATH",
  then close every terminal, open a new one, and run:  python --version
  You can also point npm at one exe explicitly:
    npm config set python "C:\Users\YOU\AppData\Local\Programs\Python\Python312\python.exe"

  If you see EPERM / rmdir errors under node_modules\abletonlink: another process
  (editor, antivirus) may be locking files. Close extra terminals, then from link-bridge:
    powershell -ExecutionPolicy Bypass -File .\Start-LinkBridge.ps1 -Clean
  That removes node_modules in this folder and reinstalls.

  1. Install Python 3 from https://www.python.org/downloads/
     Use the installer option to add Python to PATH. Close and reopen the terminal.
  2. Install MSVC build tools (node-gyp needs cl.exe):
     From an elevated PowerShell in this folder:
       powershell -ExecutionPolicy Bypass -File .\Install-VCTools.ps1
     Or install "Build Tools for Visual Studio" with workload
     "Desktop development with C++" (MSVC, Windows SDK).
     https://visualstudio.microsoft.com/visual-cpp-build-tools/
  3. Prefer Node.js 20 or 22 LTS if builds fail on a bleeding-edge Node version (e.g. Node 24+).
  4. From this folder run:  powershell -ExecutionPolicy Bypass -File .\Start-LinkBridge.ps1
     Or manually:  npm install   then   npm start
     Flags:  -Clean  wipe node_modules first;  -IgnorePythonCheck  skip preflight (rare)

Requirements (same as node-gyp native addons):
  - Python 3.x on PATH (node-gyp)
  - C++ build tools (Windows: Visual Studio Build Tools; Mac: Xcode CLI; Linux: build-essential)

Setup:
  cd link-bridge
  npm install
  npm start

Start bridge from the browser (Windows, optional)
-------------------------------------------------
  Browsers cannot run Node or the native Link addon by themselves. Optional:
  register a URL protocol once from the repo root, then use the in-page link
  under Clock sync when Ableton Link is selected.
    powershell -ExecutionPolicy Bypass -File .\Register-AcidLinkBridgeProtocol.ps1
  Unregister: add -Unregister to that command.

  If the in-page link does nothing: click Allow / Open when the browser asks;
  run the Register script again from your current repo folder if you moved it
  (the registry stores full paths). Fallback: Win+R, paste
    acid-banger-linkbridge://start
  then Enter.

  After updating the repo, run Register again once if the link still fails
  (the registry stores the full path to Start-LinkBridge.ps1).

PowerShell helper (install + start):
  powershell -ExecutionPolicy Bypass -File .\Start-LinkBridge.ps1
  Skip reinstall:       .\Start-LinkBridge.ps1 -SkipInstall
  Wipe node_modules:    .\Start-LinkBridge.ps1 -Clean
  Skip Python preflight: .\Start-LinkBridge.ps1 -IgnorePythonCheck

Environment:
  LINK_WS_PORT   WebSocket port (default 9999). Match "Link WS port" in the app.

In acid-banger choose sync mode "Ableton Link", set WebSocket host (e.g.
127.0.0.1) and port, then start Live or another Link-enabled app on the same
network. Tempo and phase align to the Link session; the BPM dial can propose
session tempo when you adjust it.

Protocol (server to browser, repeated ~50/s):
  {"type":"link","beat":...,"phase":0..1,"bpm":...,"quantum":4,"peers":n,"playing":bool}

Browser to server:
  {"cmd":"setBpm","value":128}
  {"cmd":"setQuantum","value":4}
