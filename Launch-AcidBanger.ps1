#requires -Version 5.1
# Build The Endless Acid Banger, serve dist/, open in Google Chrome, optional desktop shortcut.
# If the default port is taken by another app, this script picks a free port and serves there
# so you do not get a broken page (missing CSS / wrong app).
# By default also opens a small Windows panel (F9/F10) to start Link and OSC bridges — use -NoBridgesPanel to skip.
param(
    [switch]$SkipBuild,
    [switch]$SkipShortcut,
    [switch]$NoBridgesPanel,
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

function Test-LocalPortOpen {
    param([int]$P)
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect("127.0.0.1", $P)
        $c.Close()
        return $true
    } catch {
        return $false
    }
}

function Test-AcidBangerStaticServer {
    param([int]$P)
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$P/ui.css" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -ne 200) { return $false }
        $ct = [string]$r.Headers["Content-Type"]
        if ($ct -notmatch "text/css") { return $false }
        if ($r.Content -notmatch "--acid-page-bg") { return $false }
        return $true
    } catch {
        return $false
    }
}

function Find-FreeTcpPort {
    param([int]$Start, [int]$End)
    for ($p = $Start; $p -le $End; $p++) {
        if (-not (Test-LocalPortOpen -P $p)) {
            return $p
        }
    }
    return $null
}

function Get-ChromePath {
    $paths = @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
    )
    foreach ($p in $paths) {
        if ($p -and (Test-Path -LiteralPath $p)) {
            return $p
        }
    }
    $cmd = Get-Command chrome.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    return $null
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found. Install Node.js 18+ and ensure npm is on PATH."
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
    Write-Host "First-time setup: npm install"
    npm install
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

if (-not $SkipShortcut) {
    $desk = [Environment]::GetFolderPath("Desktop")
    $wsh = New-Object -ComObject WScript.Shell

    $self = Join-Path $Root "Launch-AcidBanger.ps1"
    $lnkPath = Join-Path $desk "Endless Acid Banger.lnk"
    $sc = $wsh.CreateShortcut($lnkPath)
    $sc.TargetPath = "powershell.exe"
    $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$self`""
    $sc.WorkingDirectory = $Root
    $sc.Description = "Build and open The Endless Acid Banger (Chrome + local server + bridge panel)"
    $sc.Save()
    Write-Host "Desktop shortcut: $lnkPath"

    $bridgePanel = Join-Path $Root "BridgeLauncherPanel.ps1"
    if (Test-Path -LiteralPath $bridgePanel) {
        $lnkBridges = Join-Path $desk "Acid Banger Bridges.lnk"
        $sc2 = $wsh.CreateShortcut($lnkBridges)
        $sc2.TargetPath = "powershell.exe"
        $sc2.Arguments = "-NoProfile -STA -ExecutionPolicy Bypass -File `"$bridgePanel`""
        $sc2.WorkingDirectory = $Root
        $sc2.Description = "Start Ableton Link or OSC bridge (same as F9/F10 in launcher panel)"
        $sc2.Save()
        Write-Host "Desktop shortcut: $lnkBridges"
    }
}

if (-not $SkipBuild) {
    Write-Host "Building..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} else {
    Write-Host "SkipBuild: using existing dist/"
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "dist\index.html"))) {
    Write-Error "dist/index.html missing. Run without -SkipBuild or run: npm run build"
    exit 1
}

$preferred = $Port
$usePort = $null
$startServer = $false

if (Test-LocalPortOpen -P $preferred) {
    if (Test-AcidBangerStaticServer -P $preferred) {
        $usePort = $preferred
        Write-Host "Port $preferred already serves this app; reusing it."
    } else {
        Write-Warning "Port $preferred is in use but /ui.css is not this build (another server on that port)."
        $alt = Find-FreeTcpPort -Start ($preferred + 1) -End ($preferred + 80)
        if ($null -eq $alt) {
            Write-Error "No free TCP port between $($preferred + 1) and $($preferred + 80)."
            exit 1
        }
        $usePort = $alt
        $startServer = $true
        Write-Host "Will start this app on port $usePort instead."
    }
} else {
    $usePort = $preferred
    $startServer = $true
}

if ($startServer) {
    Write-Host "Starting static server (minimized cmd): 127.0.0.1:$usePort"
    $inner = "cd /d `"$Root`" && npm exec -- serve dist -l tcp://127.0.0.1:$usePort -n"
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", $inner) -WindowStyle Minimized
    $deadline = (Get-Date).AddSeconds(25)
    while (-not (Test-AcidBangerStaticServer -P $usePort)) {
        if ((Get-Date) -gt $deadline) {
            Write-Error "Server did not serve /ui.css on port $usePort. Restore the minimized cmd window to read errors."
            exit 1
        }
        Start-Sleep -Milliseconds 300
    }
}

$baseUrl = "http://127.0.0.1:$usePort/"

$chrome = Get-ChromePath
if ($chrome) {
    Write-Host "Opening Chrome: $baseUrl"
    Start-Process -FilePath $chrome -ArgumentList $baseUrl
} else {
    Write-Warning "Google Chrome not found; opening default browser."
    Start-Process $baseUrl
}

Write-Host "Done. URL: $baseUrl"
Write-Host "Close the minimized cmd window running 'serve' when finished."

$bridgePanelScript = Join-Path $Root "BridgeLauncherPanel.ps1"
if (-not $NoBridgesPanel -and (Test-Path -LiteralPath $bridgePanelScript)) {
    Write-Host "Opening bridge launcher panel (F9 Link / F10 OSC). Use -NoBridgesPanel to skip next time."
    Start-Process -FilePath (Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe") `
        -ArgumentList @(
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy", "Bypass",
        "-WindowStyle", "Normal",
        "-File", $bridgePanelScript
    ) -WorkingDirectory $Root
}
elseif (-not (Test-Path -LiteralPath $bridgePanelScript)) {
    Write-Warning "BridgeLauncherPanel.ps1 not found; skipping bridge panel."
}
