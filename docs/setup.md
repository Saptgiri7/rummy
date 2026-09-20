# Developer Environment Setup & Operations Guide

This guide describes how to bootstrap, develop, test, and operate the Indian Rummy platform on a clean development machine.

---

## 1. Prerequisites

Ensure your development machine has the following installed:
- **Node.js**: v20.x or v22.x LTS (`node -v`)
- **pnpm**: v9.x or v10.x (`pnpm -v`)
- **Docker Engine & Docker Compose**: v2.20+ (`docker compose version`)
- **Git**: (`git --version`)

---

## 2. Quickstart Instructions

### Step 1: Clone and Install Dependencies
```bash
# Clone the repository
git clone <repository_url>
cd rummy

# Install all workspace dependencies
pnpm install
```

### Step 2: Configure Environment Variables
Copy the example environment template to `.env`:
```bash
cp .env.example .env
```

Ensure `.env` contains safe local defaults:
```env
# Server Configuration
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# PostgreSQL Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rummy_dev

# Redis Connection
REDIS_URL=redis://localhost:6379

# Authentication & Security
JWT_ACCESS_SECRET=local_dev_access_secret_do_not_use_in_prod_12345
JWT_REFRESH_SECRET=local_dev_refresh_secret_do_not_use_in_prod_67890
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Game Tuning & Rules
TURN_TIMEOUT_SECONDS=30
RECONNECT_GRACE_PERIOD_SECONDS=60
```

### Step 3: Start Local Infrastructure (Docker Compose)
Launch PostgreSQL and Redis:
```bash
docker compose -f docker/docker-compose.yml up -d
```

Verify that both containers are running and healthy:
```bash
docker compose -f docker/docker-compose.yml ps
```

### Step 4: Run Database Migrations & Seed Data
```bash
pnpm db:migrate
pnpm db:seed
```

### Step 5: Start the Development Server
Launch all applications and watchable packages via Turborepo:
```bash
pnpm dev
```
- **REST API & WebSocket Server**: `http://localhost:4000` (`ws://localhost:4000/ws`)
- **Web Client UI**: `http://localhost:5173`

---

## 3. Core Development Commands

| Operation | Command | Description |
| :--- | :--- | :--- |
| **Run All Services** | `pnpm dev` | Starts server & client with hot reloading |
| **Build Everything** | `pnpm build` | Compiles all packages and applications via Turbo |
| **Run All Tests** | `pnpm test` | Executes Vitest across all workspaces |
| **Type Check** | `pnpm typecheck` | Runs `tsc --noEmit` across all packages |
| **Lint & Format** | `pnpm lint` | Runs ESLint and Prettier checks |
| **Database Studio** | `pnpm db:studio` | Opens Drizzle Studio to inspect PostgreSQL data |
| **Stop Infrastructure**| `docker compose -f docker/docker-compose.yml down` | Stops local Postgres and Redis containers |
| **Reset Everything** | `docker compose -f docker/docker-compose.yml down -v` | Wipes database volumes and restarts clean |

---

## 4. Troubleshooting & Common Issues

### Issue: Port 5432 or 6379 is already in use
- **Cause**: A system PostgreSQL or Redis instance is already running locally outside Docker.
- **Fix**: Either stop the local host services (`sudo systemctl stop postgresql redis`) or adjust the mapped host ports in `docker/docker-compose.yml` (e.g., `5433:5432`).

### Issue: WebSocket Connection Refused (`ERR_CONNECTION_REFUSED`)
- **Cause**: `apps/server` has not finished starting, or the client is attempting to connect to the wrong port.
- **Fix**: Verify `apps/server` logs for `Server listening on port 4000` and ensure your browser connects to `ws://localhost:4000/ws`.

### Issue: Turborepo Cache Miss or Stale Build Output
- **Cause**: Build artifacts out of sync after branch switching.
- **Fix**: Run `pnpm clean` followed by `pnpm build`.
