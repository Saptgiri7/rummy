# 13-Card Indian Rummy Platform — Memory Graph & Decision History

This document serves as the **persistent operational memory graph** of the project. It documents design decisions, architectural rationale, resolved failure modes, anti-patterns, and critical invariants. Any AI agent modifying this repository must review and update this document whenever new architectural decisions or bug patterns emerge.

---

## 1. Architectural Decisions & Rationale

### Decision 1: Pure Skill Points System (Zero Chip Barriers)
- **Context**: The user specified that friends should be able to create and join private rooms easily without requiring mock currency or chip balances.
- **Rationale**: Removed mandatory chip gates from room creation and join workflows. Match stakes and chip penalties are tracked for scorekeeping, but users can create and enter tables with 0 chips.
- **Invariant**: Never block room entry on wallet balance checks.

### Decision 2: Dual-Layer Persistence (Redis Hot State + Postgres Cold Storage)
- **Context**: Rummy requires sub-10ms turn response times and real-time state mutations, but match outcomes and player accounts must be audit-proof.
- **Rationale**:
  - All in-flight turn states (`gameState`, `playerHands`, discard piles, locks) reside in Redis (`room:{id}:state`).
  - Redlock distributed mutex (`room:{id}:lock`) guarantees serialized processing of concurrent draws/discards.
  - Final round outcomes, scores, and wallet balance deltas are committed transactionally to PostgreSQL upon round settlement.

### Decision 3: `sessionStorage` for Multi-Tab Local Testing
- **Context**: Developers and testers frequently open multiple tabs in the same browser window on `localhost:3000` to simulate multi-player tables.
- **Rationale**: `localStorage` is shared across all tabs in the same browser, which caused Tab 2 to overwrite Tab 1's authentication token and identity. Using `sessionStorage` isolates tokens strictly per-tab, allowing unlimited concurrent player instances on a single machine.

### Decision 4: Direct WebSocket Connection to Port 4000 in Local Dev
- **Context**: Vite's development proxy for WebSockets (`/ws`) occasionally dropped TCP socket connections with `EPIPE` under high-frequency message throughput.
- **Rationale**: In development mode (`port === 3000`), the client connects directly to `ws://localhost:4000/ws?token=...`, bypassing Vite proxy hops. In production, it connects to standard relative host `/ws`.

---

## 2. Failure Modes & Known Bug Patterns Catalog

| Failure Pattern | Root Cause | Symptoms | Permanent Fix Implemented |
|---|---|---|---|
| **PostgreSQL Schema Desync on Volume Reset** | Running `docker compose down -v` wipes Postgres data volumes. If Drizzle migrations are not applied directly, tables are missing. | Server throws `error: relation "users" does not exist` (code `42P01`) on registration. | Schema applied via `packages/database/drizzle/0000_wonderful_nova.sql`. Always verify `users` table exists upon volume reset. |
| **Expired JWT Infinite Handshake Loop** | Browser retained an expired token in storage. Client WS retried connection every 1.5s with the same expired token; server rejected with `1008 Unauthorized`. | WebSocket failed to open; user could not receive room codes; "Create Room" buttons were unresponsive. | Added `isTokenExpired()` in `AuthContext.tsx` to purge dead tokens client-side. Added code `1008` close handler in `useWebSocket.ts` to clear storage and reload cleanly. |
| **CSS Animation Click-Miss in Automated Tests** | CSS `@keyframes` on `.can-draw-pulse` animated `transform: translateY(-4px)`, constantly shifting element coordinates during test execution. | Playwright click on `#closed-draw-deck` dispatched at sub-pixel offset, missing the element or failing actionability. | Removed `transform` from draw pulse keyframes; pulse now uses purely static `drop-shadow` / `box-shadow` transitions. Clicks use `{ force: true }` in automated suites. |
| **Double-Firing Click Handlers** | Both parent `.deck-pile-slot` and inner `PlayingCard` had independent `onClick` handlers. | React event bubbling caused `DRAW_CARD` or `DISCARD_CARD` to be sent twice in the same tick; server threw `INVALID_PHASE`. | Centralized click handling on parent slot container with `e.stopPropagation()`; removed redundant inner card handlers. |
| **Unsynchronized Room Lobby State** | Participant joined via code, but host tab was not notified of participant arrival or match start. | Participant entered active game while host remained frozen in waiting lobby modal. | `roomService.broadcastLobbyUpdate` dispatches to all connections in room. Capacity check triggers `GAME_STARTED` simultaneously to both host and guest. |

---

## 3. Critical Invariants for Future Agents

1. **Schema & Event Sync**:
   - Any new WebSocket message type added in `packages/shared/src/schemas.ts` **must** have corresponding schema parsing in `server.ts` and UI state handling in `App.tsx`.
2. **Deterministic Engine Independence**:
   - `packages/engine/` must remain completely decoupled from network, database, or Redis libraries. It must remain 100% pure TypeScript.
3. **Pure Sequence First Rule**:
   - In Indian Rummy, no show is valid without at least one pure sequence (consecutive cards of same suit without jokers). Never relax this rule in `packages/engine/src/validator.ts`.
4. **Log Retention**:
   - When running long test runs, use `pnpm clear:logs` (`scripts/clear-logs.sh`) to prevent disk exhaustion.
5. **Continuous Graph Updates**:
   - Whenever any architectural, database, or feature change is made, update `docs/knowledge-graph.md` and `docs/memory-graph.md`.
