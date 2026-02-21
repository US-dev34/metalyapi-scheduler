#!/bin/bash
# MetalYapi Scheduling Platform — Run All Tests

set -e

echo "=== Running All Tests ==="
echo ""

echo "[1/3] Backend tests (pytest)..."
pytest tests/backend/ -v --tb=short
echo ""

echo "[2/3] Frontend tests (vitest)..."
cd frontend && npm run test && cd ..
echo ""

echo "[3/3] All tests complete!"
