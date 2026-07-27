# ADR-001: Shared UI Building Block Extraction Strategy

* **Status**: Accepted
* **Date**: 2026-07-27
* **Author**: ZenZebra Enterprise Architecture Team

## Context & Problem
Across the ZenZebra Sales CRM codebase, multiple pages (Sales Dashboard, CRM, Customer Intelligence, Finance, Net Purchase) contain duplicate or slightly variant component implementations for key elements like metric cards, status indicators, tables, and filters. This leads to code duplication, inconsistent styling, and higher maintenance overhead.

## Decision
We will extract standardized, highly reusable UI building blocks into `src/components/shared/` and `src/components/ui/`:
1. `MetricCard` & `TrendCard` — standardized KPI presentation with optional growth badges and trend arrows.
2. `DataTable` — unified tabular data display with sortable headers, pagination, and empty/loading states.
3. `SectionHeader` — consistent section titles, descriptions, and action slots.
4. `FilterBar` — reusable multi-select and date-range filter container.
5. `ChartContainer` — standardized wrapper for Recharts components with unified tooltip & responsive containers.
6. `LoadingState`, `ErrorState`, `EmptyState` — uniform fallback UI across all feature dashboards.

## Consequences
* **Positive**:
  - 100% consistent dark mode aesthetics and Apple-inspired glassmorphism across all dashboards.
  - Reduced bundle duplication and improved render performance.
  - Zero changes to underlying business logic, prop types, or dataset calculations.
* **Negative / Constraints**:
  - Existing feature components must be refactored carefully to ensure zero visual or functional regressions.

## Rollback Strategy
If any visual regression occurs, component changes can be reverted individually without affecting any backend API or business calculation logic.
