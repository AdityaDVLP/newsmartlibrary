$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$sourcePath = Join-Path $PSScriptRoot "Program.cs"
$manifestPath = Join-Path $PSScriptRoot "installer.manifest"
$serverPath = Join-Path $repoRoot "lib\rfid\server.py"
$outputDirectory = Join-Path $repoRoot "artifacts"
$outputPath = Join-Path $outputDirectory "NewSmartLibraryRFIDSetup-v3.exe"
$compilerPath = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $compilerPath)) {
    throw "Kompiler C# .NET Framework tidak ditemukan: $compilerPath"
}
if (-not (Test-Path $serverPath)) {
    throw "Server RFID tidak ditemukan: $serverPath"
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

& $compilerPath `
    /nologo `
    /target:exe `
    /platform:x64 `
    "/out:$outputPath" `
    "/win32manifest:$manifestPath" `
    /reference:System.IO.Compression.dll `
    /reference:System.ServiceProcess.dll `
    "/resource:$serverPath,NewSmartLibraryRFID.server.py" `
    $sourcePath

if ($LASTEXITCODE -ne 0) {
    throw "Kompilasi installer gagal dengan kode $LASTEXITCODE."
}

Write-Output "Installer berhasil dibuat: $outputPath"
