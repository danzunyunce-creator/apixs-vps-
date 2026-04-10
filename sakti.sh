#!/bin/bash
# ⚔️ SAKTI: Ultimate Command for ApixsLive VPS Management
# Created by Antigravity (Senior AI SE)

set -e

# --- Color Constants ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
B_CYAN='\033[1;36m'
B_GREEN='\033[1;32m'
NC='\033[0m' # No Color

# --- Directory Config ---
PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
# Use backend as default if already inside backend/ or dist/
if [[ "$PROJECT_ROOT" == *"/backend"* ]]; then
    BACKEND_DIR="$PROJECT_ROOT"
    PROJECT_ROOT=$(dirname "$PROJECT_ROOT")
fi

# --- Helper Functions ---
function print_header() {
    clear
    echo -e "${PURPLE}┌────────────────────────────────────────────────────────┐${NC}"
    echo -e "${PURPLE}│${NC}  ${B_CYAN}ApixsLive ⚔️  SAKTI UTILITY v1.0.0${NC}                      ${PURPLE}│${NC}"
    echo -e "${PURPLE}├────────────────────────────────────────────────────────┤${NC}"
    echo -e "${PURPLE}│${NC}  Admin: $(whoami)@$(hostname)                              ${PURPLE}│${NC}"
    echo -e "${PURPLE}│${NC}  Root:  $PROJECT_ROOT                                   ${PURPLE}│${NC}"
    echo -e "${PURPLE}└────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

function show_help() {
    echo -e "${YELLOW}Usage:${NC} sakti [command]"
    echo ""
    echo -e "${B_CYAN}Operational Commands:${NC}"
    echo -e "  ${GREEN}status${NC}     - Dashboard kesehatan system (CPU, RAM, Streams)"
    echo -e "  ${GREEN}logs${NC}       - Lihat log realtime (PM2 backend logs)"
    echo -e "  ${GREEN}restart${NC}    - Restart engine siaran"
    echo -e "  ${GREEN}deploy${NC}     - Jalankan 'gas.sh' (CI/CD Update from GitHub)"
    echo ""
    echo -e "${B_CYAN}Maintenance Commands:${NC}"
    echo -e "  ${GREEN}clean${NC}      - Optimasi DB, bunuh zombie ffmpeg, rotasi log"
    echo -e "  ${GREEN}fix${NC}        - Diagnosis & Perbaikan port otomatis"
    echo -e "  ${GREEN}config${NC}     - Lihat konfigurasi aplikasi (Masked)"
    echo ""
}

# --- Core Logic ---
case "$1" in
    status)
        print_header
        echo -e "${BLUE}📊 System Real-time Snapshot:${NC}"
        echo -e "----------------------------------------"
        # 1. CPU & RAM
        CPU_LOAD=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
        RAM_LOAD=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
        echo -e "🔥 CPU Load: ${B_CYAN}${CPU_LOAD}%${NC}"
        echo -e "🧠 RAM Usage: ${B_CYAN}${RAM_LOAD:0:5}%${NC}"
        
        # 2. Streams Count
        if [ -f "$BACKEND_DIR/streamflow.db" ]; then
            STREAMS_COUNT=$(sqlite3 "$BACKEND_DIR/streamflow.db" "SELECT COUNT(*) FROM streams WHERE status='RUNNING';")
            TOTAL_COUNT=$(sqlite3 "$BACKEND_DIR/streamflow.db" "SELECT COUNT(*) FROM streams;")
            echo -e "🎥 Active Streams: ${GREEN}$STREAMS_COUNT${NC} / $TOTAL_COUNT"
        else
            echo -e "⚠️ DB Not found at $BACKEND_DIR/streamflow.db"
        fi

        # 3. PM2 Status
        echo -e "----------------------------------------"
        echo -e "${YELLOW}PM2 Process Table:${NC}"
        "$BACKEND_DIR/node_modules/.bin/pm2" list | grep "apixs-backend" || echo "   Process Not Running"
        echo -e "----------------------------------------"
        ;;

    logs)
        echo -e "${PURPLE}📡 Tailing PM2 Logs for apixs-backend...${NC}"
        "$BACKEND_DIR/node_modules/.bin/pm2" logs apixs-backend --lines 50
        ;;

    restart)
        echo -e "${YELLOW}♻️ Restarting ApixsLive Backend Engine...${NC}"
        "$BACKEND_DIR/node_modules/.bin/pm2" restart apixs-backend --update-env
        echo -e "${GREEN}✅ Restart Success!${NC}"
        ;;

    deploy)
        if [ -f "$BACKEND_DIR/gas.sh" ]; then
            echo -e "${B_CYAN}🚀 Executing ULTIMATE PIPELINE (gas.sh)...${NC}"
            bash "$BACKEND_DIR/gas.sh"
        else
            echo -e "${RED}❌ gas.sh not found in $BACKEND_DIR${NC}"
        fi
        ;;

    clean)
        echo -e "${BLUE}🧹 Unified Maintenance Cycle Star...${NC}"
        
        # 1. Vacuum SQLite
        if [ -f "$BACKEND_DIR/streamflow.db" ]; then
            echo -e "   📦 Optimizing Database (VACUUM)..."
            sqlite3 "$BACKEND_DIR/streamflow.db" "VACUUM; ANALYZE; PRAGMA optimize;"
        fi

        # 2. Kill Zombie FFmpeg
        echo -e "   🏹 Reaping Zombie FFmpeg processes..."
        pkill -u $(whoami) ffmpeg || true
        
        # 3. PM2 Flush
        echo -e "   🗒️ Rotating PM2 logs..."
        "$BACKEND_DIR/node_modules/.bin/pm2" flush > /dev/null
        
        echo -e "${GREEN}✅ [MAINTENANCE OK] System is fresh and light!${NC}"
        ;;

    fix)
        echo -e "${YELLOW}🛠️ Diagnostic Mode:${NC}"
        # Port check
        if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
            echo -e "   ⚠️ Port 3001 is ALREADY in use."
            read -p "   Do you want to kill the blocking process? (y/n) " resp
            if [ "$resp" == "y" ]; then
                lsof -ti:3001 | xargs kill -9
                echo -e "   ✅ Port cleared."
            fi
        else
            echo -e "   ✅ Port 3001 is available."
        fi
        ;;

    config)
        echo -e "${BLUE}⚙️ Loaded Application Config:${NC}"
        if [ -f "$PROJECT_ROOT/.env" ]; then
            grep -v "PASSWORD\|KEY\|SECRET\|TOKEN" "$PROJECT_ROOT/.env"
            echo "   (Sensitive keys are hidden for safety)"
        else
            echo "   .env not found!"
        fi
        ;;

    *)
        print_header
        show_help
        ;;
esac
