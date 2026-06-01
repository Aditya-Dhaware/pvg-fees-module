#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== PVG Fees & Billing Module Setup ==="

# 1. Check Prerequisites
echo "Checking prerequisites..."

# Python 3.10+
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python is not installed." >&2
    exit 1
fi

$PYTHON_CMD -c "import sys; exit(0 if sys.version_info >= (3, 10) else 1)" || {
    echo "Error: Python 3.10+ is required. Found version: $($PYTHON_CMD --version)" >&2
    exit 1
}
echo "✓ Python 3.10+ is available."

# Node.js 18+
if command -v node &>/dev/null; then
    node -e "const major = parseInt(process.versions.node.split('.')[0]); process.exit(major >= 18 ? 0 : 1)" || {
        echo "Error: Node 18+ is required. Found version: $(node --version)" >&2
        exit 1
    }
    echo "✓ Node 18+ is available."
else
    echo "Error: Node.js is not installed." >&2
    exit 1
fi

# Postgres 14+
if command -v psql &>/dev/null; then
    PG_VERSION_STR=$(psql --version | grep -oE '[0-9]+' | head -n1)
    if [ "$PG_VERSION_STR" -lt 14 ]; then
        echo "Warning: PostgreSQL 14+ is recommended. Found version: $PG_VERSION_STR" >&2
    else
        echo "✓ PostgreSQL 14+ is available."
    fi
else
    echo "Warning: psql command not found. Please ensure PostgreSQL 14+ is running." >&2
fi

# 2. Copy Env File
if [ ! -f "backend/.env" ]; then
    echo "Copying .env.example to backend/.env..."
    cp .env.example backend/.env
else
    echo "✓ backend/.env already exists."
fi

if [ ! -f "frontend/.env" ]; then
    echo "Creating default frontend/.env..."
    cat <<EOT > frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8005
REACT_APP_AUTH_FRONTEND_URL=http://localhost:3000
DANGEROUSLY_DISABLE_HOST_CHECK=true
EOT
else
    echo "✓ frontend/.env already exists."
fi

# 3. Setup Backend Virtual Environment & Dependencies
echo "Setting up Python virtual environment..."
cd backend
if [ ! -d ".venv" ]; then
    $PYTHON_CMD -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

echo "Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 4. Run Alembic Migrations
echo "Running database migrations..."
alembic upgrade head

# 5. Check for --demo flag
DEMO_SEED=false
for arg in "$@"; do
    if [ "$arg" = "--demo" ]; then
        DEMO_SEED=true
    fi
done

if [ "$DEMO_SEED" = true ]; then
    echo "Seeding demo data into database..."
    python -m app.db.seed
fi

cd ..

# 6. Install Frontend Dependencies
echo "Installing frontend npm packages..."
cd frontend
npm install
cd ..

echo "=== Setup completed successfully! ==="
