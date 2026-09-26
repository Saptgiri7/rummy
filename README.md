# Rummy Master: 13-Card Indian Rummy Platform

A real-time multiplayer 13-Card Indian Rummy web platform built for deterministic competitive play, low-latency state synchronization, authentic casino ergonomics, and cross-device responsiveness.

Built with **TypeScript**, **React 19**, **Vite**, **Node.js**, **WebSockets**, **Redis 7**, **PostgreSQL 16**, and **Drizzle ORM** inside a **Turborepo** monorepo.

---

## Table of Contents

- [Overview](#overview)
- [Game Rules and Mechanics](#game-rules-and-mechanics)
- [System Architecture and Design](#system-architecture-and-design)
  - [High-Level Architecture](#high-level-architecture)
  - [Deterministic Turn State Machine (FSM)](#deterministic-turn-state-machine-fsm)
  - [Anti-Cheat and Information Hiding](#anti-cheat-and-information-hiding)
  - [Dual-Layer Storage Architecture](#dual-layer-storage-architecture)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Casino Ergonomics and Mobile Experience](#casino-ergonomics-and-mobile-experience)
- [Prerequisites and Tools Needed](#prerequisites-and-tools-needed)
- [Quick Start Guide](#quick-start-guide)
- [Environment Configuration](#environment-configuration)
- [Operational Scripts and Automation](#operational-scripts-and-automation)
- [Testing and Verification](#testing-and-verification)
- [Contributing Guidelines](#contributing-guidelines)
- [Security and Fair-Play Design](#security-and-fair-play-design)

---

## Overview

**Rummy Master** is a full-stack digital implementation of traditional 13-Card Indian Rummy (Paplu) featuring real-time multiplayer synchronization, server-authoritative state progression, and an authentic casino felt interface across desktop browsers, tablets, and mobile phones.

### Key Highlights

- **Pure Skill Gameplay**: Zero-chip barrier for table creation and friend play. Share a 6-character room code (`RUMXXX`) to invite friends instantly.
- **Server-Authoritative Engine**: Game logic, sequence verification, card shuffling, cut jokers, and penalty scores are calculated strictly on the backend.
- **Zero Information Leakage**: Card identity for closed deck draws is unicast strictly to the active player. Opponents receive only public draw events without card identity.
- **Resilient Turn Lifecycle**: 30-second turn timer, 20-second disconnect grace window, expedited turns for dropped players, and instant forfeit-settlement logic for 2-player and multi-player tables.
- **Cross-Platform Ergonomics**: Enforces landscape table orientation on all devices, anchors cards and controls to the left side on mobile for thumb reach, and supports both HTML5 Drag-and-Drop / Touch manipulation and click selection.

---

## Game Rules and Mechanics

Rummy Master implements standard 13-Card Indian Rummy rules:

### 1. Deck Composition
- Played with **2 standard 52-card decks** plus **2 printed jokers** (106 cards total).
- One card is drawn randomly as the **Wild Cut Joker** at the start of each round. All cards of the same rank across all four suits function as wild jokers.
- If a printed joker is drawn as the cut card, all **Aces** become wild cut jokers.

### 2. Valid Declaration Requirements
A valid declaration requires all 13 cards arranged into valid groups satisfying:
1. **Primary Pure Sequence (Mandatory)**: A consecutive sequence of 3 or more cards of the identical suit without any jokers (e.g., `4♠ 5♠ 6♠`).
2. **Second Sequence (Mandatory)**: A sequence of 3 or more cards that can either be pure or impure (utilizing printed or wild cut jokers, e.g., `9♦ 10♦ PJ`).
3. **Remaining Cards**: Grouped into valid sequences or sets (3 or 4 cards of the same rank in different suits, e.g., `7♥ 7♠ 7♦`).

### 3. Scoring and Penalty Calculations
- **Winner Score**: 0 penalty points upon a validated declaration.
- **Card Values**: Face cards (K, Q, J) and Aces are worth **10 points** each. Numbered cards (2-10) carry their numeric face value. Jokers carry **0 points**.
- **Maximum Cap**: Penalty points per round are strictly capped at **80 points**.
- **First Drop**: Voluntarily dropping before drawing any card incurs a **20-point penalty**.
- **Middle Drop**: Dropping after drawing one or more cards incurs a **40-point penalty**.
- **Invalid Declaration / Disconnect Forfeit**: Incurs the maximum penalty of **80 points**.

---

## System Architecture and Design

The platform uses a distributed, modular architecture designed for high throughput, predictable state transitions, and high availability.

### High-Level Architecture

```mermaid
flowchart TB
    subgraph Clients["Player Clients"]
        WebA["Player A (Desktop / Web)"]
        WebB["Player B (Mobile Landscape)"]
    end

    subgraph Gateway["Edge and Transport Layer"]
        HTTP["HTTP API Gateway (Express / Port 4000)"]
        WSS["WebSocket Gateway (ws / Port 4000)"]
        Auth["JWT / OTP Auth Middleware"]
    end

    subgraph EngineLayer["Authoritative Core Engine"]
        FSM["Turn FSM Manager (@rummy/engine)"]
        Val["Sequence & Set Validator"]
        Coord["Room Coordinator & Turn Timers"]
        ConnReg["Multi-Socket Connection Registry"]
    end

    subgraph StateStorage["Distributed Storage Layer"]
        Redis["Redis 7<br/>- Room Hot State (JSON)<br/>- Redlock Distributed Mutex<br/>- Pub/Sub Room Broadcasts"]
        Postgres["PostgreSQL 16 (Drizzle ORM)<br/>- Users, Wallets, Audit Logs<br/>- Completed Match Results"]
    end

    WebA <-->|WSS Frames| WSS
    WebB <-->|WSS Frames| WSS
    WebA -->|REST /api/auth| HTTP
    WebB -->|REST /api/auth| HTTP

    HTTP --> Auth
    WSS --> ConnReg
    ConnReg <--> Coord
    Coord --> FSM
    FSM --> Val

    Coord <-->|Atomic Mutex & Hot State| Redis
    Coord -->|Final Match Settlement| Postgres
    Auth <-->|Query & Mutate| Postgres
```

### Deterministic Turn State Machine (FSM)

Each active game round follows a strict, non-reentrant state machine:

```mermaid
stateDiagram-v2
    [*] --> DEALING: Match Started
    DEALING --> WAITING_DRAW: 13 Cards Dealt + Cut Joker Selected

    state WAITING_DRAW {
        [*] --> TurnTimerStarted: 30s Countdown
        TurnTimerStarted --> DrawClosedDeck: Click / Tap Closed Deck
        TurnTimerStarted --> DrawOpenPile: Click / Tap Open Pile
        TurnTimerStarted --> AutoDrawOnTimeout: Timer Expires (30s)
    }

    WAITING_DRAW --> WAITING_DISCARD: CARD_DRAWN_PRIVATE + PUBLIC_BROADCAST

    state WAITING_DISCARD {
        [*] --> DiscardTimerStarted
        DiscardTimerStarted --> DragToOpenPile: Drag Card to Discard Slot
        DiscardTimerStarted --> ClickDiscardBtn: Select Card + Click Discard
        DiscardTimerStarted --> DragToFinishSlot: Drag Card to Finish Slot
        DiscardTimerStarted --> AutoDiscardOnTimeout: Timer Expires
    }

    WAITING_DISCARD --> WAITING_DRAW: Next Player Turn
    WAITING_DISCARD --> DECLARED: Finish Card Discarded

    state DECLARED {
        [*] --> ValidateMelds: Run Pure Seq + Impure Seq Checks
        ValidateMelds --> ValidWin: Pure Seq >= 1 & Total Seq >= 2
        ValidateMelds --> InvalidDeclaration: Missing Sequences (80 Pts)
    }

    ValidWin --> ROUND_ENDED: Settle Scores to Postgres
    InvalidDeclaration --> WAITING_DRAW: Resume with 80 Pts Penalty
    ROUND_ENDED --> [*]
```

### Anti-Cheat and Information Hiding

To ensure competitive integrity, the game server enforces strict anti-cheat information filtering:
1. **Unicast Secret Draws**: When a player draws from the closed deck, the identity of the drawn card is sent **only** to that player via a private frame (`CARD_DRAWN_PRIVATE`).
2. **Public Draw Notification**: Other room occupants receive a broadcast (`CARD_DRAWN_PUBLIC`) that informs them a draw occurred from the closed deck without revealing which card was drawn.
3. **Hidden Hands**: At no point during active gameplay does the server transmit opponent hand arrays to client sockets. Only card count counts are distributed. Full hands are revealed only during round settlement (`ROUND_ENDED`).

### Dual-Layer Storage Architecture

- **Redis (Hot In-Memory State)**:
  - `room:{id}:state`: Fast serialization of the in-flight game round, card decks, discard piles, and player hands.
  - `room:{id}:lock`: Distributed Redlock mutex ensuring concurrent draw/discard requests are serialized without race conditions.
  - `user:{id}:session`: Active WebSocket connection mappings.
- **PostgreSQL (Cold Durable Storage)**:
  - Managed via **Drizzle ORM** with declarative migrations.
  - Houses user credentials (Argon2id/bcrypt salted hashes), wallets, matches, player audit records, and settlement summaries.

---

## Tech Stack

### Frontend Application
- **React 19**: Modern component architecture utilizing hooks, suspense, and concurrent features.
- **Vite 5**: Fast build tool and hot module replacement dev server.
- **TypeScript 5.8**: Strict type safety across UI components and protocol bindings.
- **Vanilla CSS Tokens**: Zero reliance on heavyweight utility classes; uses clean CSS variables, high-contrast typography, and hardware-accelerated transitions.
- **Lucide React**: Clean, accessible iconography.

### Backend and Real-Time Gateway
- **Node.js 20+**: Fast JavaScript runtime.
- **Express**: Modular HTTP REST API framework for authentication, admin metrics, and health checks.
- **ws**: Lightweight, high-throughput native WebSocket server implementation.
- **Zod**: Runtime schema validation for every inbound and outbound WebSocket frame.

### Database, Caching, and Concurrency
- **PostgreSQL 16**: Relational database for durable entity storage and historical auditing.
- **Drizzle ORM & Drizzle Kit**: TypeScript-native ORM with zero code-generation overhead and type-safe schema declarations.
- **Redis 7**: In-memory data store for room state, distributed locks, and pub/sub channels.
- **Redlock**: Distributed locking algorithm preventing simultaneous card mutations.

### Tooling and Quality Assurance
- **Turborepo**: High-performance monorepo build orchestrator with computational caching.
- **pnpm**: Fast, disk-space efficient package manager with workspace protocol support.
- **Vitest**: Blazing-fast unit and integration testing engine.
- **Playwright**: Multi-browser end-to-end testing verifying real multiplayer game loops.
- **Docker Compose**: Containerized PostgreSQL and Redis local infrastructure.

---

## Monorepo Structure

```text
rummy/
├── apps/
│   ├── server/             # Express HTTP API + WebSocket Room Coordinator
│   │   ├── src/
│   │   │   ├── auth/       # JWT tokens, password hashing, RBAC middleware
│   │   │   ├── routes/     # Auth, admin, room management endpoints
│   │   │   ├── services/   # Email OTP, user registration, wallet services
│   │   │   ├── ws/         # WebSocket server, connection registry, room coordinator
│   │   │   └── index.ts    # Main server entrypoint
│   │   └── package.json
│   └── web/                # React 19 + Vite Frontend Application
│       ├── src/
│       │   ├── components/ # Table felt, cards, center piles, modals, lobby
│       │   ├── context/    # Auth context, session isolation
│       │   ├── hooks/      # useWebSocket, sound effects, touch handlers
│       │   ├── App.tsx     # Central view coordinator and socket listener
│       │   └── index.css   # Responsive casino design system
│       ├── e2e/            # Playwright automated browser test suites
│       └── package.json
├── packages/
│   ├── engine/             # Pure Indian Rummy game logic and validation
│   │   ├── src/
│   │   │   ├── deck.ts     # 106-card deck, shuffling, wild cut jokers
│   │   │   ├── sequence.ts # Pure and impure sequence algorithms
│   │   │   ├── set.ts      # Set validation (same rank, different suits)
│   │   │   ├── scoring.ts  # 80-point unmelded calculation, drops, penalties
│   │   │   └── turn-fsm.ts # Deterministic turn state machine and forfeits
│   │   └── package.json
│   ├── shared/             # Shared TypeScript types, Zod schemas, protocol events
│   │   ├── src/
│   │   │   ├── protocol.ts # Client and server WebSocket message contracts
│   │   │   ├── dtos.ts     # Request/response validation schemas
│   │   │   └── types.ts    # Card, hand, player, and room types
│   │   └── package.json
│   ├── database/           # Drizzle ORM schema, repositories, connection pool
│   │   ├── drizzle/        # SQL migration files
│   │   ├── src/
│   │   │   ├── schema/     # Users, wallets, matches, refresh tokens
│   │   │   ├── repositories/ # Abstracted data access layer
│   │   │   └── db.ts       # Pool connection and health monitoring
│   │   └── package.json
│   └── redis/              # Redis client, distributed locks, room state cache
│       ├── src/
│       │   ├── client.ts   # Redis connection factory
│       │   ├── locks.ts    # Redlock distributed mutex
│       │   └── room-store.ts # Hot state storage and cache keys
│       └── package.json
├── docker/
│   └── docker-compose.yml  # Local PostgreSQL and Redis containers
├── scripts/                # Operational lifecycle scripts (start, stop, migrate)
│   ├── start.sh            # Complete platform launcher with LAN detection
│   ├── stop.sh             # Graceful process shutdown and container cleanup
│   ├── migrate.sh          # Database migration manager
│   ├── clear-logs.sh       # Safe log file truncation and disk reclamation
│   └── recover-snapshot.sh # Automated baseline snapshot restoration
├── .env.example            # Environment configuration template
├── package.json            # Root workspace configuration
├── pnpm-workspace.yaml     # Workspace package mapping
└── turbo.json              # Turborepo task pipeline definitions
```

---

## Casino Ergonomics and Mobile Experience

The user interface of Rummy Master was developed following strict visual craftsmanship standards:

1. **Enforced Horizontal Table Geometry**:
   - The game table maintains landscape aspect ratios across phones, tablets, and desktops.
   - On mobile devices, a horizontal scrollable canvas prevents vertical compression of opponent seats and center piles.

2. **Left-Hand Ergonomics on Mobile**:
   - For viewports `<= 1024px`, the player's 13-card hand, meld groupings, and action buttons (`Group`, `Sort`, `Discard`) are anchored to the bottom-left corner.
   - This keeps core play controls directly under the player's left thumb during one-handed or landscape two-handed phone handling.

3. **Dual-Mode Card Interaction**:
   - **Drag and Drop & Touch**:
     - Drag a card onto another card or group to reorder or transfer cards between meld sets.
     - Drag a card into the `+ New Group` zone to break it into a separate meld.
     - Drag a card directly to the Open Discard Pile to discard on your turn.
     - Drag a card to the Finish Slot to select it as the closing card and trigger declaration.
   - **Click Selection Fallback**:
     - Click cards to highlight them, then tap `Group` to combine them. Click the open pile or closed deck to draw cards.

4. **Tactile Feedback and Accessible Contrast**:
   - 150-250ms spring transitions for card movements.
   - Tabular numerals (`font-variant-numeric: tabular-nums`) on turn countdown timers to eliminate layout jitter.
   - Contrast compliant typography (WCAG AA/AAA) avoiding low-contrast text on dark backgrounds.

---

## Prerequisites and Tools Needed

Ensure you have the following installed on your local development machine:

1. **Node.js**: `v20.0.0` or higher (`node -v`)
2. **pnpm**: `v9.0.0` or higher (`npm install -g pnpm` / `pnpm -v`)
3. **Docker & Docker Compose**: Required for running PostgreSQL and Redis containers (`docker compose version`)
4. **Git**: Version control (`git -v`)

---

## Quick Start Guide

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/rummy.git
cd rummy
```

### 2. Install Workspace Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create your local environment files from the provided templates:

```bash
cp .env.example .env
cp .env.example apps/server/.env
```

Review the values in `.env`. The default values work out-of-the-box with the local Docker Compose configuration.

### 4. Start Infrastructure and Applications

Use the built-in startup script, which starts PostgreSQL and Redis in Docker, waits for health checks, runs database migrations, and boots both backend and frontend servers:

```bash
pnpm start
```

Once started, the CLI will display access URLs:
- **Web Application**: `http://localhost:5173` (or `http://localhost:3000`)
- **Backend API**: `http://localhost:4000`
- **WebSocket Gateway**: `ws://localhost:4000`

### 5. Multi-Device Local Testing (LAN Access)

The startup script automatically detects your machine's local network IP. Open `http://<your-local-ip>:5173` on your smartphone or tablet connected to the same Wi-Fi network to test multi-device gameplay in real time.

---

## Environment Configuration

All environment variables are declared in `.env.example`. No credentials or secret keys are committed to source control.

| Variable | Description | Default / Example Value |
|---|---|---|
| `PORT` | HTTP & WebSocket server port | `4000` |
| `NODE_ENV` | Runtime environment mode | `development` |
| `CORS_ORIGIN` | Allowed CORS origin for web app | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection connection string | `postgres://postgres:postgrespassword@localhost:5432/rummy_dev` |
| `REDIS_URL` | Redis server connection URI | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens | `dev_jwt_access_secret_key` |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | `dev_jwt_refresh_secret_key` |
| `JWT_ACCESS_EXPIRY` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifespan | `7d` |
| `TURN_TIMEOUT_SECONDS` | Seconds per player turn before auto-play | `30` |
| `RECONNECT_GRACE_PERIOD_SECONDS` | Seconds before disconnected player forfeits | `20` |
| `SMTP_SERVICE` | Optional SMTP email provider (e.g. gmail) | `gmail` |
| `SMTP_USER` | SMTP username / address | `your-email@gmail.com` |
| `SMTP_PASS` | SMTP application password | `your-app-password` |
| `SMTP_FROM` | Sender display name and email address | `"Rummy Master" <noreply@domain.com>` |

---

## Operational Scripts and Automation

A suite of operational scripts is located in `scripts/`:

```bash
# Start all services (Docker + backend + frontend)
pnpm start

# Start Docker containers only
pnpm start -- --infra

# Stop all running services (preserves database volumes)
pnpm stop

# Stop all services and wipe Docker volumes (complete clean slate)
pnpm stop -- --wipe

# Apply pending Drizzle database migrations
pnpm migrate

# Generate a new SQL migration from Drizzle schema modifications
pnpm migrate -- --generate

# Clean logs and Playwright test artifacts to reclaim disk space
pnpm clear:logs

# Disaster recovery: restore repository and DB to stable baseline snapshot
pnpm recover:snapshot
```

---

## Testing and Verification

The repository includes a comprehensive, multi-tiered test suite ensuring zero regressions:

```bash
# 1. Typecheck all packages and applications (0 errors required)
pnpm typecheck

# 2. Run all unit and integration test suites
pnpm test

# 3. Run browser end-to-end automated multiplayer test (Playwright)
pnpm test:e2e
```

### Test Suite Structure

- **`packages/engine`**: Unit tests for deck creation, card shuffling, wild cut jokers, pure sequences, impure sequences, valid sets, and score calculations.
- **`packages/shared`**: Zod schema validation tests for all protocol message formats.
- **`apps/server`**: Integration tests for user authentication, OTP hashing, room lifecycle, turn loops, and anti-cheat information masking.
- **`apps/web`**: Playwright browser automation simulating 2-player multiplayer games, dealing, card drawing, grouping, discarding, and win declarations.

---

## Contributing Guidelines

Contributions to Rummy Master are welcome! Follow these steps to contribute:

### 1. Fork and Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Follow Engineering Standards

- **Code Quality**: Ensure strict TypeScript compliance (`pnpm typecheck` must pass with 0 errors).
- **Test Coverage**: Write unit tests for new engine logic or API endpoints. Run `pnpm test` to verify.
- **Typography and UI**: Never use em dashes (Unicode U+2014) in code, UI text, or documentation. Use colons, hyphens (`-`), or parentheses.
- **Micro-Interactions**: Follow intentional UI motion standards (150-250ms transitions, tabular numerals for timers, accessible contrast).

### 3. Commit Convention

Use conventional commit messages:

- `feat(engine): add 10-card rummy variant scoring rules`
- `fix(table): resolve card drag offset on mobile touch devices`
- `test(server): add integration test for player reconnection timeout`
- `docs: update quick start instructions for docker desktop`

### 4. Create Pull Request

Push your branch and submit a Pull Request describing your changes, design decisions, and testing steps.

---

## Security and Fair-Play Design

### Zero Credential Exposure Policy
- Never commit `.env` files, API keys, private certificates (`*.pem`, `*.key`), or real user credentials.
- All secrets must use environment variable fallbacks or `.env.example` placeholders.
- The `.gitignore` is pre-configured to ignore sensitive credentials, session logs, and scratch directories.

### Fair-Play Design
- The server is authoritative on card order and deck state.
- Closed deck order is held only in Redis in-memory storage and is never transmitted to clients.
- Draws, discards, and declares are locked with Redlock to prevent concurrent manipulation or double-play vulnerabilities.
