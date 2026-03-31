param(
  [switch]$OpenBrowser = $true
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'server'
$webDir = Join-Path $root 'web'

if (-not (Test-Path $serverDir)) {
  throw "Server directory not found: $serverDir"
}

if (-not (Test-Path $webDir)) {
  throw "Web directory not found: $webDir"
}

$serverCommand = "Set-Location '$serverDir'; npm run dev"
$webCommand = "Set-Location '$webDir'; npm start"

Start-Process powershell -ArgumentList '-NoExit', '-Command', $serverCommand | Out-Null
Start-Process powershell -ArgumentList '-NoExit', '-Command', $webCommand | Out-Null

if ($OpenBrowser) {
  Start-Sleep -Seconds 3
  Start-Process 'http://127.0.0.1:4173'
}

Write-Host 'Routine Lab launchers started.'
Write-Host 'API: http://localhost:4000'
Write-Host 'Web: http://127.0.0.1:4173'
