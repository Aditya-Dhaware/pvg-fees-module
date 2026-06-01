param (
    [switch]$demo
)

$ErrorActionPreference = "Stop"

Write-Host "=== PVG Fees & Billing Module Setup ===" -ForegroundColor Cyan

# 1. Check Prerequisites
Write-Host "Checking prerequisites..."

# Check Python
$pythonCmd = $null
if (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} else {
    Write-Error "Python is not installed. Please install Python 3.10+."
    exit 1
}

$pyVersionStr = & $pythonCmd --version 2>&1
if ($pyVersionStr -match "Python (\d+)\.(\d+)") {
    $pyMajor = [int]$Matches[1]
    $pyMinor = [int]$Matches[2]
    if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 10)) {
        Write-Error "Python 3.10+ is required. Found: $pyMajor.$pyMinor"
        exit 1
    }
    Write-Host "[OK] Python $pyMajor.$pyMinor is available."
} else {
    Write-Warning "Could not determine Python version. Proceeding anyway..."
}

# Check Node.js
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVersionStr = node -v
    if ($nodeVersionStr -match "v(\d+)") {
        $nodeMajor = [int]$Matches[1]
        if ($nodeMajor -lt 18) {
            Write-Error "Node 18+ is required. Found: $nodeVersionStr"
            exit 1
        }
        Write-Host "[OK] Node $nodeVersionStr is available."
    } else {
        Write-Warning "Could not determine Node version. Proceeding anyway..."
    }
} else {
    Write-Error "Node.js is not installed. Please install Node.js 18+."
    exit 1
}

# Check Postgres
if (Get-Command "psql" -ErrorAction SilentlyContinue) {
    $pgVerOutput = psql --version
    if ($pgVerOutput -match "psql \(PostgreSQL\) (\d+)") {
        $pgVer = [int]$Matches[1]
        if ($pgVer -lt 14) {
            Write-Warning "PostgreSQL 14+ is recommended. Found: $pgVer"
        } else {
            Write-Host "[OK] PostgreSQL 14+ is available."
        }
    }
} else {
    Write-Warning "psql command not found. Please ensure PostgreSQL 14+ is running."
}

# 2. Copy Env File
if (-not (Test-Path "backend\.env")) {
    Write-Host "Copying .env.example to backend\.env..."
    Copy-Item ".env.example" "backend\.env"
} else {
    Write-Host "[OK] backend\.env already exists."
}

if (-not (Test-Path "frontend\.env")) {
    Write-Host "Creating default frontend\.env..."
    $frontendEnv = "REACT_APP_BACKEND_URL=http://localhost:8005`nREACT_APP_AUTH_FRONTEND_URL=http://localhost:3000`nDANGEROUSLY_DISABLE_HOST_CHECK=true"
    $frontendEnv | Out-File -FilePath "frontend\.env" -Encoding utf8
} else {
    Write-Host "[OK] frontend\.env already exists."
}

# 3. Setup Backend Virtual Environment & Dependencies
Write-Host "Setting up Python virtual environment..."
Push-Location backend

if (-not (Test-Path ".venv")) {
    Start-Process -FilePath $pythonCmd -ArgumentList "-m venv .venv" -Wait -NoNewWindow
}

# Activate virtual environment in PowerShell session by modifying path
$env:PATH = "$(Get-Location)\.venv\Scripts;" + $env:PATH

Write-Host "Installing Python dependencies..."
Start-Process -FilePath "python" -ArgumentList "-m pip install --upgrade pip" -Wait -NoNewWindow
Start-Process -FilePath "python" -ArgumentList "-m pip install -r requirements.txt" -Wait -NoNewWindow

# 4. Run Alembic Migrations
Write-Host "Running database migrations..."
Start-Process -FilePath "alembic" -ArgumentList "upgrade head" -Wait -NoNewWindow

# 5. Check for -demo flag
if ($demo) {
    Write-Host "Seeding demo data into database..."
    Start-Process -FilePath "python" -ArgumentList "-m app.db.seed" -Wait -NoNewWindow
}

Pop-Location

# 6. Install Frontend Dependencies
Write-Host "Installing frontend npm packages..."
Push-Location frontend
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install" -Wait -NoNewWindow
Pop-Location

Write-Host "=== Setup completed successfully! ===" -ForegroundColor Green
