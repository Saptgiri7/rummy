---
name: ui-ux-pro-max
description: >-
  Comprehensive UI/UX design intelligence and design system guidance for web and mobile.
  Use this skill when designing pages, refactoring UI components, choosing color palettes,
  improving visual hierarchy, ensuring accessibility (WCAG AA/AAA), and applying professional
  design system tokens.
---

# UI/UX Pro Max — Design Intelligence

Design intelligence and rules for crafting professional, non-generic user interfaces and design systems.

---

## Priority Order for Design Engineering

When creating or revising any interface, follow these 10 categories in order:

| Priority | Category | Key Must-Haves | Anti-Patterns to Avoid |
|---|---|---|---|
| **1. Accessibility** | CRITICAL | Minimum contrast 4.5:1, visible focus rings, aria-labels for icon buttons. | Gray-on-gray low contrast, icon-only buttons with no aria-label. |
| **2. Touch & Pointer** | CRITICAL | Minimum target size 44×44px, ≥8px spacing, immediate active feedback. | Reliance on hover only, 0ms instant state flickers. |
| **3. Performance** | HIGH | Fast render times, zero cumulative layout shift (CLS < 0.1), reserve container aspect ratios. | Layout shifts when images or cards load, unoptimized assets. |
| **4. Style Cohesion** | HIGH | Consistent design language (e.g. Modern Casino, Tactile Dark, Refined Luxe). | Mixing flat, neomorphic, and cartoonish styles inconsistently. |
| **5. Layout & Responsive** | HIGH | Fluid flex/grid layouts, mobile-first breakpoints, zero horizontal body overflow. | Hardcoded fixed pixel widths (`width: 1200px`), clipping on mobile. |
| **6. Typography & Color** | MEDIUM | Base 16px, line-height 1.5, semantic token naming, tabular numbers for stats. | Body text < 12px, hardcoded raw hex colors spread across files. |
| **7. Motion & Transition** | MEDIUM | Purposeful easing (150–250ms), motion conveys spatial hierarchy. | Infinite distracting animations, continuous transforms that shift hitboxes. |
| **8. Forms & Feedback** | MEDIUM | Clear inline labels, errors positioned near fields, immediate button loading state. | Placeholder-only inputs, silent form submission failures. |
| **9. Navigation & Modals** | HIGH | Predictable dismiss via Escape or backdrop click, clean focus trapping. | Unclosable modals, trapped navigation, missing close buttons. |
| **10. Data Display** | LOW | Distinct visual badges, legible scoreboards, contextual tooltips. | Relying on color alone to indicate winning or losing states. |

---

## Detailed Rules & Checklists

For exhaustive rules across all 10 categories, see [references/quick-reference.md](./references/quick-reference.md).
