# ADR-005: Enterprise Observability & Dashboard Intelligence Guidelines

* **Status**: Accepted
* **Date**: 2026-07-27
* **Author**: ZenZebra Enterprise Architecture Team

## Context & Problem
Executive dashboards require contextual interpretations, directional indicators, and operational health scores to help decision-makers digest numbers rapidly. These intelligence callouts must be computed above the Lock Line using existing KPI values without modifying underlying metric definitions or database logic.

## Decision
We will introduce standardized intelligence callouts and health badges:
1. **Health Indicators**: `HealthBadge` component (`Excellent`, `Healthy`, `Watchlist`, `Critical`) for LTV:CAC ratios, margin stability, and customer retention.
2. **Directional Badges**: Unified trend arrows (`▲`, `▼`) with percentage deltas and baseline comparison labels.
3. **Contextual Tooltips**: Informative hover tooltips providing business context for complex KPIs.
4. **Structured Telemetry**: Standardized error boundaries and execution logs for operational visibility.

## Consequences
* **Positive**:
  - Provides founders and sales managers with immediate, actionable business insights.
  - Standardizes health score display logic across all 6 dashboard modules.
  - Zero risk to business calculations or financial metric formulas.
* **Negative**:
  - Requires binding health score thresholds to existing metric outputs.

## Rollback Strategy
Dashboard intelligence features act as pure presentation enhancements. Disabling health badges or trend callouts restores classic numerical metric displays with 0 data impact.
