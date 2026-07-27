# ADR-003: Tokenized Dark Mode Design System & Glassmorphism Guidelines

* **Status**: Accepted
* **Date**: 2026-07-27
* **Author**: ZenZebra Enterprise Architecture Team

## Context & Problem
Different dashboards across ZenZebra (Sales, CRM, Customer Intelligence, Finance, Net Purchase) used ad-hoc Tailwind classes, inconsistent border radiuses, and mixed dark mode colors. We require a single source of truth for design tokens without altering any business logic or dataset keys.

## Decision
We will establish a tokenized design system in `src/styles/tokens.ts` and `src/app/globals.css`:
1. **Color Tokens**: Dark-mode curated palette (`zinc-950` backgrounds, `zinc-900` card fills, `white/10` glass borders, `emerald-500` positive growth, `rose-500` negative growth).
2. **Spacing & Radius Tokens**: Standardized radiuses (`rounded-xl` for inner components, `rounded-2xl` for executive cards).
3. **Glassmorphism Tokens**: `backdrop-blur-xl`, `bg-white/5`, `shadow-[0_8px_32px_rgba(0,0,0,0.08)]`.
4. **Dashboard Layout Order**: All dashboard modules follow the exact 6-level hierarchy:  
   `Executive Header → KPIs → Insights → Charts → Tables → Details`

## Consequences
* **Positive**:
  - Consistent Apple/Linear-inspired dark glassmorphism across all pages.
  - Zero duplication of styling rules or component variations.
  - Strict isolation from business calculations and database logic below the Lock Line.
* **Negative**:
  - Requires updating visual layouts to strictly align with the 6-level hierarchy.

## Rollback Strategy
Design tokens operate strictly at the CSS/Presentation layer. Reverting token files has 0 impact on API data or calculation logic.
