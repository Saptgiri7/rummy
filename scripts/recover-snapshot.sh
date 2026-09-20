#!/usr/bin/env bash
set -e

# ==============================================================================
# 13-Card Indian Rummy: Snapshot Recovery Script
# Target Snapshot: v1.0.0-multiplayer-stable (Stage 8 Verified Baseline)
# ==============================================================================

SNAPSHOT_TAG="v1.0.0-multiplayer-stable"
SNAPSHOT_BRANCH="snapshot/stage-8-stable"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FORCE=false
SKIP_VERIFY=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -y|--yes|--force) FORCE=true ;;
    --skip-verify) SKIP_VERIFY=true ;;
    -h|--help)
      echo "Usage: ./scripts/recover-snapshot.sh [OPTIONS]"
      echo ""
      echo "Restores the codebase, git working tree, and PostgreSQL database to the"
      echo "verified Stage 8 stable multiplayer snapshot ($SNAPSHOT_TAG)."
      echo ""
      echo "Options:"
      echo "  -y, --yes, --force   Bypass interactive confirmation prompts"
      echo "  --skip-verify        Skip running unit tests after restoration"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run './scripts/recover-snapshot.sh --help' for usage."
      exit 1
      ;;
  esac
  shift
done

echo "================================================================================"
echo "🚨 RUMMY SNAPSHOT RECOVERY UTILITY"
echo "Target: $SNAPSHOT_TAG ($SNAPSHOT_BRANCH)"
echo "Repo:   $REPO_ROOT"
echo "================================================================================"

# Confirm before proceeding if running interactively
if [ "$FORCE" = false ] && [ -t 0 ]; then
  echo ""
  echo "⚠️  WARNING: This will:"
  echo "  1. Stash any uncommitted local changes."
  echo "  2. Reset your local repository to $SNAPSHOT_TAG."
  echo "  3. Tear down and recreate docker containers with fresh volumes."
  echo "  4. Apply snapshots/schema.sql to PostgreSQL."
  echo "  5. Reinstall dependencies, build packages, and clear logs."
  echo ""
  read -p "Are you sure you want to proceed with recovery? [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "❌ Recovery aborted by user."
    exit 0
  fi
fi

# Step 1: Pre-flight checks
echo ""
echo "🔍 [1/7] Performing pre-flight checks..."
if ! command -v git >/dev/null 2>&1; then
  echo "❌ Error: git is not installed or not in PATH."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Error: docker is not installed or not in PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "❌ Error: Docker daemon is not running or accessible."
  exit 1
fi

if [ ! -f "$REPO_ROOT/snapshots/schema.sql" ]; then
  echo "❌ Error: $REPO_ROOT/snapshots/schema.sql not found."
  exit 1
fi
echo "✓ Pre-flight checks passed."

# Step 2: Handle Git tree & revert to snapshot tag
echo ""
echo "📦 [2/7] Restoring git tree to $SNAPSHOT_TAG..."
if [ -n "$(git status --porcelain)" ]; then
  STASH_MSG="Auto-stash before snapshot recovery $(date +%s)"
  echo "  Uncommitted changes detected. Stashing to '$STASH_MSG'..."
  git stash push -m "$STASH_MSG"
fi

echo "  Checking out $SNAPSHOT_TAG..."
git checkout "$SNAPSHOT_TAG" || {
  echo "  Tag checkout failed, attempting branch $SNAPSHOT_BRANCH..."
  git checkout "$SNAPSHOT_BRANCH"
}
echo "✓ Git working tree successfully restored to snapshot commit $(git rev-parse --short HEAD)."

# Step 3: Reset Docker containers and purge volumes
echo ""
echo "🐳 [3/7] Rebuilding Docker infrastructure and volumes..."
docker compose -f docker/docker-compose.yml down -v --remove-orphans
docker compose -f docker/docker-compose.yml up -d

echo "  Waiting for PostgreSQL (rummy-postgres) to accept connections..."
MAX_TRIES=30
TRIES=0
until docker exec rummy-postgres pg_isready -U postgres -d rummy_dev >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_TRIES" ]; then
    echo "❌ Error: PostgreSQL failed to become ready after $MAX_TRIES seconds."
    exit 1
  fi
  sleep 1
done
echo "✓ Docker containers up and PostgreSQL is healthy."

# Step 4: Seed snapshot database schema
echo ""
echo "🗄️  [4/7] Applying database snapshot schema (snapshots/schema.sql)..."
docker exec -i rummy-postgres psql -U postgres -d rummy_dev < "$REPO_ROOT/snapshots/schema.sql" >/dev/null

TABLES_COUNT=$(docker exec -i rummy-postgres psql -U postgres -d rummy_dev -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "✓ Schema applied successfully ($TABLES_COUNT public tables verified)."

# Step 5: Install dependencies and rebuild
echo ""
echo "🔨 [5/7] Installing dependencies and rebuilding packages..."
pnpm install --frozen-lockfile=false
pnpm -r build
echo "✓ Dependencies installed and packages built."

# Step 6: Log & Memory Hygiene
echo ""
echo "🧹 [6/7] Running log and memory cleanup..."
bash "$REPO_ROOT/scripts/clear-logs.sh"
echo "✓ Cleaned logs and test artifacts."

# Step 7: Verification
echo ""
echo "🧪 [7/7] Verifying restored snapshot..."
if [ "$SKIP_VERIFY" = false ]; then
  echo "  Running unit & integration test suites (pnpm -r test)..."
  pnpm -r test
  echo "✓ All test suites passed!"
else
  echo "  Skipping test verification (--skip-verify specified)."
fi

echo ""
echo "================================================================================"
echo "✅ SNAPSHOT RECOVERY COMPLETE!"
echo "System has been restored to: $SNAPSHOT_TAG"
echo "Commit: $(git rev-parse HEAD)"
echo "================================================================================"
echo ""
echo "To start services and play:"
echo "  1. Backend API & WebSocket server:"
echo "     pnpm --filter @rummy/server dev"
echo "  2. Web Client (in another terminal):"
echo "     pnpm --filter @rummy/web dev"
echo "  3. Open browser at http://localhost:3000"
echo ""
