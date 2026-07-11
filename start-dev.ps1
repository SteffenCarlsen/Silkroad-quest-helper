$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js, then run this script again."
}

npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }

npm run dev
if ($LASTEXITCODE -ne 0) { throw "Development server exited with an error." }
