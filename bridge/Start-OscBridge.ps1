#requires -Version 5.1
# Install deps (if needed) and run bridge/server.mjs (UDP OSC <-> WebSocket for the browser).
param(
    [switch]$SkipInstall,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

$udp = if ($env:OSC_UDP_PORT) { $env:OSC_UDP_PORT } else { "57121" }
$ws = if ($env:OSC_WS_PORT) { $env:OSC_WS_PORT } else { "8765" }

Write-Host ""
Write-Host "acid-banger OSC bridge"
Write-Host "----------------------"
Write-Host "UDP listen (OSC in):  $udp"
Write-Host "WebSocket (browser):  ws://127.0.0.1:$ws"
Write-Host ""

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found. Install Node.js and ensure npm is on PATH."
    exit 1
}

if ($Clean -and (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
    Write-Host "Clean: removing bridge/node_modules..."
    try {
        Remove-Item -LiteralPath (Join-Path $Root "node_modules") -Recurse -Force -ErrorAction Stop
    } catch {
        $nm = Join-Path $Root "node_modules"
        $p = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "rmdir /s /q `"$nm`"") -Wait -PassThru -NoNewWindow
        if (($p.ExitCode -ne 0) -or (Test-Path -LiteralPath $nm)) {
            Write-Error "Could not remove node_modules. Close programs locking the folder, then retry -Clean."
            exit 1
        }
    }
    Write-Host "Done."
    Write-Host ""
}

if (-not $SkipInstall) {
    Write-Host "Running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "npm install failed. See bridge/README.txt in this folder."
        exit $LASTEXITCODE
    }
    Write-Host ""
}

Write-Host "Starting server (Ctrl+C to stop)..."
npm start
