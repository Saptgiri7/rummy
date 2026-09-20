---
name: anti-vibe-design
description: >-
  Human-grade UI/UX design engineering rules to eliminate generic AI "vibe-coded"
  clichés. Use this skill whenever designing, styling, reviewing, or refactoring
  frontend components, layouts, typography, animations, color systems, or game interfaces
  to ensure they look professionally handcrafted, intentional, and high-fidelity.
---

# Anti-Vibe UI/UX Design Engineering Skill

This skill enforces human-grade craftsmanship, eliminating generic "vibe-coded" AI aesthetics in favor of intentional, high-density, accessible design engineering.

---

## 🚫 The "Vibe-Coded" AI Cliché Checklist (NEVER DO THIS)

| AI Vibe-Coded Cliché | Why It Looks AI-Made | The Professional Human Alternative |
|---|---|---|
| **Purple/Cyan Gradients Everywhere** | Cheap visual filler used by AI when lacking a distinct design identity. | Use a curated, domain-authentic palette (e.g. British racing green, deep emerald velvet, brushed brass, warm onyx, bone white). |
| **Indiscriminate Neon Glows** | AI wraps every button in `box-shadow: 0 0 30px #...`, creating an illegible blur. | Use crisp multi-layer shadows: a 1px crisp outline + a tight ambient occlusion shadow + a subtle directional shadow. |
| **Emojis as System Icons** | Placing ⚡, 👑, 🔑 as primary UI icons looks like an MVP prototype. | Use crisp SVG or Lucide icons (`<Users />`, `<ShieldCheck />`, `<Copy />`) sized to consistent 16px/20px viewboxes with matched stroke weights. |
| **Pill-Shaped Everything** | AI rounds every corner to `9999px` regardless of content density or scale. | Use proportional corner radii: `4px` for chips/tags, `8px` for inputs/cards, `12px` for modals, `16px` for floating banners. |
| **Instant 0ms State Changes** | Toggles and buttons flash without easing or feedback. | Add purposeful micro-interactions with spring physics (`150ms–220ms cubic-bezier(0.16, 1, 0.3, 1)`). |
| **Low-Contrast Gray on Gray** | `color: #6b7280` on `#111827` fails WCAG readability standards. | Guarantee minimum 4.5:1 contrast for normal text and 7:1 for headers. Use `#94a3b8` or `#cbd5e1` on dark surfaces. |
| **Missing Active/Focus States** | AI writes `:hover` but forgets `:active` and `:focus-visible`. | Always style `:active` (`transform: scale(0.98)`) and `:focus-visible` (2px offset ring for accessibility). |

---

## 🎨 Human Craftsmanship Rules for Card & Casino Interfaces

### 1. Authentic Material Physics & Card Anatomy
- **Playing Cards**: Proportions must approximate the physical B8 standard (~1:1.4 to 1:1.5 aspect ratio).
  - Use subtle bone-white gradient (`linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`).
  - Add a sub-pixel border (`1px solid rgba(0,0,0,0.12)`) so white cards never bleed into light highlights.
  - On hover: elevate `-6px` to `-8px` with an expanded drop shadow.
  - On selection: elevate `-16px` with a distinct, warm gold halo (`0 0 0 2px #d4af37, 0 8px 20px rgba(0,0,0,0.4)`).
- **Table Felt**:
  - Avoid flat green. Use a radial gradient with deep edge vignette (`radial-gradient(ellipse at center, #0f4d2a 0%, #062b16 75%, #03170b 100%)`).
  - Add subtle dashed gold inlay markings (`border: 2px dashed rgba(212, 175, 55, 0.35)`).

### 2. Typographic Discipline & Tabular Numerals
- **Tabular Figures for Numbers**: Any turn timers, score points, or card counts **MUST** use `font-variant-numeric: tabular-nums;` to prevent layout jitter as numbers change.
- **Typographic Scale**:
  - Small badges/labels: `0.7rem – 0.75rem`, uppercase, `letter-spacing: 0.06em`, `font-weight: 700`.
  - Body text: `0.9rem – 1rem`, `line-height: 1.5`, regular weight.
  - Subheadings/Buttons: `0.95rem – 1.05rem`, `font-weight: 600`.
  - Major table headings: `1.5rem – 2rem`, `letter-spacing: -0.02em`, `font-weight: 800`.

### 3. Clear State Signaling Without Visual Noise
- **Turn Indicators**:
  - The turn indicator must answer two questions in <100ms: *"Whose turn is it?"* and *"What action is expected?"*.
  - For active user: Green indicator with concrete verb (e.g. `YOUR TURN — Draw a card: Tap the Closed Deck or Open Pile`).
  - For waiting user: Neutral subdued indicator (e.g. `WAITING — Waiting for Player X to play their turn...`).
  - Avoid flashing or continuous translation animations that break click hitboxes or distract the player.

### 4. Interactive Feedback & Haptics
- Every interactive element must provide immediate visual feedback on pointer down:
  ```css
  .btn-action:active {
    transform: scale(0.97);
    filter: brightness(0.95);
    transition: transform 60ms ease-out;
  }
  ```
- Disabled buttons must communicate why they are disabled (reduced opacity `0.55`, cursor `not-allowed`, and a helpful status label such as `Connecting to Server...` or `Select 1 card to discard`).

---

## 🛠️ Review Checklist Before Shipping Any UI

- [ ] Does this look like an authentic product built by a design engineer, or a quick AI mockup?
- [ ] Are all icons consistent SVGs with matched line weights (no raw emojis in primary controls)?
- [ ] Are timer countdowns and points using `tabular-nums`?
- [ ] Do all interactive controls have `:hover`, `:active`, and `:focus-visible` styles?
- [ ] Is contrast at least 4.5:1 for body text and 3:1 for large text?
- [ ] Are animations using static visual filters (drop-shadow/opacity) rather than continuous coordinate transforms that could degrade test automation hitboxes?
