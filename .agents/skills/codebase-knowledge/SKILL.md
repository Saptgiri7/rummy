---
name: codebase-knowledge
description: >-
  Essential knowledge, architecture reference, and maintenance protocol for the
  13-Card Indian Rummy codebase. Use this skill whenever inspecting, modifying,
  refactoring, debugging, or adding features to any package or application in this repository.
---

# 13-Card Indian Rummy Codebase Knowledge & Maintenance Skill

This skill guides agents on navigating, developing, and maintaining the real-time 13-Card Indian Rummy platform.

---

## ⚠️ MANDATORY SYNCHRONIZATION DIRECTIVE

> [!IMPORTANT]
> **CONTINUOUS KNOWLEDGE & MEMORY GRAPH UPDATES ARE MANDATORY:**
> Whenever you modify code, implement new features, alter schemas, add WebSocket events, adjust game rules, or fix bugs in this codebase, you **MUST** update the following two canonical graph documents:
> 1. [docs/knowledge-graph.md](file:///home/saptgiri7/Desktop/rummy/docs/knowledge-graph.md) — Update the architecture graph, state machines, protocol message tables, entity relationships, or feature catalog.
> 2. [docs/memory-graph.md](file:///home/saptgiri7/Desktop/rummy/docs/memory-graph.md) — Document any new architectural decisions, failure modes, root causes discovered, bug patterns, or gotchas.
> 
> **Never complete a task with out-of-date graphs.**

---

## Codebase Map & Quick Orientation

- **Core Game Logic**: [packages/engine/src/](file:///home/saptgiri7/Desktop/rummy/packages/engine/src/)
  - `deck.ts`: 106-card two-deck composition, printed jokers, wild cut joker logic.
  - `validator.ts`: Pure sequences (required), impure sequences, sets, 80-point unmelded calculation.
  - `turn-manager.ts`: Deterministic turn transitions, auto-timeout play.
- **Protocol Contracts & Schemas**: [packages/shared/src/](file:///home/saptgiri7/Desktop/rummy/packages/shared/src/)
  - `schemas.ts`: Zod validation schemas for all client and server WebSocket messages.
  - `types.ts`: TypeScript interfaces for cards, players, room lobby, score items.
- **Database Layer**: [packages/database/src/](file:///home/saptgiri7/Desktop/rummy/packages/database/src/)
  - `schema/`: Drizzle ORM tables (`users`, `wallets`, `refresh_tokens`, `matches`, `match_players`).
  - `db.ts`: Connection pool management and health checks (`checkDbHealth`).
- **Redis Cache & Distributed Locks**: [packages/redis/src/](file:///home/saptgiri7/Desktop/rummy/packages/redis/src/)
  - `state.ts`: Sub-millisecond room state caching (`room:{roomId}:state`).
  - `lock.ts`: Redlock distributed mutex lock (`withLock`).
- **Real-Time WebSocket Server**: [apps/server/src/](file:///home/saptgiri7/Desktop/rummy/apps/server/src/)
  - `ws/server.ts`: HTTP & WebSocket connection gateway, token verification.
  - `ws/room-coordinator.ts`: Game lifecycle, turn timer management, room broadcast dispatch.
  - `ws/connection-registry.ts`: Multi-socket user registry and room connection pools.
  - `routes/auth.ts`: Registration, login, guest auth, JWT issuance.
- **Frontend Web App**: [apps/web/src/](file:///home/saptgiri7/Desktop/rummy/apps/web/src/)
  - `App.tsx`: Central view router, WebSocket message handler, state coordination.
  - `context/AuthContext.tsx`: Per-tab authentication (`sessionStorage`), automatic guest registration, token expiry checks (`isTokenExpired`).
  - `hooks/useWebSocket.ts`: WebSocket client with direct connection on port 4000 and 1008 session reset.
  - `components/Table/GameTable.tsx`: Full table felt, turn banner, and opponent layout.
  - `components/Table/CenterPiles.tsx`: Closed deck, wild cut joker, open discard pile, and finish slot.
  - `components/Table/PlayerHand.tsx`: Player's 13-14 cards, meld grouping, card selection, and auto-sort.

---

## Standard Development & Verification Workflows

### 1. Verification Checklist
After making any code changes, run these checks:
```bash
# 1. Typecheck all packages
pnpm -r typecheck

# 2. Run unit and integration tests (76+ tests)
pnpm -r test

# 3. Run browser E2E automated multiplayer test
pnpm test:e2e

# 4. Clean up service logs if large
pnpm clear:logs
```

### 2. Updating Knowledge & Memory Graphs Checklist
Before concluding your task:
1. Did you add or change any WebSocket frame types? -> Update Section 4 of `docs/knowledge-graph.md`.
2. Did you modify the database schema? -> Update Section 3 of `docs/knowledge-graph.md`.
3. Did you alter turn phases or engine rules? -> Update Section 2 & 5 of `docs/knowledge-graph.md`.
4. Did you fix a subtle bug or discover a failure mode? -> Add an entry to Section 2 of `docs/memory-graph.md`.
5. Did you make an architectural decision? -> Document context and rationale in Section 1 of `docs/memory-graph.md`.
