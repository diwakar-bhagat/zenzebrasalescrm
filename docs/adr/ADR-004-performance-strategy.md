# ADR-004: Performance Budgets & Lazy Rendering Strategy

* **Status**: Accepted
* **Date**: 2026-07-27
* **Author**: ZenZebra Enterprise Architecture Team

## Context & Problem
Dashboard pages feature multiple charts, heavy tabular data, and dynamic analytics. Unoptimized chart re-renders and unbatched component updates can cause frame drops and initial load delays. All optimizations must occur strictly above the Lock Line without altering any SQL queries or metric calculation formulas.

## Decision
We will implement performance optimizations across the UI and API presentation layers:
1. **Performance Measurement Envelopes**: Track execution latency via `performance.now()` in server endpoints.
2. **Lazy Rendering**: Use Next.js `dynamic()` imports with custom loading skeletons for heavy Recharts components.
3. **Component Memoization**: Wrap presentation cards and table rows with `React.memo` to prevent unnecessary re-renders when global filters remain unchanged.
4. **Performance Budgets**:
   - Initial JS Bundle: `< 300 KB` (gzipped)
   - Dashboard Initial Load: `< 2.0 s`
   - API Latency Envelope: `< 200 ms`
   - Chart Re-render: `< 100 ms`
   - DB Queries: `< 100 ms`

## Consequences
* **Positive**:
  - Snappy, responsive UI with zero lag during filter transitions.
  - Reduced main-thread execution time.
  - Zero risk to underlying metrics or database calculation logic.
* **Negative**:
  - Requires dynamic import wrappers for heavy client-side chart elements.

## Rollback Strategy
Performance wrappers operate purely at the React/Next.js rendering layer. Disabling lazy loading or memoization returns rendering to standard React defaults with 0 risk to data accuracy.
