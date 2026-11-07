param([switch]$Check, [switch]$Preview)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source } else { $nodePath = Join-Path $runtimeRoot 'node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Install Node.js 22.12 or newer first.' }
$env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$bundledPnpm = Join-Path $runtimeRoot 'node\node_modules\pnpm\bin\pnpm.cjs'
function Invoke-ProjectPnpm([string[]]$Arguments) {
    if (Test-Path -LiteralPath $bundledPnpm) { & $nodePath $bundledPnpm @Arguments }
    elseif ($pnpmCommand) { & $pnpmCommand.Source @Arguments }
    else { throw 'Install pnpm 10.11 using its official installation instructions first.' }
    if ($LASTEXITCODE -ne 0) { throw "pnpm exited with code $LASTEXITCODE" }
}
function Invoke-ProjectNode([string[]]$Arguments) {
    & $nodePath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Project command exited with code $LASTEXITCODE" }
}
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    $bundledPython = Join-Path $runtimeRoot 'python\python.exe'
    if (Test-Path -LiteralPath $bundledPython) { & $bundledPython -m venv .venv }
    else { python -m venv .venv }
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the project virtual environment.' }
}
if (-not (Test-Path -LiteralPath 'node_modules\vite')) { Invoke-ProjectPnpm -Arguments @('install', '--frozen-lockfile') }
if ($Check) {
    Invoke-ProjectNode -Arguments @('node_modules/vitest/vitest.mjs', 'run')
    Invoke-ProjectNode -Arguments @('node_modules/typescript/bin/tsc', '--noEmit')
    Invoke-ProjectNode -Arguments @('node_modules/vite/bin/vite.js', 'build')
} elseif ($Preview) {
    Invoke-ProjectNode -Arguments @('node_modules/typescript/bin/tsc', '--noEmit')
    Invoke-ProjectNode -Arguments @('node_modules/vite/bin/vite.js', 'build')
    Invoke-ProjectNode -Arguments @('node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1')
} else { Invoke-ProjectNode -Arguments @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1') }
