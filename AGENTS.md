# Workspace Engineering Rules & Directives

## 1. MANDATORY Knowledge & Memory Graph Synchronization
Whenever you modify, fix, refactor, or add features to this codebase:
- You **MUST** update [docs/knowledge-graph.md](file:///home/saptgiri7/Desktop/rummy/docs/knowledge-graph.md) to reflect any changes in architecture, package boundaries, WebSocket protocol events, database schema, or engine rules.
- You **MUST** update [docs/memory-graph.md](file:///home/saptgiri7/Desktop/rummy/docs/memory-graph.md) to document any architectural decisions, failure patterns, root cause discoveries, or gotchas encountered during your work.
- Never mark a coding task as complete without updating both graphs.

## 2. Anti-Vibe UI/UX Design Engineering Standards
When modifying or creating user interfaces:
- Follow the guidelines in `.agents/skills/anti-vibe-design/` and `.agents/skills/ui-ux-pro-max/`.
- Avoid generic AI aesthetic clichés: indiscriminate purple/cyan neon glows, unformatted emojis as icons, low-contrast gray-on-gray text, and instantaneous 0ms state transitions.
- Enforce human-crafted design excellence: crisp semantic borders, purposeful micro-interactions (150–250ms spring transitions), tabular numbers for counters/timers, accessible contrast ratios (WCAG AA/AAA), and authentic casino table ergonomics.

## 3. Log & Memory Hygiene
- Never let service logs grow unbounded during test runs. Run `pnpm clear:logs` (`scripts/clear-logs.sh`) to reclaim memory and disk space after intensive testing.

## 4. Quality Verification
- Before completing tasks, ensure:
  1. `pnpm -r typecheck` passes with 0 errors.
  2. `pnpm -r test` passes all unit and integration test suites.
  3. `pnpm test:e2e` passes all Playwright browser automated tests.
