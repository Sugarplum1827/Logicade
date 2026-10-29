param(
    [string]$BuildDir,
    [string]$GameJson,
    [switch]$Replace
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Add-Type -AssemblyName System.Windows.Forms

if ([string]::IsNullOrWhiteSpace($BuildDir)) {
    $buildDialog = [System.Windows.Forms.FolderBrowserDialog]::new()
    $buildDialog.Description = 'Choose the built static game folder (usually dist; index.html must be at its root).'
    $buildDialog.ShowNewFolderButton = $false
    if ($buildDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host 'Packaging cancelled; no files were changed.'
        exit 1
    }
    $BuildDir = $buildDialog.SelectedPath
}

if ([string]::IsNullOrWhiteSpace($GameJson)) {
    $jsonDialog = [System.Windows.Forms.OpenFileDialog]::new()
    $jsonDialog.Title = 'Choose the matching LogiCade game description JSON'
    $jsonDialog.Filter = 'Game description (*.json)|*.json'
    $jsonDialog.InitialDirectory = Join-Path $repoRoot 'data\fallback_pool'
    if ($jsonDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host 'Packaging cancelled; no files were changed.'
        exit 1
    }
    $GameJson = $jsonDialog.FileName
}

$BuildDir = (Resolve-Path -LiteralPath $BuildDir).Path
if (-not (Test-Path -LiteralPath (Join-Path $BuildDir 'index.html') -PathType Leaf)) {
    throw "Selected build folder must contain index.html at its root: $BuildDir"
}
$GameJson = (Resolve-Path -LiteralPath $GameJson).Path

$python = Join-Path $repoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    $python = (Get-Command python -ErrorAction Stop).Source
}

$arguments = @(
    (Join-Path $PSScriptRoot 'package_game_build.py'),
    '--build-dir', $BuildDir,
    '--game-json', $GameJson
)
if ($Replace) { $arguments += '--replace' }
& $python @arguments
if ($LASTEXITCODE -ne 0) {
    throw 'The game package was not created. Review the validation error above.'
}
