# Codebase Master Navigation Index

Welcome to the **Rummy** codebase. This document serves as the single source of truth for repository structure, module responsibilities, and where to locate code and features.

---

## 1. Quick Navigation Matrix

| Topic / Domain | Primary Location | Key Files / Subdirectories |
| :--- | :--- | :--- |
| **Pure Game Engine Logic** | `packages/engine/` | `src/deck.ts`, `src/evaluator.ts`, `src/fsm.ts`, `src/scoring.ts` |
| **Shared Network Contracts & Types**| `packages/shared/` | `src/types/card.ts`, `src/types/protocol.ts`, `src/schemas/*.ts` |
| **PostgreSQL Schema & Repositories**| `packages/database/` | `src/schema/`, `drizzle.config.ts`, `src/repositories/` |
| **Redis Clients & Distributed Locks**| `packages/redis/` | `src/client.ts`, `src/locks.ts`, `src/keys.ts`, `src/pubsub.ts` |
| **HTTP REST API (Express)** | `apps/server/` | `src/routes/auth.ts`, `src/routes/room.ts`, `src/middleware/` |
| **WebSocket Real-Time Server** | `apps/server/` | `src/ws/server.ts`, `src/ws/handlers/`, `src/ws/rooms.ts` |
| **Matchmaking Service** | `apps/server/` (or worker) | `src/matchmaking/queue.ts`, `src/matchmaking/worker.ts` |
| **Frontend UI (React + Tailwind)** | `apps/web/` | `src/components/table/`, `src/hooks/useGameSocket.ts`, `src/pages/`|
| **Local Infrastructure & Docker** | `docker/` | `docker-compose.yml`, local postgres & redis volumes |
| **Architecture Documentation** | `docs/` | `architecture/`, `build-plan.md`, `setup.md`, `progress.md` |
| **Agent Governance Rules** | Root | `.skills`, `.permissions` |

---

## 2. Monorepo Structure Detailed Breakdown

### 2.1 Applications (`apps/`)

#### `apps/server` (Primary Real-Time & API Host)
- **Role**: Coordinates incoming HTTP requests and maintains persistent WebSocket connections for real-time multiplayer tables.
- **Key Modules**:
  - `src/http/`: Express route handlers (auth, user profiles, room listings, stats).
  - `src/ws/`: Native WebSocket router, upgrade hook, connection session manager, and ping-pong heartbeat monitor.
  - `src/orchestration/`: Room lifecycle coordinator, turn timer runner, turn locks, and bridge to `packages/engine`.

#### `apps/web` (Client Web Application)
- **Role**: High-performance React 19 SPA built with Vite, TypeScript, and Tailwind CSS.
- **Key Modules**:
  - `src/components/card/`: Playing card renderers, Joker indicators, drag-and-drop meld sorters.
  - `src/components/table/`: 2-to-6 seat table canvas, turn timer indicators, open/closed deck piles.
  - `src/hooks/`: `useGameSocket.ts` (manages reconnect, message buffering, and typed dispatch), `useAuth.ts`.
  - `src/stores/`: Local optimistic state reducers for meld organization and audio effects.

---

### 2.2 Packages (`packages/`)

#### `packages/engine` (Pure Rummy Domain Engine)
- **Role**: Pure mathematical and logical implementation of 13-Card Indian Rummy rules. Zero runtime network or database dependencies.
- **Key Files**:
  - `src/models/`: `Card`, `Deck`, `Hand`, `Meld` representations.
  - `src/rules/pure-sequence.ts`: Consecutive suit card evaluator (strict no-joker).
  - `src/rules/impure-sequence.ts`: Consecutive suit evaluator with wildcard & printed jokers.
  - `src/rules/sets.ts`: Valid sets (same rank, different suits).
  - `src/rules/declaration.ts`: Validation of 13-card hand (minimum 2 sequences, 1 pure).
  - `src/rules/scoring.ts`: Penalty point calculator (first drop = 20, middle drop = 40, bogus show = 80, hand points up to 80).
  - `src/fsm/`: Deterministic state transitions (DEALING -> TURN_DRAW -> TURN_DISCARD -> FINISHED).

#### `packages/shared` (DTOs & Protocols)
- **Role**: Single source of truth for cross-boundary network typing.
- **Key Files**:
  - `src/protocol/client-messages.ts`: Inbound client event interfaces (`DRAW_CARD`, `DISCARD_CARD`, `DECLARE_SHOW`, `DROP_HAND`).
  - `src/protocol/server-messages.ts`: Outbound server events (`GAME_SNAPSHOT`, `TURN_UPDATE`, `ROUND_ENDED`, `ERROR`).
  - `src/dtos/`: REST API schemas and Zod validators.

#### `packages/database` (Data Persistence Layer)
- **Role**: Manages durable records via Drizzle ORM and PostgreSQL.
- **Key Files**:
  - `src/schema/users.ts`: Accounts, emails, passwords, avatars.
  - `src/schema/matches.ts`: Completed game records, scores, round logs.
  - `src/schema/wallets.ts`: User chip balances and audit ledger.
  - `src/migrations/`: Generated Drizzle SQL migration files.

#### `packages/redis` (Real-time In-Memory Infrastructure)
- **Role**: Encapsulates Redis operations, atomic Lua scripts, and lock managers.
- **Key Files**:
  - `src/locks.ts`: Distributed mutex implementation for atomic room updates.
  - `src/keys.ts`: Structured key template helpers.
  - `src/room-store.ts`: Serialized state retrieval and write-through helpers.

---

## 3. Legacy Prototype References

> [!WARNING]
> The repository previously contained experimental prototypes and disconnected directories (`apps/auth-service`, `packages/utils`, `notes/`).
> Per architecture discovery, these legacy prototypes are treated as **reference material only** and will be cleanly refactored into the structured topology above.
