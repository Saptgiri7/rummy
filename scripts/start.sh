#!/usr/bin/env bash
# =============================================================================
# start.sh : Start all Rummy platform services
# =============================================================================
# Usage:
#   bash scripts/start.sh           # Start Docker infra + backend + frontend
#   bash scripts/start.sh --infra   # Start only Docker infrastructure
#   bash scripts/start.sh --help    # Show help
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
print_error() { echo -e "${RED}✘ $1${NC}"; }

show_help() {
  echo ""
  echo "Usage: bash scripts/start.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --infra       Start only Docker infrastructure (PostgreSQL & Redis)"
  echo "  --no-infra    Skip Docker infrastructure (assume already running)"
  echo "  --migrate     Run database migrations after starting infrastructure"
  echo "  --help        Show this help message"
  echo ""
  echo "Examples:"
  echo "  bash scripts/start.sh                  # Full startup"
  echo "  bash scripts/start.sh --infra          # Infrastructure only"
  echo "  bash scripts/start.sh --migrate        # Full startup + run migrations"
  echo "  bash scripts/start.sh --no-infra       # Backend + frontend only"
  echo ""
  exit 0
}

# Parse flags
INFRA_ONLY=false
SKIP_INFRA=false
RUN_MIGRATE=false

for arg in "$@"; do
  case $arg in
    --infra)     INFRA_ONLY=true ;;
    --no-infra)  SKIP_INFRA=true ;;
    --migrate)   RUN_MIGRATE=true ;;
    --help|-h)   show_help ;;
    *) print_error "Unknown option: $arg"; show_help ;;
  esac
done

# ─── Pre-flight checks ───────────────────────────────────────────────────────
print_step "Pre-flight checks..."

if ! command -v docker &>/dev/null; then
  print_error "Docker is not installed. Please install Docker first."
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  print_error "pnpm is not installed. Please install pnpm first."
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  print_error "Docker daemon is not running. Please start Docker first."
  exit 1
fi

print_ok "Pre-flight checks passed"

# ─── Ensure logs directory exists ─────────────────────────────────────────────
mkdir -p "$LOGS_DIR"
touch "$LOGS_DIR/.gitkeep"

# ─── Start Docker Infrastructure ─────────────────────────────────────────────
if [ "$SKIP_INFRA" = false ]; then
  print_step "Starting Docker infrastructure (PostgreSQL & Redis)..."

  # Check if containers are already running
  if docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q "rummy-postgres"; then
    print_warn "Docker containers already running : skipping startup"
  else
    docker compose -f "$COMPOSE_FILE" up -d 2>&1
    print_ok "Docker containers started"
  fi

  # Wait for PostgreSQL to accept connections
  print_step "Waiting for PostgreSQL to be ready..."
  RETRIES=30
  until docker exec rummy-postgres pg_isready -U rummy_user -d rummy_db -q 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
      print_error "PostgreSQL did not become ready within 30 seconds"
      exit 1
    fi
    sleep 1
  done
  print_ok "PostgreSQL is accepting connections"

  # Wait for Redis
  print_step "Waiting for Redis to be ready..."
  RETRIES=15
  until docker exec rummy-redis redis-cli ping 2>/dev/null | grep -q "PONG"; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
      print_error "Redis did not become ready within 15 seconds"
      exit 1
    fi
    sleep 1
  done
  print_ok "Redis is accepting connections"
fi

if [ "$INFRA_ONLY" = true ]; then
  echo ""
  print_ok "Infrastructure is up! (--infra mode, skipping app services)"
  echo -e "  PostgreSQL: ${GREEN}localhost:5432${NC}"
  echo -e "  Redis:      ${GREEN}localhost:6379${NC}"
  exit 0
fi

# ─── Run migrations if requested ─────────────────────────────────────────────
if [ "$RUN_MIGRATE" = true ]; then
  print_step "Running database migrations..."
  cd "$ROOT_DIR"
  pnpm --filter @rummy/database db:migrate 2>&1
  print_ok "Database migrations applied"
fi

# ─── Kill any leftover Node processes from previous runs ──────────────────────
print_step "Cleaning up stale Node processes..."
pkill -f "tsx.*apps/server" 2>/dev/null || true
pkill -f "vite.*apps/web" 2>/dev/null || true
sleep 1
print_ok "Stale processes cleaned"

# ─── Start Backend Server ────────────────────────────────────────────────────
print_step "Starting backend server (port 4000)..."
cd "$ROOT_DIR"
nohup pnpm --filter @rummy/server dev > "$LOGS_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$LOGS_DIR/server.pid"

# Wait for backend to bind
RETRIES=20
until curl -s http://localhost:4000/api/auth/guest -X POST -H "Content-Type: application/json" -d '{}' >/dev/null 2>&1 || lsof -i :4000 -sTCP:LISTEN >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    print_warn "Backend may still be starting : check logs/server.log"
    break
  fi
  sleep 1
done
print_ok "Backend server started (PID: $SERVER_PID)"

# ─── Start Frontend Dev Server ───────────────────────────────────────────────
print_step "Starting frontend dev server (port 3000)..."
cd "$ROOT_DIR"
nohup pnpm --filter @rummy/web dev > "$LOGS_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" > "$LOGS_DIR/web.pid"

# Wait for Vite to bind
RETRIES=15
until curl -s http://localhost:3000 >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    print_warn "Frontend may still be starting : check logs/web.log"
    break
  fi
  sleep 1
done
print_ok "Frontend dev server started (PID: $WEB_PID)"

# ─── Extract Vite Network URL ────────────────────────────────────────────────
NETWORK_URLS=()
RETRIES=10
while [ $RETRIES -gt 0 ]; do
  if [ -f "$LOGS_DIR/web.log" ]; then
    # Grab network URLs, prioritizing real LAN addresses over docker bridges (172.x)
    mapfile -t NETWORK_URLS < <(grep -oP 'Network:\s+\K(https?://[0-9.]+:[0-9]+/?)' "$LOGS_DIR/web.log" 2>/dev/null | grep -v '://172\.')
    if [ ${#NETWORK_URLS[@]} -eq 0 ]; then
      mapfile -t NETWORK_URLS < <(grep -oP 'Network:\s+\K(https?://[0-9.]+:[0-9]+/?)' "$LOGS_DIR/web.log" 2>/dev/null)
    fi
    if [ ${#NETWORK_URLS[@]} -gt 0 ]; then
      break
    fi
  fi
  RETRIES=$((RETRIES - 1))
  sleep 1
done

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🃏 Rummy Platform : All Services Running${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "  PostgreSQL:  ${CYAN}localhost:5432${NC}"
echo -e "  Redis:       ${CYAN}localhost:6379${NC}"
echo -e "  Backend API: ${CYAN}http://localhost:4000${NC}"
echo -e "  Frontend:    ${CYAN}http://localhost:3000${NC}"
for url in "${NETWORK_URLS[@]}"; do
  echo -e "  Network:     ${CYAN}${url}${NC}"
done
echo ""
echo -e "  Server log:  ${YELLOW}logs/server.log${NC}"
echo -e "  Web log:     ${YELLOW}logs/web.log${NC}"
echo ""
echo -e "  Stop all:    ${CYAN}pnpm stop${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
