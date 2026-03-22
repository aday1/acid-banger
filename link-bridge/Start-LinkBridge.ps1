#requires -Version 5.1
# Install deps (if needed) and run the Ableton Link WebSocket bridge for acid-banger.
# Browser: Clock sync -> Ableton Link (default host 127.0.0.1, port 9999). Keep this window open.
# Native module abletonlink needs Python 3 + C++ build tools on Windows (node-gyp).
param(
    [switch]$SkipInstall,
    [switch]$Clean,
    [switch]$IgnorePythonCheck
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

$port = if ($env:LINK_WS_PORT) { $env:LINK_WS_PORT } else { "9999" }

function Test-PythonInvokable {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $v = python --version 2>&1 | Out-String
    if ($v -match "Python 3\.") {
        $ErrorActionPreference = $prev
        return $true
    }
    $v = py -3 --version 2>&1 | Out-String
    $ErrorActionPreference = $prev
    return $v -match "Python 3\."
}

function Show-NodeVersionWarning {
    try {
        $nv = node -v 2>&1
        if ($nv -match "^v(\d+)") {
            $maj = [int]$Matches[1]
            if ($maj -ge 23) {
                Write-Host ""
                Write-Host "WARNING: Node $nv is very new." -ForegroundColor Yellow
                Write-Host "  Native addons often need Node 20 or 22 LTS." -ForegroundColor Yellow
                Write-Host "  If build still fails after Python is fixed, try Node 20 LTS." -ForegroundColor Yellow
                Write-Host ""
            }
        }
    } catch { }
}

Write-Host ""
Write-Host "acid-banger Link bridge"
Write-Host "-----------------------"
Write-Host "WebSocket (default):"
Write-Host "  ws://127.0.0.1:$port"
Write-Host "In the browser (Clock sync -> Ableton Link):"
Write-Host "  host 127.0.0.1  port $port"
Write-Host ""

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found. Install Node.js (LTS 20 or 22 recommended for native addons)."
    exit 1
}

Show-NodeVersionWarning

if ($Clean -and (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
    $nm = Join-Path $Root "node_modules"
    Write-Host "Clean: removing link-bridge/node_modules..."
    Write-Host "  (helps EPERM and half-built native addons)"
    try {
        Remove-Item -LiteralPath $nm -Recurse -Force -ErrorAction Stop
    } catch {
        Write-Warning "PowerShell could not delete node_modules (often a lock). Trying cmd rmdir..."
        $p = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "rmdir /s /q `"$nm`"") -Wait -PassThru -NoNewWindow
        if (($p.ExitCode -ne 0) -or (Test-Path -LiteralPath $nm)) {
            Write-Error "Still could not remove node_modules. Close Cursor/terminals/antivirus hooks on that folder, then run -Clean again."
            exit 1
        }
    }
    Write-Host "Done."
    Write-Host ""
}

if (-not $SkipInstall) {
    if (-not $IgnorePythonCheck -and -not (Test-PythonInvokable)) {
        Write-Host "PREFLIGHT: No working Python 3." -ForegroundColor Yellow
        Write-Host "  Check:  python --version   or   py -3 --version" -ForegroundColor Yellow
        Write-Host "  node-gyp needs Python for abletonlink. Common causes:"
        Write-Host "  - Bad PATH entries from an old Python uninstall."
        Write-Host "  - node-gyp tries many python.exe paths; some may not run."
        Write-Host "  - Python installed without 'Add python.exe to PATH'."
        Write-Host "  Fix: install Python 3.12+ and tick Add to PATH."
        Write-Host "  Get it here:"
        Write-Host "    https://www.python.org/downloads/"
        Write-Host "  Then close every terminal, open a new PowerShell, run:"
        Write-Host "    python --version"
        Write-Host "  Or point npm at python.exe:"
        Write-Host '    npm config set python "C:\Path\To\python.exe"'
        Write-Host "  Skip this check only (build often still needs Python):"
        Write-Host "    .\Start-LinkBridge.ps1 -IgnorePythonCheck"
        Write-Host ""
        exit 1
    } elseif ((Test-PythonInvokable)) {
        Write-Host "PREFLIGHT: Python responds on PATH (good for node-gyp)."
        python --version 2>&1
        Write-Host ""
    }

    Write-Host "Running npm install (compiles abletonlink)..."
    Write-Host "  First run can take several minutes."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "--- npm install failed (common on Windows) ---"
        Write-Host ""
        Write-Host "A) Python / node-gyp could not be run (many paths tried):"
        Write-Host "   Often leftover paths from an old install."
        Write-Host "   Install Python 3 from python.org; tick Add to PATH; new terminal."
        Write-Host "   https://www.python.org/downloads/"
        Write-Host "   Then:  python --version"
        Write-Host "   Or set exe explicitly:"
        Write-Host '     npm config set python "C:\Users\YOU\AppData\Local\Programs\Python\Python312\python.exe"'
        Write-Host ""
        Write-Host "B) EPERM / rmdir on node_modules\abletonlink:"
        Write-Host "   Close programs locking the folder, then:"
        Write-Host "     .\Start-LinkBridge.ps1 -Clean"
        Write-Host "   That removes node_modules here and reinstalls."
        Write-Host ""
        Write-Host "C) C++ compiler missing:"
        Write-Host "   Visual Studio Build Tools + Desktop development with C++"
        Write-Host "   https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Write-Host ""
        Write-Host "D) Node too new (you are on $(node -v)):"
        Write-Host "   Try Node 20 LTS if Python and C++ are OK but build still fails."
        Write-Host "   https://nodejs.org/"
        Write-Host ""
        Write-Host "Docs: README.txt here"
        Write-Host "  https://github.com/nodejs/node-gyp#installation"
        exit $LASTEXITCODE
    }
}

Write-Host "Starting bridge (Ctrl+C to stop)..."
npm start
