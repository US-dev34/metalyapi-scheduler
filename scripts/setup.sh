#!/bin/bash
# MetalYapi Scheduling Platform — Setup Script

set -e

echo "=== MetalYapi Scheduling Platform Setup ==="
echo ""

# Backend setup
echo "[1/4] Installing backend dependencies..."
pip install -r backend/requirements.txt
echo "  Backend dependencies installed."

# Frontend setup
echo "[2/4] Installing frontend dependencies..."
cd frontend && npm install && cd ..
echo "  Frontend dependencies installed."

# Environment
echo "[3/4] Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  .env created from .env.example"
    echo "  IMPORTANT: Edit .env with your credentials."
else
    echo "  .env already exists, skipping."
fi

# Summary
echo ""
echo "[4/4] Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your Supabase and Claude API credentials"
echo "  2. Run: docker compose up (or start services individually)"
echo "  3. Backend: cd backend && uvicorn backend.main:app --reload --port 8000"
echo "  4. Frontend: cd frontend && npm run dev"
echo ""
