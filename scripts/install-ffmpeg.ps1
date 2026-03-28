# ApixsLive FFmpeg Auto-Installer (Windows)
# Skrip ini mengunduh FFmpeg portable dan menempatkannya di folder backend/bin

$BinDir = Join-Path $PSScriptRoot "../backend/bin"
if (!(Test-Path $BinDir)) { New-Item -ItemType Directory -Path $BinDir | Out-Null }

$ZipPath = Join-Path $BinDir "ffmpeg.zip"
# official build link
$Url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

Write-Host "MENGUNDUH FFmpeg dari: $Url" -ForegroundColor Cyan
Invoke-WebRequest -Uri $Url -OutFile $ZipPath

Write-Host "MENGEKSTRAK file..." -ForegroundColor Yellow
Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force

# Cari file ffmpeg.exe di hasil ekstraksi dan pindahkan ke root bin
$Exe = Get-ChildItem -Path $BinDir -Filter ffmpeg.exe -Recurse | Select-Object -First 1
if ($Exe) {
    Copy-Item -Path $Exe.FullName -Destination (Join-Path $BinDir "ffmpeg.exe") -Force
    Copy-Item -Path (Join-Path $Exe.Directory "ffprobe.exe") -Destination (Join-Path $BinDir "ffprobe.exe") -Force
}

Remove-Item $ZipPath
Write-Host "INSTALASI FFmpeg Berhasil di: (backend/bin/ffmpeg.exe)" -ForegroundColor Green
Write-Host "Sistem akan mendeteksi otomatis jalur ini saat server restart atau watchdog berjalan."
