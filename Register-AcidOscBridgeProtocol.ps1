#requires -Version 5.1
# One-time per-user registration: acid-banger-oscbridge://start runs bridge/Start-OscBridge.ps1
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\Register-AcidOscBridgeProtocol.ps1
#   powershell -ExecutionPolicy Bypass -File .\Register-AcidOscBridgeProtocol.ps1 -Unregister
param(
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$startScript = Join-Path $Root "bridge\Start-OscBridge.ps1"
if (-not (Test-Path -LiteralPath $startScript)) {
    Write-Error "Expected Start-OscBridge.ps1 at: $startScript"
    exit 1
}

$proto = "acid-banger-oscbridge"
$hive = "HKCU:\Software\Classes\$proto"

if ($Unregister) {
    if (Test-Path -LiteralPath $hive) {
        Remove-Item -LiteralPath $hive -Recurse -Force
        Write-Host "Removed URL protocol $proto://"
    } else {
        Write-Host "Nothing to remove ($proto not registered)."
    }
    exit 0
}

$ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path -LiteralPath $ps)) {
    Write-Error "powershell.exe not found at $ps"
    exit 1
}

$launch = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File `"$startScript`""
$command = "$launch `"%1`""

New-Item -Path $hive -Force | Out-Null
Set-ItemProperty -LiteralPath $hive -Name "(default)" -Value "URL:Acid Banger OSC bridge"
New-ItemProperty -LiteralPath $hive -Name "URL Protocol" -PropertyType String -Value "" -Force | Out-Null

$open = Join-Path $hive "shell\open\command"
New-Item -Path $open -Force | Out-Null
Set-ItemProperty -LiteralPath $open -Name "(default)" -Value $command

Write-Host "Registered $proto:// (current user only)."
Write-Host "  In the app: OSC panel -> Start OSC bridge on this PC (after registration)."
Write-Host "  Or open:  ${proto}://start"
Write-Host "Start script: $startScript"
