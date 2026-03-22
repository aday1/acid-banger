#requires -Version 5.1
# Floating toolbox: start Ableton Link bridge and OSC bridge from this repo.
# Shortcuts (when this window is focused): F9 = Link bridge, F10 = OSC bridge.
# Usage: run from repo root, or: powershell -File .\BridgeLauncherPanel.ps1 -RepoRoot "C:\path\to\acid-banger"
param(
    [string]$RepoRoot = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

$linkStart = Join-Path $RepoRoot "link-bridge\Start-LinkBridge.ps1"
$oscStart = Join-Path $RepoRoot "bridge\Start-OscBridge.ps1"
$regLink = Join-Path $RepoRoot "Register-AcidLinkBridgeProtocol.ps1"
$regOsc = Join-Path $RepoRoot "Register-AcidOscBridgeProtocol.ps1"
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function Test-RepoLayout {
    return (Test-Path -LiteralPath $linkStart) -and (Test-Path -LiteralPath $oscStart)
}

if (-not (Test-Path -LiteralPath $psExe)) {
    Write-Error "powershell.exe not found at $psExe"
    exit 1
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not (Test-RepoLayout)) {
    [void][System.Windows.Forms.MessageBox]::Show(
        "Could not find link-bridge or bridge scripts.`n`nRun this from the acid-banger repo root (same folder as Launch-AcidBanger.ps1).`n`nRepoRoot: $RepoRoot",
        "Acid Banger bridges",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    exit 1
}

function Invoke-BridgeWindow {
    param(
        [string]$ScriptPath,
        [string]$WorkingDirectory
    )
    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        [void][System.Windows.Forms.MessageBox]::Show("Missing: $ScriptPath", "Acid Banger bridges")
        return
    }
    Start-Process -FilePath $psExe -WorkingDirectory $WorkingDirectory -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-WindowStyle", "Normal",
        "-File", $ScriptPath
    )
}

function Invoke-RegisterScript {
    param([string]$ScriptPath)
    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        [void][System.Windows.Forms.MessageBox]::Show("Missing: $ScriptPath", "Acid Banger bridges")
        return
    }
    Start-Process -FilePath $psExe -WorkingDirectory $RepoRoot -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-WindowStyle", "Normal",
        "-File", $ScriptPath
    )
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Acid Banger — bridges"
$form.Size = New-Object System.Drawing.Size(440, 360)
$form.MinimumSize = New-Object System.Drawing.Size(400, 320)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox = $false
$form.KeyPreview = $true

$title = New-Object System.Windows.Forms.Label
$title.Location = New-Object System.Drawing.Point(14, 12)
$title.Size = New-Object System.Drawing.Size(400, 40)
$title.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$title.Text = "Start Node bridges (browser cannot run them)"

$hint = New-Object System.Windows.Forms.Label
$hint.Location = New-Object System.Drawing.Point(14, 48)
$hint.Size = New-Object System.Drawing.Size(400, 36)
$hint.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$hint.ForeColor = [System.Drawing.Color]::FromArgb(80, 80, 90)
$hint.Text = "Focus this window, then F9 or F10. Each opens a new PowerShell window — leave it open while you use the app."

$btnLink = New-Object System.Windows.Forms.Button
$btnLink.Location = New-Object System.Drawing.Point(14, 92)
$btnLink.Size = New-Object System.Drawing.Size(400, 40)
$btnLink.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnLink.Text = "Start Ableton Link bridge (F9)  ws://127.0.0.1:9999"
$btnLink.Add_Click({
        Invoke-BridgeWindow -ScriptPath $linkStart -WorkingDirectory (Split-Path -Parent $linkStart)
    })

$btnOsc = New-Object System.Windows.Forms.Button
$btnOsc.Location = New-Object System.Drawing.Point(14, 140)
$btnOsc.Size = New-Object System.Drawing.Size(400, 40)
$btnOsc.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnOsc.Text = "Start OSC bridge (F10)  WS 8765 / UDP 57121"
$btnOsc.Add_Click({
        Invoke-BridgeWindow -ScriptPath $oscStart -WorkingDirectory (Split-Path -Parent $oscStart)
    })

$sep = New-Object System.Windows.Forms.Label
$sep.Location = New-Object System.Drawing.Point(14, 192)
$sep.Size = New-Object System.Drawing.Size(400, 22)
$sep.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$sep.ForeColor = [System.Drawing.Color]::Gray
$sep.Text = "Optional (Windows): register custom URL handlers once"

$btnRegLink = New-Object System.Windows.Forms.Button
$btnRegLink.Location = New-Object System.Drawing.Point(14, 218)
$btnRegLink.Size = New-Object System.Drawing.Size(196, 34)
$btnRegLink.Text = "Register Link protocol"
$btnRegLink.Add_Click({ Invoke-RegisterScript -ScriptPath $regLink })

$btnRegOsc = New-Object System.Windows.Forms.Button
$btnRegOsc.Location = New-Object System.Drawing.Point(218, 218)
$btnRegOsc.Size = New-Object System.Drawing.Size(196, 34)
$btnRegOsc.Text = "Register OSC protocol"
$btnRegOsc.Add_Click({ Invoke-RegisterScript -ScriptPath $regOsc })

$topMost = New-Object System.Windows.Forms.CheckBox
$topMost.Location = New-Object System.Drawing.Point(14, 262)
$topMost.Size = New-Object System.Drawing.Size(200, 22)
$topMost.Text = "Keep on top"
$topMost.Add_CheckedChanged({ $form.TopMost = $topMost.Checked })

$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(14, 290)
$status.Size = New-Object System.Drawing.Size(400, 44)
$status.Font = New-Object System.Drawing.Font("Consolas", 8)
$status.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 110)
$status.Text = "F9 Link bridge   F10 OSC bridge   Esc close"

$form.Controls.AddRange(@(
        $title, $hint, $btnLink, $btnOsc, $sep, $btnRegLink, $btnRegOsc, $topMost, $status
    ))

$form.Add_KeyDown({
        param($sender, $e)
        if ($e.KeyCode -eq [System.Windows.Forms.Keys]::F9) {
            $e.Handled = $true
            $e.SuppressKeyPress = $true
            Invoke-BridgeWindow -ScriptPath $linkStart -WorkingDirectory (Split-Path -Parent $linkStart)
        }
        elseif ($e.KeyCode -eq [System.Windows.Forms.Keys]::F10) {
            $e.Handled = $true
            $e.SuppressKeyPress = $true
            Invoke-BridgeWindow -ScriptPath $oscStart -WorkingDirectory (Split-Path -Parent $oscStart)
        }
        elseif ($e.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
            $e.Handled = $true
            $form.Close()
        }
    })

[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::Run($form)
