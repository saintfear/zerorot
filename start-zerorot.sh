#!/usr/bin/env bash

# Simple helper script to (re)start ZeroRot frontend and backend together.
# Usage:
#   cd /Users/chesterposey/zerorot
#   chmod +x start-zerorot.sh   # one time
#   ./start-zerorot.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📦 ZeroRot root: $ROOT_DIR"

#
# Start backend (Express API)
#
cd "$ROOT_DIR"
echo "🚀 Starting backend server (Node) ..."
node server/index.js &
BACKEND_PID=$!

#
# Start frontend (Next.js dev server)
#
cd "$ROOT_DIR/client"
echo "🪄 Starting frontend (Next.js dev) ..."
npm run dev &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "🛑 Stopping ZeroRot processes..."
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "  - Stopping backend (pid $BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "  - Stopping frontend (pid $FRONTEND_PID)"
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM

echo ""
echo "✅ ZeroRot should now be running:"
echo "   - Backend: http://localhost:${PORT:-4000}"
echo "   - Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C in this terminal to stop both."

wait "$BACKEND_PID" "$FRONTEND_PID"

