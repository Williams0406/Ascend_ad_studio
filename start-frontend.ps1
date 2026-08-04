$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"
$nextPath = Join-Path $frontendPath "node_modules\.bin\next.cmd"

if (-not (Test-Path -LiteralPath $nextPath)) {
    throw "No se encontraron las dependencias del frontend. Ejecuta 'npm install' dentro de '$frontendPath'."
}

$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000/api"
$env:BACKEND_URL = "http://127.0.0.1:8000"

Push-Location $frontendPath
try {
    & $nextPath dev --hostname 127.0.0.1 --port 3000
}
finally {
    Pop-Location
}
