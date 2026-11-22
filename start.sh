#!/bin/bash
# DuitKu - Runner Script

cd "$(dirname "$0")"

PORT=${1:-5000}

echo "=================================================="
echo "💰 Menjalankan DuitKu - Money Tracker Pribadi..."
echo "=================================================="

# Check if python3 is available
if command -v python3 >/dev/null 2>&1; then
    PY_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PY_BIN="python"
else
    echo "❌ Error: Python tidak ditemukan. Harap install python terlebih dahulu."
    exit 1
fi

echo "🚀 Server aktif di: http://localhost:$PORT"
echo "📱 Untuk membuka dari browser HP / Chrome:"
echo "   Ketik URL di atas di browser Anda."
echo "=================================================="

# Start server
$PY_BIN server.py "$PORT"
