#!/usr/bin/env bash
# =============================================================================
# stop.sh : Stop all Rummy platform services
# =============================================================================
# Usage:
#   bash scripts/stop.sh            # Stop app services + Docker containers
#   bash scripts/stop.sh --keep-db  # Stop apps but keep Docker running
#   bash scripts/stop.sh --wipe     # Stop everything + wipe Docker volumes
#   bash scripts/stop.sh --help     # Show help
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
LOGS_DIR="$ROOT_DIR/logs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

print_step()  { echo -e "${CYAN}▸ $1${NC}"; }
print_ok()    { echo -e "${GREEN}✔ $1${NC}"; }
print_warn()  { echo -e "${YELLOW}⚠ $1${NC}"; }

show_help() {
  echo ""
  echo "Usage: bash scripts/stop.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --keep-db   Stop app servers but keep Docker containers running"
  echo "  --wipe      Stop everything AND wipe Docker volumes (full reset)"
  echo "  --help      Show this help message"
  echo ""
  echo "Default: Stops app servers + Docker containers (preserves volumes)"
  echo ""
  exit 0
}

# Parse flags
KEEP_DB=false
WIPE_VOLUMES=false

for arg in "$@"; do
  case $arg in
    --keep-db)  KEEP_DB=true ;;
    --wipe)     WIPE_VOLUMES=true ;;
    --help|-h)  show_help ;;
    *) echo "Unknown option: $arg"; show_help ;;
  esac
done

# ─── Stop Node app processes ─────────────────────────────────────────────────
print_step "Stopping application servers..."

# Kill via PID files if available
for svc in server web; do
  PID_FILE="$LOGS_DIR/$svc.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
      print_ok "Stopped $svc (PID: $PID)"
    fi
    rm -f "$PID_FILE"
  fi
done

# Also kill any stray processes
pkill -f "tsx.*apps/server" 2>/dev/null || true
pkill -f "vite.*apps/web" 2>/dev/null || true
pkill -f "node.*rummy.*server" 2>/dev/null || true
pkill -f "node.*rummy.*web" 2>/dev/null || true
sleep 1

print_ok "Application servers stopped"

# ─── Stop Docker Infrastructure ──────────────────────────────────────────────
if [ "$KEEP_DB" = false ]; then
  if [ "$WIPE_VOLUMES" = true ]; then
    print_step "Stopping Docker containers AND wiping volumes..."
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>&1
    print_ok "Docker containers stopped : volumes wiped (clean slate)"
  else
    print_step "Stopping Docker containers (preserving volumes)..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>&1
    print_ok "Docker containers stopped : data preserved"
  fi
else
  print_warn "Docker containers left running (--keep-db)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🛑 Rummy Platform : All Services Stopped${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
if [ "$WIPE_VOLUMES" = true ]; then
  echo -e "  ${YELLOW}Docker volumes wiped : run migrations on next start${NC}"
  echo -e "  Next: ${CYAN}pnpm start -- --migrate${NC}"
elif [ "$KEEP_DB" = true ]; then
  echo -e "  ${YELLOW}Docker infra still running${NC}"
  echo -e "  Next: ${CYAN}pnpm start -- --no-infra${NC}"
else
  echo -e "  Next: ${CYAN}pnpm start${NC}"
fi
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
