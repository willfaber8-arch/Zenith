# Zenith OS — Font Self-Hosting Download Script
# Phase 15 · Step 15.3 — Fontaine Self-Hosting
#
# Downloads Plus Jakarta Sans and Space Grotesk variable .woff2 files
# (latin subset) from Google Fonts CDN. Both fonts expose a full weight
# axis in a single file — no separate per-weight files needed.
#
# Run once from the project root:
#   powershell -ExecutionPolicy Bypass -File scripts/download-fonts.ps1
#
# After running, restart the Next.js dev server (npm run dev).

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Ua   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'

$Dirs = @(
  "$Root\public\fonts\plus-jakarta-sans",
  "$Root\public\fonts\space-grotesk"
)
foreach ($d in $Dirs) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

function Download-Font {
  param([string]$Url, [string]$OutPath)
  $name = Split-Path -Leaf $OutPath
  if (Test-Path -LiteralPath $OutPath) {
    $size = [math]::Round((Get-Item -LiteralPath $OutPath).Length / 1KB, 1)
    Write-Host "  [SKIP] $name ($size KB) — already present" -ForegroundColor DarkGray
    return
  }
  Write-Host "  [DOWNLOAD] $name ..." -NoNewline
  $wc = [System.Net.WebClient]::new()
  $wc.Headers.Add('User-Agent', $Ua)
  $wc.DownloadFile($Url, $OutPath)
  $size = [math]::Round((Get-Item -LiteralPath $OutPath).Length / 1KB, 1)
  Write-Host " OK ($size KB)" -ForegroundColor Green
}

Write-Host "`n[ PLUS JAKARTA SANS ] Variable font (wght axis 300–800)" -ForegroundColor Cyan
Download-Font `
  -Url     'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2' `
  -OutPath "$Root\public\fonts\plus-jakarta-sans\PlusJakartaSans-Variable.woff2"

Write-Host "`n[ SPACE GROTESK ] Variable font (wght axis 300–700)" -ForegroundColor Cyan
Download-Font `
  -Url     'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2' `
  -OutPath "$Root\public\fonts\space-grotesk\SpaceGrotesk-Variable.woff2"

Write-Host "`n[ VALIDATION ]" -ForegroundColor Cyan
$Expected = @(
  'public\fonts\plus-jakarta-sans\PlusJakartaSans-Variable.woff2',
  'public\fonts\space-grotesk\SpaceGrotesk-Variable.woff2'
)

$Missing = 0
foreach ($f in $Expected) {
  $full = Join-Path $Root $f
  if (Test-Path -LiteralPath $full) {
    $size = [math]::Round((Get-Item -LiteralPath $full).Length / 1KB, 1)
    Write-Host "  [OK] $f ($size KB)" -ForegroundColor Green
  } else {
    Write-Host "  [MISSING] $f" -ForegroundColor Red
    $Missing++
  }
}

Write-Host ''
if ($Missing -eq 0) {
  Write-Host '[ FONT ASSETS READY ] Restart npm run dev to activate local font serving.' -ForegroundColor Green
} else {
  Write-Host "[ WARNING ] $Missing file(s) missing. Re-run this script or check network access." -ForegroundColor Yellow
}
