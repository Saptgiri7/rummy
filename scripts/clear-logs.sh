#!/usr/bin/env bash
set -e

# Clear logs and test artifacts to reclaim memory and disk space
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "🧹 Cleaning project logs and temporary test artifacts..."

# 1. Clear application logs
if [ -d "$REPO_ROOT/logs" ]; then
  LOG_SIZE_BEFORE=$(du -sh "$REPO_ROOT/logs" 2>/dev/null | cut -f1 || echo "0")
  echo "Current logs directory size: $LOG_SIZE_BEFORE"
  
  # Truncate all .log files so file descriptors remain valid for any running process
  find "$REPO_ROOT/logs" -type f -name "*.log" -exec truncate -s 0 {} +
  
  # Re-ensure .gitkeep exists
  touch "$REPO_ROOT/logs/.gitkeep"
  echo "✓ Cleared all .log files in $REPO_ROOT/logs"
fi

# 2. Clear Playwright artifacts
if [ -d "$REPO_ROOT/apps/web/test-results" ]; then
  rm -rf "$REPO_ROOT/apps/web/test-results"
  echo "✓ Removed Playwright test-results"
fi

if [ -d "$REPO_ROOT/apps/web/playwright-report" ]; then
  rm -rf "$REPO_ROOT/apps/web/playwright-report"
  echo "✓ Removed Playwright report artifacts"
fi

if [ -d "$REPO_ROOT/test-results" ]; then
  rm -rf "$REPO_ROOT/test-results"
  echo "✓ Removed root test-results"
fi

# 3. Synchronize filesystem buffers
sync 2>/dev/null || true

echo "✨ Log cleanup complete. Memory and disk space freed successfully."
