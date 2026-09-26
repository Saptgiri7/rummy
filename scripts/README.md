# Operations & Automation Scripts

This directory contains operational, lifecycle, maintenance, and disaster-recovery scripts for the 13-Card Indian Rummy monorepo.

---

## 📜 Script Index

| Script | Purpose | NPM Alias | Default Safe Mode |
|---|---|---|---|
| [`start.sh`](./start.sh) | Start Docker infra + backend + frontend | `pnpm start` | Skips if already running |
| [`stop.sh`](./stop.sh) | Stop all services and Docker containers | `pnpm stop` | Preserves volumes |
| [`migrate.sh`](./migrate.sh) | Generate or apply database migrations | `pnpm migrate` | Apply only |
| [`recover-snapshot.sh`](./recover-snapshot.sh) | Reverts code, Docker volumes, and DB to verified snapshot | `pnpm recover:snapshot` | Interactive confirmation `[y/N]` |
| [`clear-logs.sh`](./clear-logs.sh) | Truncates `.log` files & removes test artifacts to free memory | `pnpm clear:logs` | Non-destructive truncation |

---

## 1. `start.sh`

### Purpose
Starts the entire Rummy platform: Docker infrastructure (PostgreSQL & Redis), backend server (port 4000), and frontend dev server (port 3000). Waits for health checks before proceeding to the next service.

### Flags
| Flag | Behavior |
|---|---|
| _(none)_ | Full startup: Docker + backend + frontend |
| `--infra` | Start Docker containers only |
| `--no-infra` | Skip Docker, start app servers only (assumes Docker is already running) |
| `--migrate` | Run database migrations after infra is up, before starting apps |
| `--help` | Show help |

### Usage
```bash
pnpm start                    # Full startup
pnpm start -- --infra         # Docker only
pnpm start -- --migrate       # Full startup + run migrations
pnpm start -- --no-infra      # Apps only (Docker already running)
```

---

## 2. `stop.sh`

### Purpose
Stops all running Rummy services: kills backend/frontend Node processes (via PID files and process name matching), then stops Docker containers.

### Flags
| Flag | Behavior |
|---|---|
| _(none)_ | Stop apps + Docker containers (preserves data volumes) |
| `--keep-db` | Stop apps only, leave Docker running |
| `--wipe` | Stop everything AND destroy Docker volumes (full data reset) |
| `--help` | Show help |

### Usage
```bash
pnpm stop                     # Stop all, keep data
pnpm stop -- --keep-db        # Stop apps, keep Docker running
pnpm stop -- --wipe           # Stop all + wipe database
```

---

## 3. `migrate.sh`

### Purpose
Manages Drizzle ORM database migrations: generate new migration files from schema changes, apply pending migrations, or perform a full fresh reset.

### Flags
| Flag | Behavior |
|---|---|
| _(none)_ | Apply pending migrations to the running database |
| `--generate` | Generate a new SQL migration from current Drizzle schema |
| `--fresh` | Wipe Docker volumes, restart infra, and apply all migrations from scratch |
| `--help` | Show help |

### Usage
```bash
pnpm migrate                  # Apply pending migrations
pnpm migrate -- --generate    # Generate migration from schema changes
pnpm migrate -- --fresh       # Full reset: wipe + re-apply
```

---

## 4. `recover-snapshot.sh`

### Purpose
Restores the entire repository, Git working tree, Docker infrastructure, and PostgreSQL database back to the verified **Stage 8 Stable Multiplayer Snapshot** (`v1.0.0-multiplayer-stable` / `snapshot/stage-8-stable`).

### When to Run
- If a subsequent refactor or feature branch introduces regressions, broken schemas, or corrupted runtime state.
- If you need to quickly reset your environment to the guaranteed passing baseline (0 type errors, 76/76 unit tests passed, Playwright 2-player E2E passed).

### Step-by-Step Execution Lifecycle
1. **Interactive Prompt**: Asks for explicit confirmation (`[y/N]`) before modifying your working tree (can be bypassed with `--force`).
2. **Pre-flight Checks**: Confirms that `git`, `docker`, and `docker compose` are installed, and that the Docker daemon is responsive.
3. **Working Tree Safety**: If any uncommitted changes exist in your working tree, automatically saves them to a timestamped `git stash` before switching.
4. **Git Checkout**: Checks out tag `v1.0.0-multiplayer-stable` (falling back to branch `snapshot/stage-8-stable`).
5. **Infrastructure Reset**:
   - Runs `docker compose -f docker/docker-compose.yml down -v --remove-orphans` to wipe corrupted database volumes.
   - Runs `docker compose -f docker/docker-compose.yml up -d` to launch clean PostgreSQL & Redis instances.
6. **PostgreSQL Health Polling**: Polls `rummy-postgres` with `pg_isready` (up to 30 seconds) until it accepts connections.
7. **Schema Restoration**: Executes `snapshots/schema.sql` via `psql` to create all required tables (`users`, `wallets`, `refresh_tokens`, `matches`, `match_players`). Verifies table count.
8. **Dependency & Build Sync**: Executes `pnpm install` and `pnpm -r build` across the monorepo packages.
9. **Log & Memory Hygiene**: Calls `scripts/clear-logs.sh` to purge residual test artifacts and truncate logs.
10. **Test Verification**: Runs `pnpm -r test` to verify all unit and integration test suites pass on the restored state.

### Usage
```bash
# Interactive mode (prompts for confirmation):
bash scripts/recover-snapshot.sh
# or
pnpm recover:snapshot

# Non-interactive mode (for automation/CI):
bash scripts/recover-snapshot.sh --yes
# or
pnpm recover:snapshot -- -y

# Skip test verification for faster recovery:
bash scripts/recover-snapshot.sh --yes --skip-verify

# Help flag:
bash scripts/recover-snapshot.sh --help
```

---

## 5. `clear-logs.sh`

### Purpose
Frees RAM and disk space by safely truncating log files and removing heavy test artifacts generated during test runs and browser automation.

### When to Run
- Mandatory per workspace engineering rules after running heavy browser E2E tests or test suites.
- When development server logs in `logs/` grow large.

### Step-by-Step Execution Lifecycle
1. **Log Truncation**: Locates all `*.log` files in `logs/` (`server.log`, `web.log`, `docker.log`, etc.) and truncates their size to 0 bytes (`truncate -s 0`). This frees disk space and OS buffer cache immediately while keeping open file descriptors valid for any actively running processes.
2. **Gitkeep Preservation**: Re-ensures `logs/.gitkeep` is present.
3. **Playwright Artifact Removal**: Deletes `apps/web/test-results/`, `apps/web/playwright-report/`, and root `test-results/` (trace files, video recordings, failure screenshots).
4. **Buffer Synchronization**: Runs `sync` to flush filesystem cache to disk.

### Usage
```bash
# Direct execution:
bash scripts/clear-logs.sh

# Or via root package script:
pnpm clear:logs
```

---

## 🛠️ Standards for Adding New Scripts

When adding new operational or automation scripts to this repository:
1. **Location**: Always place scripts in this `scripts/` directory.
2. **Permissions**: Make bash scripts executable: `chmod +x scripts/<script-name>.sh`.
3. **Safety Flags**: Use `set -e` at the top of bash scripts so failures halt execution immediately.
4. **Documentation**: Add an entry to this `scripts/README.md` detailing purpose, lifecycle, and usage flags.
5. **NPM Alias**: Add a corresponding script entry to root [package.json](../package.json).
6. **Documentation**: Update the script index in this directory and in the root [README.md](../README.md).
