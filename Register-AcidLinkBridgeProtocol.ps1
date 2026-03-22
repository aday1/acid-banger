#requires -Version 5.1
# One-time per-user registration: browser link acid-banger-linkbridge://start runs Start-LinkBridge.ps1
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\Register-AcidLinkBridgeProtocol.ps1
#   powershell -ExecutionPolicy Bypass -File .\Register-AcidLinkBridgeProtocol.ps1 -Unregister
param(
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$startScript = Join-Path $Root "link-bridge\Start-LinkBridge.ps1"
if (-not (Test-Path -LiteralPath $startScript)) {
    Write-Error "Expected Start-LinkBridge.ps1 at: $startScript"
    exit 1
}

$proto = "acid-banger-linkbridge"
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
Set-ItemProperty -LiteralPath $hive -Name "(default)" -Value "URL:Acid Banger Link bridge"
New-ItemProperty -LiteralPath $hive -Name "URL Protocol" -PropertyType String -Value "" -Force | Out-Null

$open = Join-Path $hive "shell\open\command"
New-Item -Path $open -Force | Out-Null
Set-ItemProperty -LiteralPath $open -Name "(default)" -Value $command

Write-Host "Registered $proto:// (current user only)."
Write-Host "  In the app: use the Start link-bridge link under Clock sync when Ableton Link is selected."
Write-Host "  Or open:  ${proto}://start"
Write-Host "Start script: $startScript"
