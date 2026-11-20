$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$sourcePath = Join-Path $PSScriptRoot "Program.cs"
$manifestPath = Join-Path $PSScriptRoot "installer.manifest"
$outputDirectory = Join-Path $repoRoot "artifacts"
$outputPath = Join-Path $outputDirectory "NewSmartLibraryUHFSetup.exe"
$compilerPath = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $compilerPath)) {
    throw "Kompiler C# .NET Framework tidak ditemukan: $compilerPath"
}

# Zip all required python server & driver files
$tempZip = Join-Path $PSScriptRoot "app.zip"
if (Test-Path $tempZip) { Remove-Item $tempZip -Force }

$filesToZip = @(
    (Join-Path $repoRoot "lib\rfid_ws_server.py"),
    (Join-Path $repoRoot "lib\utils.py"),
    (Join-Path $repoRoot "lib\command.py"),
    (Join-Path $repoRoot "lib\response.py"),
    (Join-Path $repoRoot "lib\transport.py"),
    (Join-Path $repoRoot "lib\reader.py"),
    (Join-Path $repoRoot "lib\auto_reader.py"),
    (Join-Path $repoRoot "lib\main.py")
)

Compress-Archive -Path $filesToZip -DestinationPath $tempZip -Force

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

& $compilerPath `
    /nologo `
    /target:exe `
    /platform:x64 `
    "/out:$outputPath" `
    "/win32manifest:$manifestPath" `
    /reference:System.IO.Compression.dll `
    /reference:System.IO.Compression.FileSystem.dll `
    /reference:System.ServiceProcess.dll `
    "/resource:$tempZip,NewSmartLibraryUHFRFID.app.zip" `
    $sourcePath

Remove-Item $tempZip -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    throw "Kompilasi installer gagal dengan kode $LASTEXITCODE."
}

Write-Output "Installer UHF berhasil dibuat: $outputPath"
