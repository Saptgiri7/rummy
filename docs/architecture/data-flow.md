# Real-Time Indian Rummy — Comprehensive System Data Flow

This document details the end-to-end data flows, sequence diagrams, and state transitions across all operational phases of the Indian Rummy platform.

---

## 1. System Topology Overview

```mermaid
graph TD
    Client["Client (Browser / React UI)"]
    
    subgraph Edge ["Edge / API Gateway / Reverse Proxy"]
        Nginx["Reverse Proxy / SSL Termination"]
    end

    subgraph Backend ["Application Cluster"]
        REST["HTTP REST API (Express)"]
        WS["WebSocket Server (Node.js 'ws')"]
        Matchmaker["Matchmaking Engine"]
        Engine["Pure Game Engine Core"]
    end

    subgraph DataStore ["Persistence & Real-Time Caching"]
        Redis[("Redis (Cluster / Sentinel)<br/>• Room State<br/>• Turn Locks<br/>• Matchmaking Queues<br/>• Pub/Sub Events")]
        Postgres[("PostgreSQL 16<br/>• Users & Credentials<br/>• Match History & Audits<br/>• Chips & Player Balances")]
    end

    Client -->|HTTPS (Auth, Lobby, Profile)| Nginx
    Client -->|WSS (Gameplay, Heartbeats)| Nginx
    Nginx -->|HTTP 3000| REST
    Nginx -->|Upgrade WS| WS
    REST --> Postgres
    REST --> Redis
    WS --> Redis
    WS --> Engine
    Matchmaker --> Redis
    Matchmaker --> Postgres
```

---

## 2. Authentication & Session Lifecycle

### 2.1 User Registration & Login
```mermaid
sequenceDiagram
    autonumber
    actor Player as Client / Player
    participant Gateway as Reverse Proxy / Express REST
    participant Auth as Auth Controller
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    Player->>Gateway: POST /api/auth/register { username, email, password }
    Gateway->>Auth: Validate schema (Zod)
    Auth->>DB: Check uniqueness (email, username)
    Auth->>Auth: Hash password (Argon2id / bcrypt salt 12)
    Auth->>DB: INSERT INTO users (id, username, email, password_hash, chips)
    Auth->>Auth: Issue Access JWT (15m) + Refresh Token (7d)
    Auth->>Redis: Store Refresh Token whitelist/fingerprint
    Auth-->>Player: 201 Created { accessToken, refreshToken, userProfile }

    Note over Player, Redis: Login Flow follows identical token issuance pattern
```

### 2.2 WebSocket Upgrade Handshake & Authentication
```mermaid
sequenceDiagram
    autonumber
    actor Player as Client
    participant HTTP as HTTP Upgrade Server
    participant WS as WS Server Handler
    participant Redis as Redis Session Store

    Player->>HTTP: GET /ws?token=<ACCESS_TOKEN> (Upgrade: websocket)
    HTTP->>HTTP: Verify JWT signature, expiration, & claims
    alt Invalid / Expired Token
        HTTP-->>Player: HTTP 401 Unauthorized (Connection Aborted)
    else Valid Token
        HTTP->>WS: Complete WebSocket handshake (HTTP 101)
        WS->>Redis: Register active connection { userId, connectionId, socketRef }
        WS-->>Player: WS_CONNECTED { connectionId, serverTime, heartbeatInterval: 30000 }
    end
```

---

## 3. Matchmaking & Room Provisioning

```mermaid
sequenceDiagram
    autonumber
    actor P1 as Player 1
    actor P2 as Player 2
    participant WS as WebSocket Gateway
    participant MM as Matchmaking Worker
    participant Redis as Redis Store
    participant DB as PostgreSQL

    P1->>WS: CLIENT_MSG: { type: "JOIN_MATCHMAKING", payload: { gameMode: "13_CARD_POINTS", maxPlayers: 2, stake: 50 } }
    WS->>Redis: ZADD matchmaking:queue:<mode>:<stake> <timestamp> <p1_userId>
    WS-->>P1: SERVER_MSG: { type: "MATCHMAKING_QUEUED", payload: { queuePosition: 1, estimatedWaitSec: 5 } }

    P2->>WS: CLIENT_MSG: { type: "JOIN_MATCHMAKING", payload: { gameMode: "13_CARD_POINTS", maxPlayers: 2, stake: 50 } }
    WS->>Redis: ZADD matchmaking:queue:<mode>:<stake> <timestamp> <p2_userId>

    loop Matchmaking Poll / Trigger
        MM->>Redis: Atomically pop N players (ZPOPMIN 2)
        MM->>MM: Initialize Room State (deal 13 cards, select wild joker, set open pile)
        MM->>Redis: SET rummy:dev:room:<roomId>:state <serializedGameState> EX 3600
        MM->>Redis: SADD rummy:dev:room:<roomId>:players <p1_id> <p2_id>
        MM->>Redis: PUBLISH rummy:events:room:<roomId> { type: "MATCH_FOUND", roomId }
    end

    Redis-->>WS: Deliver MATCH_FOUND to subscriber instances
    WS-->>P1: SERVER_MSG: { type: "MATCH_FOUND", payload: { roomId, opponentIds, stake } }
    WS-->>P2: SERVER_MSG: { type: "MATCH_FOUND", payload: { roomId, opponentIds, stake } }
```

---

## 4. Turn Cycle & Concurrency Control

Indian Rummy requires a strict sequential turn order: **Draw Phase -> Discard Phase -> Turn Advancement**.

```mermaid
sequenceDiagram
    autonumber
    actor CurrentPlayer as Player (Active Turn)
    actor Opponent as Opponent (Observing)
    participant WS as WebSocket Server
    participant Lock as Redis Distributed Lock
    participant Engine as Pure Game Engine
    participant Redis as Redis Room Store

    Note over CurrentPlayer, Redis: Phase 1: Draw Action
    CurrentPlayer->>WS: CLIENT_MSG: { type: "DRAW_CARD", payload: { source: "OPEN_DECK" | "CLOSED_DECK" } }
    WS->>Lock: Acquire lock "lock:room:<roomId>" (TTL 2000ms)
    alt Lock Failed (Concurrent Duplicate)
        WS-->>CurrentPlayer: SERVER_MSG: { type: "ERROR", code: "ACTION_IN_FLIGHT" }
    else Lock Acquired
        WS->>Redis: GET rummy:dev:room:<roomId>:state
        WS->>Engine: executeAction(state, { type: "DRAW", playerId, source })
        alt Invalid Move (e.g., Not player's turn or already drew)
            Engine-->>WS: InvalidMoveError("Must discard before drawing or wrong turn")
            WS->>Lock: Release lock
            WS-->>CurrentPlayer: SERVER_MSG: { type: "ACTION_REJECTED", reason: "..." }
        else Valid Move
            Engine-->>WS: { nextState, events: [CardDrawnEvent] }
            WS->>Redis: SET rummy:dev:room:<roomId>:state <nextState>
            WS->>Lock: Release lock
            WS-->>CurrentPlayer: SERVER_MSG: { type: "CARD_DRAWN_PRIVATE", card: drawnCard, hand: updatedHand }
            WS-->>Opponent: SERVER_MSG: { type: "CARD_DRAWN_PUBLIC", playerId, source, cardCount: 14 }
        end
    end

    Note over CurrentPlayer, Redis: Phase 2: Discard Action
    CurrentPlayer->>WS: CLIENT_MSG: { type: "DISCARD_CARD", payload: { cardId: "H_7_1" } }
    WS->>Lock: Acquire lock "lock:room:<roomId>"
    WS->>Redis: GET rummy:dev:room:<roomId>:state
    WS->>Engine: executeAction(state, { type: "DISCARD", playerId, cardId })
    Engine-->>WS: { nextState, events: [CardDiscardedEvent, TurnRotatedEvent] }
    WS->>Redis: SET rummy:dev:room:<roomId>:state <nextState>
    WS->>Redis: Set Turn Expiration Timer in Redis / Node scheduler (30 seconds)
    WS->>Lock: Release lock

    WS-->>CurrentPlayer: SERVER_MSG: { type: "CARD_DISCARDED", card: discardedCard, nextTurn: nextPlayerId, turnTimeoutMs: 30000 }
    WS-->>Opponent: SERVER_MSG: { type: "CARD_DISCARDED", card: discardedCard, nextTurn: nextPlayerId, turnTimeoutMs: 30000 }
```

---

## 5. Turn Expiry & Auto-Play Protocol

```mermaid
sequenceDiagram
    autonumber
    participant Timer as Turn Timer Watcher (Node / Redis)
    participant WS as WebSocket Server
    participant Lock as Redis Lock
    participant Engine as Pure Game Engine
    participant Redis as Redis State
    actor Player as Inactive Player

    Timer->>WS: Event: TurnTimerExpired { roomId, turnPlayerId, turnSeq }
    WS->>Lock: Acquire lock "lock:room:<roomId>"
    WS->>Redis: GET rummy:dev:room:<roomId>:state
    alt Player already completed turn
        WS->>Lock: Release lock (Ignore stale timer)
    else Turn Still Active
        WS->>Engine: executeAutoPlay(state, turnPlayerId)
        Note over Engine: Auto-draws closed deck (if not drawn) and discards drawn card; increments consecutive misses
        Engine-->>WS: { nextState, missedCount, isForfeited }
        WS->>Redis: SET rummy:dev:room:<roomId>:state <nextState>
        WS->>Lock: Release lock
        WS-->>Player: SERVER_MSG: { type: "AUTO_PLAY_EXECUTED", warning: "Turn timed out (1/3 strikes)" }
        alt missedCount >= 3
            WS-->>Player: SERVER_MSG: { type: "PLAYER_FORFEITED", reason: "Consecutive timeouts" }
        end
    end
```

---

## 6. Declaration, Validation & Round Termination

```mermaid
sequenceDiagram
    autonumber
    actor Winner as Declaring Player
    actor Loser as Opponent
    participant WS as WebSocket Server
    participant Engine as Pure Game Engine
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    Winner->>WS: CLIENT_MSG: { type: "DECLARE", payload: { melds: Card[][] } }
    WS->>Engine: validateDeclaration(handMelds, wildJoker)
    alt Invalid Declaration (Bogus Show)
        Engine-->>WS: InvalidDeclaration { valid: false, penaltyPoints: 80 }
        WS-->>Winner: SERVER_MSG: { type: "DECLARATION_INVALID", penalty: 80 }
        Note over WS: Game continues or player is eliminated based on rules
    else Valid Declaration (Pure Sequence + Sequence + Valid Sets/Sequences)
        Engine-->>WS: ValidDeclaration { valid: true, winnerPoints: 0 }
        WS-->>Winner: SERVER_MSG: { type: "DECLARATION_ACCEPTED", status: "AWAITING_OPPONENT_MELDS" }
        WS-->>Loser: SERVER_MSG: { type: "ROUND_DECLARED_BY_OPPONENT", timeoutSec: 45 }
        
        Loser->>WS: CLIENT_MSG: { type: "SUBMIT_FINAL_MELDS", payload: { melds: Card[][] } }
        WS->>Engine: calculatePenaltyPoints(loserMelds, wildJoker)
        Engine-->>WS: ScoreSheet { winnerId, scores: [{ playerId, points, penalty, chipDelta }] }
        
        WS->>DB: BEGIN TRANSACTION;
        WS->>DB: INSERT INTO match_history (room_id, winner_id, stakes, scores_json);
        WS->>DB: UPDATE user_wallets SET chips = chips + delta WHERE user_id = ...;
        WS->>DB: COMMIT;
        
        WS->>Redis: DEL rummy:dev:room:<roomId>:*
        WS-->>Winner: SERVER_MSG: { type: "MATCH_COMPLETE", scoreSheet }
        WS-->>Loser: SERVER_MSG: { type: "MATCH_COMPLETE", scoreSheet }
    end
```

---

## 7. Disconnection & Reconnection Resilience

```mermaid
sequenceDiagram
    autonumber
    actor P1 as Reconnecting Player
    participant WS as WebSocket Server
    participant Redis as Redis Session & Room Store

    Note over P1, WS: Network drops (TCP socket abruptly terminates)
    WS->>WS: Socket 'close' event detected
    WS->>Redis: SET rummy:dev:player:<id>:disconnect_time <timestamp> EX 60
    WS->>Redis: PUBLISH rummy:room:<roomId> { type: "PLAYER_DISCONNECTED", playerId: P1, gracePeriodMs: 60000 }
    
    Note over P1: Player re-establishes connection within 60 seconds
    P1->>WS: WS Upgrade with JWT (reconnect)
    WS->>Redis: GET rummy:dev:player:<id>:current_room
    alt Room active and grace period valid
        WS->>Redis: DEL rummy:dev:player:<id>:disconnect_time
        WS->>Redis: GET rummy:dev:room:<roomId>:state
        WS-->>P1: SERVER_MSG: { type: "GAME_RECONNECTED", snapshot: sanitizedGameState, remainingTurnTimeMs }
        WS->>Redis: PUBLISH rummy:room:<roomId> { type: "PLAYER_RECONNECTED", playerId: P1 }
    else Grace period expired
        WS-->>P1: SERVER_MSG: { type: "ROOM_EXPIRED", reason: "Game dropped due to timeout" }
    end
```
