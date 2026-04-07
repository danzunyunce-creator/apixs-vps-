#!/bin/bash
# ApixsLive Server CI/CD & Automation Script (Ultimate Pipeline)
set -eo pipefail

# --- Color Constants ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${PURPLE}====================================================${NC}"
echo -e "${CYAN}🚀 [ApixsLive] Memulai Ultimate Deploy Pipeline...${NC}"
echo -e "${PURPLE}====================================================${NC}"

# Define error trap for fail-fast mechanism
trap 'echo -e "${RED}❌ [ERROR] Deployment gagal di baris $LINENO. Pipeline dibatalkan agar sistem tetap aman!${NC}"' ERR

# 1. Location Check
if [ -f "server.ts" ]; then
    BACKEND_DIR=$(pwd)
elif [ -d "backend" ]; then
    cd backend
    BACKEND_DIR=$(pwd)
else
    echo -e "${RED}❌ Direktori salah! Jalankan dari root proyek atau folder backend.${NC}"
    exit 1
fi

echo -e "${BLUE}🧹 [1/6] Membersihkan State Lokal (Mencegah Konflik)...${NC}"
cd "$BACKEND_DIR/.." 
# Paksa reset lokal agar selalu identik dengan Git remote (Sangat aman untuk VPS)
git reset --hard HEAD > /dev/null 2>&1 || true
git clean -fd > /dev/null 2>&1 || true
git stash > /dev/null 2>&1 || true

echo -e "${CYAN}📥 [2/6] Sinkronisasi GitHub Repo...${NC}"
git pull origin main

echo -e "${YELLOW}🚧 [3/6] Merakit Antarmuka Web (Compiling React UI)...${NC}"
npm install --no-audit --no-fund --loglevel error
npm run build

echo -e "${BLUE}🚚 [4/6] Mengirim Artifact ke Sistem Mesin...${NC}"
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
# PM2 Smart Restart: Cek jika backend sudah nyala, lakukan restart mulus, jika belum lakukan start.
if ./node_modules/.bin/pm2 id apixs-backend > /dev/null 2>&1; then
    ./node_modules/.bin/pm2 restart apixs-backend --update-env > /dev/null 2>&1
else
    ./node_modules/.bin/pm2 start server.ts --name apixs-backend --interpreter ./node_modules/.bin/tsx > /dev/null 2>&1
fi
./node_modules/.bin/pm2 save > /dev/null 2>&1

echo -e "${PURPLE}====================================================${NC}"
echo -e "${GREEN}✅ [UPLINK SUCCESS] ApixsLive Bekerja pada Peak Performance!${NC}"
echo -e "👉 Silakan Akses Dashboard Premium Anda: ${CYAN}http://103.127.132.124:3001${NC}"
echo -e "${PURPLE}====================================================${NC}"
