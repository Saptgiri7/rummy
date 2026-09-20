# 13-Card Indian Rummy Platform — Knowledge Graph

This document serves as the **comprehensive technical knowledge graph** of the 13-Card Indian Rummy codebase. It maps system components, boundaries, entity relationships, protocol states, game rules, and frontend workflows. Any AI agent or developer can use this graph to immediately orient themselves and execute changes safely and accurately.

---

## 1. System Architecture & Monorepo Graph

The platform is organized as a high-performance TypeScript monorepo managed with **pnpm** and **Turborepo**.

```mermaid
graph TD
    classDef client fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef server fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef core fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#fff;
    classDef infra fill:#1e293b,stroke:#ec4899,stroke-width:2px,color:#fff;

    Web["apps/web<br/>(React 19, Vite, Vanilla CSS)"]:::client
    Server["apps/server<br/>(Node.js, Express, ws, Redis PubSub)"]:::server
    
    Engine["packages/engine<br/>(Pure 13-Card Rummy Logic)"]:::core
    Shared["packages/shared<br/>(Zod Schemas, DTOs, Event Types)"]:::core
    Redis["packages/redis<br/>(State Cache, Redlock, Pub/Sub)"]:::infra
    Database["packages/database<br/>(PostgreSQL, Drizzle ORM)"]:::infra

    PostgresDB[(PostgreSQL 16)]:::infra
    RedisDB[(Redis 7)]:::infra

    Web -->|DTOs & Schemas| Shared
    Web -->|Pure Validation| Engine
    Web -->|HTTP / WebSocket| Server

    Server -->|Validation & Types| Shared
    Server -->|Card Engine| Engine
    Server -->|Fast State & Locks| Redis
    Server -->|Persistence| Database

    Database --> PostgresDB
    Redis --> RedisDB
```

### Monorepo Workspaces & Responsibilities

| Workspace | Directory | Technology | Primary Responsibility |
|---|---|---|---|
| `@rummy/shared` | `packages/shared/` | TypeScript, Zod | Canonical event contracts, client-server schemas, DTOs, error codes, game constants. |
| `@rummy/engine` | `packages/engine/` | Pure TypeScript (0 deps) | 106-card deck management, wild joker rules, pure/impure sequence validation, set validation, hand point scoring. |
| `@rummy/database` | `packages/database/` | PostgreSQL, Drizzle ORM, pg | Persistent data storage: users, wallets, match histories, refresh tokens, transactional mutations. |
| `@rummy/redis` | `packages/redis/` | Redis (ioredis), Redlock | Sub-millisecond game state cache, distributed mutex locking (`withLock`), turn timers, matchmaking queues. |
| `@rummy/server` | `apps/server/` | Express, `ws`, tsx, Winston | Real-time WebSocket gateway, room lobby coordinator, turn timer scheduling, matchmaking worker. |
| `@rummy/web` | `apps/web/` | React 19, Vite, Vanilla CSS | Responsive multiplayer web interface: casino felt table, turn status banners, room creation modal, guest auth. |

---

## 2. Real-Time Turn & Game State Machine

The game engine operates as a deterministic finite-state machine (FSM). State mutations are guarded by Redis distributed locks (`room:{roomId}:lock`).

```mermaid
stateDiagram-v2
    [*] --> LOBBY_WAITING: Host creates room (RUMXXX)
    LOBBY_WAITING --> LOBBY_WAITING: Friend joins via 6-char code
    LOBBY_WAITING --> GAME_STARTED: Table reaches capacity (2/6 players) or Host clicks Start
    
    state ActiveMatch {
        [*] --> WAITING_DRAW: Deal 13 cards + Cut Wild Joker + Open 1st Card
        
        WAITING_DRAW --> WAITING_DISCARD: DRAW_CARD (from Closed Deck or Open Pile)
        WAITING_DRAW --> ROUND_ENDED: DROP_HAND (First Drop: 20 pts)
        WAITING_DRAW --> WAITING_DISCARD: Turn timeout auto-draw top of closed deck
        
        WAITING_DISCARD --> WAITING_DRAW: DISCARD_CARD (Pass turn to next player)
        WAITING_DISCARD --> WAITING_DRAW: Turn timeout auto-discard highest unmelded card
        WAITING_DISCARD --> DECLARING: DECLARE_SHOW (1 card to Finish Slot + melds)
    }

    DECLARING --> ROUND_ENDED: Valid Show (0 pts for winner, calculate opponent penalties)
    DECLARING --> WAITING_DISCARD: Invalid Show (Wrong show penalty 80 pts applied)
    ROUND_ENDED --> LOBBY_WAITING: Match summary & rematch request
```

### Turn Lifecycle Details

1. **Turn Initialization**:
   - Duration: Default `30,000 ms` (tunable via `TURN_TIMEOUT_SECONDS`).
   - Server runs countdown; broadcasts active user to all connections in room.
2. **Draw Phase (`WAITING_DRAW`)**:
   - Player can tap **Closed Deck** (secret draw) or top card of **Open Pile** (visible draw).
   - Secret card identity is unicast to the active player via `CARD_DRAWN_PRIVATE`.
   - Public draw notice is broadcast to all opponents via `CARD_DRAWN_PUBLIC` (card identity hidden).
3. **Discard Phase (`WAITING_DISCARD`)**:
   - Player selects 1 card from hand (now 14 cards) and clicks **Discard** (moves card to open pile top) OR clicks **Finish Slot** for declaration.
   - Discard triggers `CARD_DISCARDED` and advances `activePlayerId` to `nextActivePlayerId`.
4. **Automatic Turn Timeout**:
   - If player does not act within 30s, server auto-draws from closed deck and auto-discards a non-joker card to keep game moving without stalling.

---

## 3. Database Entity-Relationship Graph

Managed via Drizzle ORM in `packages/database/src/schema/`.

```mermaid
erDiagram
    users ||--o{ wallets : "has one"
    users ||--o{ refresh_tokens : "owns"
    users ||--o{ match_players : "participates in"
    matches ||--o{ match_players : "contains"
    matches ||--o| users : "won by"

    users {
        uuid id PK
        varchar username UK
        varchar email UK
        text password_hash
        timestamp created_at
        timestamp updated_at
    }

    wallets {
        uuid id PK
        uuid user_id FK, UK
        integer chips
        timestamp updated_at
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        boolean is_revoked
        timestamp expires_at
        timestamp created_at
    }

    matches {
        uuid id PK
        varchar room_id UK
        varchar game_variant
        integer stake
        uuid winner_id FK
        timestamp started_at
        timestamp ended_at
    }

    match_players {
        uuid id PK
        uuid match_id FK
        uuid user_id FK
        integer score
        integer chip_delta
        varchar status
    }
```

---

## 4. WebSocket Protocol Event Graph

Bidirectional real-time messaging schema validated via Zod (`packages/shared/src/schemas.ts`).

### Client-to-Server Messages

| Event Type | Payload Attributes | Purpose |
|---|---|---|
| `PING` | `{}` | Heartbeat keep-alive frame. |
| `CREATE_ROOM` | `{ maxPlayers: 2 \| 6 }` | Creates new private lobby; generates 6-character room code (`RUMXXX`). |
| `JOIN_ROOM` | `{ roomId: string }` | Joins room via UUID or 6-character room code. |
| `START_ROOM_GAME` | `{ roomId: string }` | Host manual trigger to start match before capacity. |
| `LEAVE_ROOM` | `{ roomId: string }` | Exits waiting lobby. |
| `JOIN_MATCHMAKING` | `{ maxPlayers: 2 \| 6 }` | Enqueues player into matchmaking queue. |
| `LEAVE_MATCHMAKING` | `{}` | Removes player from matchmaking queue. |
| `DRAW_CARD` | `{ roomId: string, source: 'CLOSED' \| 'OPEN' }` | Draws card on active turn. |
| `DISCARD_CARD` | `{ roomId: string, cardId: string }` | Discards card to open pile; ends turn. |
| `DROP_HAND` | `{ roomId: string }` | Forfeits round with minimal drop penalty. |
| `DECLARE_SHOW` | `{ roomId: string, finishCardId: string, melds: CardDto[][] }` | Submits 13-card melds + finish card for show validation. |

### Server-to-Client Messages

| Event Type | Payload Attributes | Delivery |
|---|---|---|
| `CONNECTED` | `{ connectionId, userId, serverTime, message }` | Unicast upon handshake. |
| `PONG` | `{ timestamp }` | Unicast reply to PING. |
| `ROOM_CREATED` | `{ roomId, roomCode, maxPlayers, players, isHost }` | Unicast to room creator. |
| `ROOM_LOBBY_UPDATE` | `{ roomId, roomCode, maxPlayers, players, canStart }` | Broadcast to all room occupants. |
| `GAME_STARTED` | `{ roomId, activePlayerId, wildJoker, openCard, initialHand, players, turnTimeoutMs }` | Multicast to each player (hand is personalized). |
| `CARD_DRAWN_PRIVATE` | `{ roomId, drawnCard, hand }` | Unicast to drawing player. |
| `CARD_DRAWN_PUBLIC` | `{ roomId, playerId, source, cardCount }` | Broadcast to room opponents. |
| `CARD_DISCARDED` | `{ roomId, playerId, discardedCard, nextActivePlayerId, turnTimeoutMs }` | Broadcast to room. |
| `PLAYER_DROPPED` | `{ roomId, playerId, penaltyPoints, nextActivePlayerId }` | Broadcast to room. |
| `DECLARATION_SUBMITTED` | `{ roomId, declarerId }` | Broadcast to room. |
| `ROUND_COMPLETED` | `{ roomId, winnerId, scores, results }` | Broadcast to room. |
| `PLAYER_DISCONNECTED` | `{ roomId, playerId }` | Broadcast to room. |
| `PLAYER_RECONNECTED` | `{ roomId, playerId }` | Broadcast to room. |
| `ERROR` | `{ code, message, details? }` | Unicast on failure. |

---

## 5. Indian Rummy Engine Rules Knowledge Graph

Implemented strictly in `packages/engine/src/validator.ts` and `deck.ts`.

```mermaid
graph TD
    classDef req fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef val fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#fff;
    classDef pen fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#fff;

    Show["Declaration Show (13 Cards + 1 Finish Card)"] --> P1["Requirement 1: Pure Sequence (Min 3 consecutive cards, same suit, NO jokers)"]:::req
    Show --> P2["Requirement 2: Second Sequence (Pure or Impure with Jokers)"]:::req
    Show --> P3["Requirement 3: Remaining Cards Melded in Valid Sets or Sequences"]:::req

    P1 & P2 & P3 --> ValidShow["Valid Declaration: Score = 0 points"]:::val
    
    Show --> InvalidShow["Invalid Declaration: Score = 80 penalty points"]:::pen
    
    OpponentScore["Opponent Scoring"]
    OpponentScore --> Drop1["First Drop (Before Drawing): 20 points"]:::pen
    OpponentScore --> Drop2["Middle Drop (After >=1 Draw): 40 points"]:::pen
    OpponentScore --> Unmelded["Sum of unmelded card values (Max cap: 80 points)"]:::pen

    FaceCards["A, K, Q, J: 10 points each"]
    Numbered["Pip Cards 2-10: Face value"]
    Jokers["Wild & Printed Jokers: 0 points"]
```

---

## 6. Frontend Component & State Graph

Located in `apps/web/src/`.

```mermaid
graph TD
    App["App.tsx (Routing, Auth Context, WebSocket Hook)"]
    
    App --> AuthContext["AuthContext.tsx<br/>(sessionStorage Tab Isolation, Auto-Guest Reg, isTokenExpired)"]
    App --> UseWS["hooks/useWebSocket.ts<br/>(Auto Reconnect, Port 4000 Direct, 1008 Session Reset)"]
    
    App --> ViewHero["Hero / Home View"]
    App --> ViewLobby["WaitingLobby.tsx"]
    App --> ViewTable["GameTable.tsx"]
    
    ViewHero --> ModalCreate["RoomCreationModal.tsx"]
    ViewHero --> ModalJoin["RoomJoinModal.tsx"]
    
    ViewTable --> TurnBanner["#turn-status-banner (Visual Turn Radar)"]
    ViewTable --> Opponents["OpponentSeat.tsx (Avatars, Card Counts, Turn Glow)"]
    ViewTable --> Center["CenterPiles.tsx (Closed Deck, Cut Joker, Open Pile, Finish Slot)"]
    ViewTable --> ActionControls["ActionControls.tsx (Discard, Declare, Drop Buttons)"]
    ViewTable --> PlayerHand["PlayerHand.tsx (Card Groups, Melds, Selection, Auto-Sort)"]
    ViewTable --> ModalResults["RoundResultsModal.tsx (Scoreboard, Penalties, Winner)"]
```

---

## 7. Operational Quick-Reference

- **Start Infrastructure**: `docker compose -f docker/docker-compose.yml up -d`
- **Apply Database Migrations**: `pnpm --filter @rummy/database db:migrate`
- **Run All Unit Tests**: `pnpm -r test`
- **Run End-to-End Browser Test**: `pnpm test:e2e`
- **Run Typecheck**: `pnpm -r typecheck`
- **Start Backend**: `pnpm --filter @rummy/server dev` (Port `4000`)
- **Start Frontend**: `pnpm --filter @rummy/web dev` (Port `3000`)
- **Clean Service Logs**: `pnpm clear:logs`
