#requires -Version 5.1
<#
.SYNOPSIS
  Install deps (if needed) and run the Ableton Link WebSocket bridge for acid-banger.

.DESCRIPTION
  The browser uses Clock sync -> Ableton Link with host 127.0.0.1 and port 9999 by default.
  This script must keep running while you use Link in the page. Leave the window open.

  Native module "abletonlink" requires Python 3 + C++ build tools on Windows (node-gyp).
#>
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

$port = if ($env:LINK_WS_PORT) { $env:LINK_WS_PORT } else { "9999" }

Write-Host ""
Write-Host "acid-banger Link bridge"
Write-Host "-----------------------"
Write-Host "WebSocket (default): ws://127.0.0.1:$port"
Write-Host "In the browser: Clock sync -> Ableton Link -> Link WS host 127.0.0.1, port $port"
Write-Host ""

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found. Install Node.js (LTS 20 or 22 recommended for native addons)."
    exit 1
}

if (-not $SkipInstall) {
    Write-Host "Running npm install (compiles abletonlink; first time can take several minutes)..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "npm install failed. On Windows you usually need ALL of the following:"
        Write-Host "  1) Python 3.x from https://www.python.org/downloads/  (installer: check 'Add python.exe to PATH')"
        Write-Host "  2) Visual Studio Build Tools + workload 'Desktop development with C++'"
        Write-Host "     https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Write-Host "  3) Optional: use Node 20 LTS if a very new Node version fails to build the addon."
        Write-Host ""
        Write-Host "Then open a NEW terminal (PATH refresh) and run this script again."
        Write-Host "Docs: link-bridge/README.txt and https://github.com/nodejs/node-gyp#installation"
        exit $LASTEXITCODE
    }
}

Write-Host "Starting bridge (Ctrl+C to stop)..."
npm start
