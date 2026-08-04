$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$pythonPath = Join-Path $projectRoot "venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "No se encontro Python en '$pythonPath'. Crea el entorno virtual e instala backend/requirements.txt."
}

$env:DEBUG = "True"
$env:SECRET_KEY = "ascend-local-development-key"
$env:ALLOWED_HOSTS = "127.0.0.1,localhost"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
$env:CSRF_TRUSTED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
$env:SERVE_MEDIA_FILES = "True"
$env:SECURE_SSL_REDIRECT = "False"
$env:DB_ENGINE = "sqlite"
$env:USE_MOCK_AI_GENERATION = "True"

Push-Location $backendPath
try {
    & $pythonPath manage.py runserver 127.0.0.1:8000
}
finally {
    Pop-Location
}
