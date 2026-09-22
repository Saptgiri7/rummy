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

### Decision 5: Centralized `scripts/` Directory & Automated Snapshot Recovery
- **Context**: Manual multi-step snapshot restoration (git stash, checkout, docker volume drops, psql schema injection, package builds, verification) is error-prone.
- **Rationale**: Created `scripts/recover-snapshot.sh` (aliased as `pnpm recover:snapshot`) and documented all project tooling in `scripts/README.md`. All lifecycle, maintenance, and recovery scripts must reside strictly in `scripts/` with explicit behavioral descriptions and safety flags.
- **Invariant**: Every operational script in `scripts/` must be idempotent, support `--help`, and be documented in `scripts/README.md`.

### Decision 6: Dual-Channel OTP Verification (Email & Phone)
- **Context**: Production-grade authentication requires verified identities, not just username/password.
- **Rationale**: Implemented a channel-agnostic `OtpService` that generates cryptographic 6-digit OTPs (`crypto.randomInt(100000, 1000000)`), stores SHA-256 hashed values with 10-minute expiry and max 3 failed attempt lockout, and rate-limits to 1 OTP per 60 seconds per identifier. In development, OTP is returned in a `devOtpCode` response field for instant testing without SMS/SMTP gateways.
- **Invariant**: OTP hashes must never be stored in plaintext. The `devOtpCode` field must only be emitted when `NODE_ENV !== 'production'`.

### Decision 7: Flexible Login (Username, Email, or Phone)
- **Context**: Users should be able to log in with whichever identifier they remember — username, email, or phone number.
- **Rationale**: The login endpoint accepts a single `identifier` field and queries `findUserByIdentifier()`, which checks against `username`, `email`, and `phone` columns sequentially. This avoids forcing users to remember which credential type they used during registration.
- **Invariant**: The `findUserByIdentifier` query must always check all three columns (username, email, phone).

### Decision 8: Role-Based Access Control (RBAC) with JWT Claims
- **Context**: Admin dashboard and platform metrics must be restricted to administrator accounts only.
- **Rationale**: The `role` field (`'USER' | 'ADMIN'`) is stored in the `users` table and embedded as a JWT claim in `TokenPayload`. The `requireAdmin` middleware stacks after `authenticateToken` and rejects non-admin users with `403 FORBIDDEN`. A default admin account is auto-seeded on server startup.
- **Invariant**: The `role` claim in JWT must always match the database value. Never trust client-side role assertions.

### Decision 9: Analytics Telemetry Pipeline
- **Context**: Admin dashboard needs real-time and historical platform metrics.
- **Rationale**: Created an `AnalyticsService` that asynchronously writes telemetry events (`USER_REGISTERED`, `USER_LOGIN`, `ROOM_CREATED`, `MATCH_STARTED`, `MATCH_FINISHED`) to the `analytics_events` PostgreSQL table. Events are fire-and-forget to avoid blocking gameplay flows.
- **Invariant**: Analytics writes must never block or fail game-critical request handlers.

### Decision 10: Guest Play Preservation for E2E Test Compatibility
- **Context**: After adding production auth, existing Playwright E2E tests relied on guest auto-registration.
- **Rationale**: Guest play remains as a "Continue as Guest" fallback. The `POST /api/auth/guest` endpoint creates an anonymous account with auto-generated username. E2E tests continue to use guest auth for multiplayer test flows.
- **Invariant**: Never remove guest registration without updating all E2E test suites first.

### Decision 11: Real SMTP Email Delivery & Authentic Verification Experience
- **Context**: Users previously saw the OTP code immediately on screen (`devOtpCode`), which felt fake and auto-filled.
- **Rationale**: Enhanced `EmailService` to connect via real SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SERVICE`, `SMTP_SECURE`, `SMTP_FROM`) with fallback to Ethereal dev email preview. Disallowed emitting or displaying OTP codes on client modals for email verification, requiring users to retrieve the code from their actual email inbox.
- **Invariant**: The client UI must never display `devOtpCode` for email registrations.

### Decision 12: Zero-Enforcement Guest Ergonomics with Pre-Table Name Customization
- **Context**: User requested zero enforcement for account creation; guests should play freely, and should be prompted for their in-game display name before creating or joining a room.
- **Rationale**: Added `PATCH /api/auth/profile/username` allowing authenticated guests to update their in-game display name on the fly. Added display name prompts inside `RoomCreationModal` and `RoomJoinModal`, as well as a standalone `GuestNameModal`.
- **Invariant**: Guests can always play and customize their display name without ever being forced to register an account.

### Decision 13: Unified Platform Branding as 'Rummy Master'
- **Context**: The application had leftover draft references to 'Rummy Royale Pro' across email templates, HTML tags, and modal dialogs.
- **Rationale**: Formally unified all platform branding to **Rummy Master** across HTML title/metadata (`apps/web/index.html`), header navigation logo (`apps/web/src/App.tsx`), modal titles (`apps/web/src/components/Auth/AuthModal.tsx`), and transactional email templates with verified sender `noreplyrummymaster@gmail.com` (`apps/server/src/services/email-service.ts`).
- **Invariant**: All user-facing references, transactional emails, and browser titles must consistently display 'Rummy Master'.

### Decision 14: Removal of Confusing Quick Match Button & Elevation of Core Table Actions
- **Context**: The landing page had an orphaned 'Quick Match (2 Players)' button below the 2-column grid. Clicking it silently queued in Redis without visual feedback, causing user confusion since multiplayer games are private-room and code-sharing oriented.
- **Rationale**: Removed the orphaned Quick Match button. Upgraded the two primary action cards ('Create Table' & 'Join with Code') with human-grade craftsmanship: Lucide icons (`<PlusCircle />`, `<KeyRound />`), crisp subtitles, subtle arrow transitions, and emerald/gold gradients. Added an interactive 'How to Play & Scoring Rules' guide modal (`RulesModal.tsx`) providing immediate value to players.
- **Invariant**: The primary landing view must focus cleanly on Create Table and Join with Code without dead or orphaned action buttons.

---

## 2. Failure Modes & Known Bug Patterns Catalog

| Failure Pattern | Root Cause | Symptoms | Permanent Fix Implemented |
|---|---|---|---|
| **PostgreSQL Schema Desync on Volume Reset** | Running `docker compose down -v` wipes Postgres data volumes. If Drizzle migrations are not applied directly, tables are missing. | Server throws `error: relation "users" does not exist` (code `42P01`) on registration. | Schema applied via `packages/database/drizzle/0000_wonderful_nova.sql`. Always verify `users` table exists upon volume reset. |
| **Expired JWT Infinite Handshake Loop** | Browser retained an expired token in storage. Client WS retried connection every 1.5s with the same expired token; server rejected with `1008 Unauthorized`. | WebSocket failed to open; user could not receive room codes; "Create Room" buttons were unresponsive. | Added `isTokenExpired()` in `AuthContext.tsx` to purge dead tokens client-side. Added code `1008` close handler in `useWebSocket.ts` to clear storage and reload cleanly. |
| **CSS Animation Click-Miss in Automated Tests** | CSS `@keyframes` on `.can-draw-pulse` animated `transform: translateY(-4px)`, constantly shifting element coordinates during test execution. | Playwright click on `#closed-draw-deck` dispatched at sub-pixel offset, missing the element or failing actionability. | Removed `transform` from draw pulse keyframes; pulse now uses purely static `drop-shadow` / `box-shadow` transitions. Clicks use `{ force: true }` in automated suites. |
| **Double-Firing Click Handlers** | Both parent `.deck-pile-slot` and inner `PlayingCard` had independent `onClick` handlers. | React event bubbling caused `DRAW_CARD` or `DISCARD_CARD` to be sent twice in the same tick; server threw `INVALID_PHASE`. | Centralized click handling on parent slot container with `e.stopPropagation()`; removed redundant inner card handlers. |
| **Unsynchronized Room Lobby State** | Participant joined via code, but host tab was not notified of participant arrival or match start. | Participant entered active game while host remained frozen in waiting lobby modal. | `roomService.broadcastLobbyUpdate` dispatches to all connections in room. Capacity check triggers `GAME_STARTED` simultaneously to both host and guest. |
| **Playwright Logout `window.location.reload()` Instability** | Using `window.location.reload()` during logout caused full page reloads mid-test, breaking Playwright's page reference and navigation state. | E2E auth tests failed intermittently with `page.goto: Navigation interrupted`. | Refactored logout to call `loginAsGuest()` directly instead of reloading the page, keeping the SPA context alive during test flows. |
| **Completed Room Lobby Zombie Game & DB Duplicate Match ID** | `settleRound` deleted active game state (`room:{id}:state`) but did not clean up `room:{id}:lobby` or room code mapping in Redis. If a player re-joined or refreshed, the server found the 2/2 lobby and auto-started a ghost game in the same room. One player saw victory modal while the other played the new match; when the second game concluded, Postgres threw `matches_room_id_unique` duplicate key error. | One participant showed match victory while the other participant was placed in a new match; server log had `duplicate key value violates unique constraint "matches_room_id_unique"`. | In `RoomCoordinator.settleRound`, delete the lobby and room code via `deleteRoomLobby(roomId, lobby.roomCode)`. Set `lobby.status = 'IN_PROGRESS'` upon capacity auto-start in `roomService.joinRoom`. In frontend `App.tsx`, dismiss `isResultsModalOpen` on `GAME_STARTED` and clear `activeRoomId` and `activeLobby` on "Return to Lobby". |
| **Asynchronous Guest Login Overwrite on Fast Re-Login** | `logout()` initiated asynchronous `loginAsGuest()`. If the user/test immediately submitted a login form before the guest request completed, the delayed guest response overwrote the newly logged-in user in `AuthContext`. | User appeared as `Player_XXXX` with "Sign In" buttons instead of the expected authenticated account (e.g., admin). | Added active token check in `loginAsGuest()` so an in-flight guest registration never overwrites an existing authenticated user session. |
| **Brevo SMTP & ESM Environment Variable Precedence** | In Node.js ES modules, static `import` declarations evaluate before the importing module's top-level code. Because `authRouter` was imported before `dotenv.config()` in `apps/server/src/index.ts`, `emailService` instantiated prior to `.env` variables being populated, causing premature fallback to Ethereal developer email. | Server logged `Real SMTP not configured in .env` despite valid Brevo credentials in root `.env`. | Placed `import 'dotenv/config';` on line 1 of `index.ts`, embedded multi-path `.env` loader in `email-service.ts` using `fs.existsSync`, created `apps/server/.env` symlink, and updated `otp.test.ts` assertions to match `/Verification code (sent|dispatched)/`. |
| **Abrupt OS Shutdown Drops Active IDE Chat from History** | When the host machine powers off abruptly while an Antigravity IDE session is active, the conversation SQLite database (`~/.gemini/antigravity-ide/conversations/<id>.db`) and transcripts remain completely intact on disk, but the global index entry in `state.vscdb` (`antigravityUnifiedStateSync.trajectorySummaries`) was not serialized. | Past conversation disappeared from the sidebar History dropdown. | Decoded protobuf `trajectorySummaries`, constructed the `CascadeTrajectorySummary` record for the session ID (`322319bf-...`), and injected it into `~/.config/Antigravity IDE/User/globalStorage/state.vscdb`. Reloading the IDE window restores the conversation to the history picker. |

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
6. **OTP Security**:
   - Never store OTP codes in plaintext. Always use SHA-256 hashing. Never expose `devOtpCode` in production.
7. **RBAC Enforcement**:
   - All admin endpoints must be double-gated with `authenticateToken` + `requireAdmin`. Never trust client-side role state for authorization.
8. **Admin Seed Idempotency**:
   - The admin auto-seed on startup must check for existing admin accounts first. Never create duplicate admin accounts.

---

## 4. Snapshot History

- **`v1.0.0-multiplayer-stable` (`snapshot/stage-8-stable`)**: Created at 2026-09-20T19:25:00+05:30. Preserves Stage 8 production baseline with working real-time WebSocket room coordination, turn indicators, Playwright automated tests, clean DB schema, and anti-vibe UI design guidelines. See [snapshots/README.md](file:///home/saptgiri7/Desktop/rummy/snapshots/README.md).
