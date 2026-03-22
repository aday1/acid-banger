#requires -Version 5.1
<#
.SYNOPSIS
  Build The Endless Acid Banger, serve dist/, open in Google Chrome, and keep a desktop shortcut.

.PARAMETER SkipBuild
  Skip npm run build (reuse existing dist/).

.PARAMETER SkipShortcut
  Do not create or update the desktop shortcut (useful when running from a dev terminal often).

.PARAMETER Port
  HTTP port for npx serve (default 5173).
#>
param(
    [switch]$SkipBuild,
    [switch]$SkipShortcut,
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

if (-not $SkipShortcut) {
    $desk = [Environment]::GetFolderPath("Desktop")
    $lnkPath = Join-Path $desk "Endless Acid Banger.lnk"
    $self = Join-Path $Root "Launch-AcidBanger.ps1"
    $wsh = New-Object -ComObject WScript.Shell
    $sc = $wsh.CreateShortcut($lnkPath)
    $sc.TargetPath = "powershell.exe"
    $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$self`""
    $sc.WorkingDirectory = $Root
    $sc.Description = "Build and open The Endless Acid Banger (Chrome + local server)"
    $sc.Save()
    Write-Host "Desktop shortcut: $lnkPath"
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

$baseUrl = "http://127.0.0.1:$Port/"

if (-not (Test-LocalPortOpen -P $Port)) {
    Write-Host "Starting static server on port $Port ..."
    $arg = "/c cd /d `"$Root`" && npx --yes serve dist -p $Port"
    Start-Process -FilePath "cmd.exe" -ArgumentList $arg -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(20)
    while (-not (Test-LocalPortOpen -P $Port)) {
        if ((Get-Date) -gt $deadline) {
            Write-Error "Server did not become ready on port $Port. Is the port in use?"
            exit 1
        }
        Start-Sleep -Milliseconds 250
    }
} else {
    Write-Host "Something is already listening on port $Port - opening that URL."
}

$chrome = Get-ChromePath
if ($chrome) {
    Write-Host "Opening Chrome: $baseUrl"
    Start-Process -FilePath $chrome -ArgumentList $baseUrl
} else {
    Write-Warning "Google Chrome not found; opening default browser."
    Start-Process $baseUrl
}

Write-Host "Done. Close the hidden cmd window running npx serve when finished. If the port was already in use, no new server was started."
