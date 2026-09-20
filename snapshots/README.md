# Project Snapshot — Stage 8 Multiplayer & Platform Hardening

- **Snapshot Name**: `snapshot/stage-8-stable`
- **Git Tag**: `v1.0.0-multiplayer-stable`
- **Timestamp**: 2026-09-20T19:25:00+05:30
- **Status**: Production Verified (0 type errors, 76 unit tests passed, Playwright browser E2E passed in 4.0s)

---

## 📦 What Is Preserved in This Snapshot

1. **Full 13-Card Indian Rummy Game Engine**:
   - 106-card deck management, wild joker cut cards, pure sequence validation, sets, drops (20/40 pts), and 80-point unmelded scoring.
2. **Zero-Chip Room Creation & Friend Sharing**:
   - 2-player and 6-player table configuration with 6-character room codes (`RUMXXX`).
   - Real-time waiting lobby synchronization via WebSockets.
3. **Turn Loop & Auto-Turn Timeout**:
   - 30-second turn countdown timer, auto-draw and auto-discard on expiry.
   - Distinct Turn Status Banner (`#turn-status-banner`) with green draw radar and gold discard instructions.
4. **React 19 Frontend**:
   - Tab-isolated guest authentication (`sessionStorage`).
   - Anti-vibe design engineering: authentic casino felt, tactile playing cards, tabular numbers for timers.
5. **Infrastructure & Knowledge Infrastructure**:
   - PostgreSQL schema (`snapshots/schema.sql`).
   - Redis caching and Redlock distributed mutex.
   - Comprehensive Knowledge Graph (`docs/knowledge-graph.md`) and Memory Graph (`docs/memory-graph.md`).
   - Automated log cleanup script (`scripts/clear-logs.sh` / `pnpm clear:logs`).
   - Anti-vibe UI design skill (`.agents/skills/anti-vibe-design/`) and UI/UX Pro Max (`.agents/skills/ui-ux-pro-max/`).

---

## 🔄 How to Restore to This Snapshot

If future changes cause regressions or unintended behavior, run the following commands to revert to this exact working state:

### 1. Revert Code via Git
```bash
# Option A: Switch to dedicated snapshot branch
git checkout snapshot/stage-8-stable

# Option B: Or reset current branch directly to tag
git reset --hard v1.0.0-multiplayer-stable
```

### 2. Reset Database to Snapshot Schema
```bash
# 1. Reset Docker containers and volumes
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d

# 2. Wait 3 seconds, then apply the snapshot schema
sleep 3
docker exec -i rummy-postgres psql -U postgres -d rummy_dev < snapshots/schema.sql
```

### 3. Re-install Dependencies & Rebuild
```bash
pnpm install
pnpm -r build
```

### 4. Verify System Health
```bash
# Run all unit tests
pnpm -r test

# Run full browser E2E automation
pnpm test:e2e
```
