#requires -Version 5.1
# Tries to install MSVC build tools for node-gyp (abletonlink). Run in an elevated PowerShell if winget asks.
$ErrorActionPreference = "Stop"

function Find-Winget {
    $c = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $candidates = @(
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe",
        "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe\winget.exe"
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    Get-ChildItem "$env:ProgramFiles\WindowsApps" -Filter "winget.exe" -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}

$winget = Find-Winget
if (-not $winget) {
    Write-Error "winget.exe not found. Install App Installer from the Microsoft Store, or install Build Tools manually from https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    exit 1
}

Write-Host "Using: $winget"
Write-Host "Installing VS 2022 Build Tools (C++ workload). This is large and may require admin / UAC."

$override = "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
& $winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements --override $override

if ($LASTEXITCODE -ne 0) {
    Write-Warning "winget exited $LASTEXITCODE. If access denied, right-click PowerShell -> Run as administrator and run this script again."
    exit $LASTEXITCODE
}

Write-Host "Done. Open a NEW terminal, then run Start-LinkBridge.ps1 (use -Clean if EPERM on abletonlink)."
