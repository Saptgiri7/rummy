# UI/UX Pro Max — Comprehensive Reference Manual

## 1. Color System Architecture

### Semantic Tokens
Never use ad-hoc hex values in components. Organize colors into clear semantic layers:
- **Surface / Background**: Primary felt, table borders, panel containers, modal backdrops.
- **Content / Text**: Primary (`#f8fafc`), Secondary (`#94a3b8`), Muted (`#64748b`), Inverted (`#0f172a`).
- **Interactive / Brand**: Gold Primary (`#d4af37`), Emerald Success (`#10b981`), Crimson Alert (`#ef4444`), Sky Info (`#38bdf8`).
- **State Borders**: Subtle (`rgba(255, 255, 255, 0.08)`), Focus (`rgba(212, 175, 55, 0.5)`).

### The 60-30-10 Rule
- **60% Dominant Base**: Neutral dark table felt or room background.
- **30% Secondary Structure**: Card slots, meld groupings, opponent seats, headers.
- **10% Accent Energy**: Active turn indicators, draw pile glow, winning declaration banner.

---

## 2. Typography & Layout Hierarchy

1. **Heading Hierarchy**:
   - `h1`: Page title / Brand name (e.g. 1.75rem – 2.25rem, font-weight 800, tight tracking).
   - `h2`: Section & Modal titles (e.g. 1.25rem – 1.5rem, font-weight 700).
   - `h3`: Card / Group labels (e.g. 0.85rem – 1rem, font-weight 600).
2. **Numeric Readability**:
   - Turn timers, scoreboards, and penalty chips must set `font-variant-numeric: tabular-nums;`.
3. **Spacing Scale**:
   - Standard 4px baseline grid: `4px (xs)`, `8px (sm)`, `12px (md)`, `16px (lg)`, `24px (xl)`, `32px (2xl)`.

---

## 3. Micro-Interactions & Motion Easing

- **Button Press**:
  ```css
  button:active {
    transform: scale(0.98);
    transition: transform 70ms ease-out;
  }
  ```
- **Card Hover Elevation**:
  ```css
  .rummy-card {
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease;
  }
  .rummy-card:hover {
    transform: translateY(-6px);
  }
  ```
- **Draw Pile Pulse**:
  Use static box-shadow or drop-shadow animations without spatial coordinate transforms:
  ```css
  @keyframes slot-pulse {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.5)); }
    50% { filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.95)); }
  }
  ```

---

## 4. Accessibility (WCAG 2.1 AA Standards)

- Contrast ratio must exceed **4.5:1** for standard text against background.
- Every interactive button without explicit text must have an `aria-label`.
- All modals must be dismissible via both clicking the backdrop and pressing the `Escape` key.
- Elements with keyboard focus must display an explicit `focus-visible` ring.
