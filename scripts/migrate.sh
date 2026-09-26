#!/usr/bin/env bash
# =============================================================================
# migrate.sh : Generate and/or apply database migrations
# =============================================================================
# Usage:
#   bash scripts/migrate.sh              # Apply pending migrations
#   bash scripts/migrate.sh --generate   # Generate new migration from schema
#   bash scripts/migrate.sh --fresh      # Wipe volumes + apply from scratch
#   bash scripts/migrate.sh --help       # Show help
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"

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
  echo "Usage: bash scripts/migrate.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --generate   Generate a new migration SQL file from current schema"
  echo "  --fresh      Wipe Docker volumes, restart infra, and apply migrations"
  echo "  --status     Show current migration status"
  echo "  --help       Show this help message"
  echo ""
  echo "Default (no flags): Apply pending migrations to the running database."
  echo ""
  echo "Examples:"
  echo "  bash scripts/migrate.sh                # Apply pending migrations"
  echo "  bash scripts/migrate.sh --generate     # Generate migration from schema changes"
  echo "  bash scripts/migrate.sh --fresh        # Full reset + migrate (for schema redesigns)"
  echo ""
  exit 0
}

# Parse flags
DO_GENERATE=false
DO_FRESH=false
DO_STATUS=false

for arg in "$@"; do
  case $arg in
    --generate)  DO_GENERATE=true ;;
    --fresh)     DO_FRESH=true ;;
    --status)    DO_STATUS=true ;;
    --help|-h)   show_help ;;
    *) print_error "Unknown option: $arg"; show_help ;;
  esac
done

cd "$ROOT_DIR"

# ─── Generate migration from schema ──────────────────────────────────────────
if [ "$DO_GENERATE" = true ]; then
  print_step "Generating migration from current Drizzle schema..."
  pnpm --filter @rummy/database db:generate 2>&1
  print_ok "Migration file generated in packages/database/drizzle/"
  echo ""
  echo -e "  ${YELLOW}Review the generated SQL, then run:${NC}"
  echo -e "  ${CYAN}pnpm migrate${NC}  or  ${CYAN}bash scripts/migrate.sh${NC}"
  exit 0
fi

# ─── Fresh reset ─────────────────────────────────────────────────────────────
if [ "$DO_FRESH" = true ]; then
  print_step "Performing fresh database reset..."

  # Stop and wipe
  print_step "Wiping Docker volumes..."
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>&1
  print_ok "Volumes wiped"

  # Restart infra
  print_step "Starting fresh Docker infrastructure..."
  docker compose -f "$COMPOSE_FILE" up -d 2>&1
  print_ok "Docker containers started"

  # Wait for PostgreSQL
  print_step "Waiting for PostgreSQL..."
  RETRIES=30
  until docker exec rummy-postgres pg_isready -U rummy_user -d rummy_db -q 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
      print_error "PostgreSQL did not become ready within 30 seconds"
      exit 1
    fi
    sleep 1
  done
  print_ok "PostgreSQL ready"
fi

# ─── Verify database is reachable ─────────────────────────────────────────────
print_step "Verifying database connection..."
if ! docker exec rummy-postgres pg_isready -U rummy_user -d rummy_db -q 2>/dev/null; then
  print_error "PostgreSQL is not running. Start infrastructure first:"
  echo -e "  ${CYAN}pnpm start -- --infra${NC}"
  exit 1
fi
print_ok "Database is reachable"

# ─── Apply migrations ────────────────────────────────────────────────────────
print_step "Applying database migrations..."
pnpm --filter @rummy/database db:migrate 2>&1
print_ok "All migrations applied successfully"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🗄️  Database : Migrations Complete${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
if [ "$DO_FRESH" = true ]; then
  echo -e "  ${YELLOW}Fresh reset performed : all previous data cleared${NC}"
fi
echo -e "  Next: ${CYAN}pnpm start${NC}  or  ${CYAN}pnpm start -- --no-infra${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
