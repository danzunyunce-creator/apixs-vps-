#!/bin/bash
# ⚔️ [ApixsLive] ULTIMATE COMMAND CENTER (CI/CD Pipeline v3.5)
set -eo pipefail

# --- Color Constants ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[1;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# --- 0. Pre-Run Intelligence ---
LOCK_FILE="/tmp/apixs_deploy.lock"
if [ -f "$LOCK_FILE" ]; then
    echo -e "${RED}⚠️ Deployment sedang berjalan di sesi lain! Harap tunggu.${NC}"
    exit 1
fi
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

echo -e "${PURPLE}┌────────────────────────────────────────────────────────┐${NC}"
echo -e "${PURPLE}│${NC}  ${CYAN}🚀 [ApixsLive] Memulai Ultimate Deploy Pipeline...${NC}     ${PURPLE}│${NC}"
echo -e "${PURPLE}└────────────────────────────────────────────────────────┘${NC}"

# Define error trap
trap 'echo -e "${RED}❌ [ERROR] Deployment gagal di baris $LINENO. Pipeline dibatalkan agar sistem tetap aman!${NC}"; rm -f "$LOCK_FILE"' ERR

# 1. Location & Context Discovery
if [ -f "server.ts" ]; then
    BACKEND_DIR=$(pwd)
elif [ -d "backend" ]; then
    cd backend
    BACKEND_DIR=$(pwd)
else
    echo -e "${RED}❌ Direktori salah! Jalankan dari root proyek atau folder backend.${NC}"
    exit 1
fi

echo -e "${BLUE}🧹 [1/6] Membersihkan State Lokal & Cache...${NC}"
cd "$BACKEND_DIR/.." 
git reset --hard HEAD > /dev/null 2>&1 || true
git clean -fd > /dev/null 2>&1 || true

echo -e "${CYAN}📥 [2/6] Sinkronisasi GitHub Repo [origin/main]...${NC}"
git pull origin main

echo -e "${YELLOW}🚧 [3/6] Merakit Antarmuka Web (Compiling High-Density UI)...${NC}"
npm install --no-audit --no-fund --loglevel error
npm run build

echo -e "${BLUE}🚚 [4/6] Sinkronisasi Artifact ke Backend...${NC}"
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Gagal merakit Web UI (folder dist tidak ditemukan).${NC}"
    exit 1
fi
rm -rf backend/dist
cp -r dist backend/

echo -e "${YELLOW}⚙️ [5/6] Konfigurasi Ulang Dependensi Backend...${NC}"
cd "$BACKEND_DIR"
npm install --no-audit --no-fund --loglevel error

echo -e "${GREEN}⚡ [6/6] Zero-Downtime Reload via PM2...${NC}"
# Diagnostic Check before reload
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "   [System] Port 3001 active, performing seamless reload."
else
    echo -e "   [System] Port 3001 idle, performing fresh start."
fi

# PM2 Strategy: Update ENV and restart gracefully
./node_modules/.bin/pm2 restart apixs-backend --update-env --max-memory-restart 1G || \
./node_modules/.bin/pm2 start server.ts --name apixs-backend --interpreter ./node_modules/.bin/tsx --max-memory-restart 1G

./node_modules/.bin/pm2 save > /dev/null

# --- 7. Sakti Integration (Post-Deploy Mastery) ---
echo -e "${CYAN}⚔️ [Final] Mengintegrasikan Perintah Sakti...${NC}"
if [ -f "$BACKEND_DIR/../sakti.sh" ]; then
    chmod +x "$BACKEND_DIR/../sakti.sh"
    # Auto-register alias if not present
    if ! grep -q "alias sakti=" ~/.bashrc; then
        echo "alias sakti='bash $BACKEND_DIR/../sakti.sh'" >> ~/.bashrc
        echo -e "   ✅ Alias 'sakti' berhasil didaftarkan. Gunakan 'source ~/.bashrc' untuk aktifkan."
    fi
fi

# Cleanup DB state after deploy
sqlite3 "$BACKEND_DIR/streamflow.db" "VACUUM; ANALYZE; PRAGMA optimize;" > /dev/null 2>&1 || true

echo -e "${PURPLE}────────────────────────────────────────────────────────────${NC}"
echo -e "${GREEN}✅ [UPLINK SUCCESS] ApixsLive Bekerja pada Peak Performance!${NC}"
echo -e "👉 Dashboard URL: ${CYAN}http://$(hostname -I | awk '{print $1}'):3001${NC}"
echo -e "${PURPLE}────────────────────────────────────────────────────────────${NC}"
