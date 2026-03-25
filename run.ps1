$ErrorActionPreference = "Stop"

function Invoke-KhepraBuild {
    Write-Host "[PowerShell] Building KHEPRA binaries..." -ForegroundColor Cyan
    
    if (-not (Get-Command "go" -ErrorAction SilentlyContinue)) {
        Write-Error "Go not found. Please install Go from https://go.dev/dl/"
    }

    go build -mod=vendor -o bin/khepra.exe ./cmd/khepra
    go build -mod=vendor -o bin/khepra-agent.exe ./cmd/agent
    
    Write-Host "[PowerShell] Build Complete." -ForegroundColor Green
}

function Start-KhepraAgent {
    if (-not (Test-Path "bin/khepra-agent.exe")) {
        Invoke-KhepraBuild
    }
    
    Write-Host "[PowerShell] Starting Agent..." -ForegroundColor Cyan
    $env:KHEPRA_AGENT_PORT = "45444"
    ./bin/khepra-agent.exe
}

function Invoke-KhepraCLI {
    param($Arguments)
    if (-not (Test-Path "bin/khepra.exe")) {
        Invoke-KhepraBuild
    }
    
    ./bin/khepra.exe $Arguments
}

# Simple Argument Parsing
$Command = $args[0]
$RestArgs = $args[1..($args.Length - 1)]

switch ($Command) {
    "build" { Invoke-KhepraBuild }
    "agent" { Start-KhepraAgent }
    "cli" { Invoke-KhepraCLI $RestArgs }
    "test" { 
        Write-Host "Running Tests..." -ForegroundColor Cyan
        go test -mod=vendor ./pkg/... ./cmd/...
    }
    default {
        Write-Host "Usage: .\run.ps1 [build|agent|cli|test]"
        Write-Host "Example: .\run.ps1 cli keygen"
    }
}
