# Tech Debt Register

Tracked, deliberately deferred items — not silently dropped. Each entry states what's deferred, why, and what would need to change to pick it up.

---

## TD-001 — Revenue Driver Consolidation

**Status:** Deferred

**Found during:** Sprint 1 (Root Cause Engine) research.

**What:** There are three independent "why did revenue move" implementations in the codebase:
1. `computeRevenueDriver()` — `src/lib/business-logic/revenue-driver.ts`. Used by `/api/sales/dashboard` and the Root Cause Engine.
2. A private `calculateRevenueDriver()` inside `src/lib/business-logic/store-performance.ts`, used only by `getStoreAovBillsHistory()` to populate each store's `aovBills.revenueDriver` text field.
3. (Removed in Sprint 1) the ad-hoc client-side logic that used to live in `BusinessHealthInvestigation` on the Sales Dashboard — this one is gone, replaced by the Root Cause Engine.

Only #2 remains outstanding. It has its own thresholds (`> 5` / `< -5`) and its own wording, independent of `computeRevenueDriver`'s thresholds and wording. They can, in principle, disagree for the same store in the same period.

**Reason for deferring:** Both implementations are currently verified against real data (Sprint 1's regression check confirmed `getStoreAovBillsHistory`'s output, including `calculateRevenueDriver`'s text, is byte-identical before/after the Sprint 1 refactor). Consolidating them now — before there's regression coverage comparing their outputs across a range of real scenarios — risks silently changing text that Store Overview users already see and rely on.

**Do this before picking it up:** Add a small regression fixture comparing `computeRevenueDriver` and `calculateRevenueDriver`'s output across a representative set of historical periods/stores. Only replace `calculateRevenueDriver` with a call to `computeRevenueDriver` once that fixture shows no behavior change for real data.

---

## TD-002 — KPI explanation gaps with no underlying data

**Status:** Deferred

**Found during:** Sprint 2 (Explainable KPI Framework) research.

**What:** The following signals were requested for KPI explanations but don't exist anywhere in the codebase today, and none are buildable without new SQL or new aggregate logic:

| Signal | Where it was wanted | Why it's not buildable today |
|---|---|---|
| Peak Hours | Bills explanation | `sales_fact` has a `sale_time` column, but `sales_fact_v` — the view every business-logic query reads — doesn't expose it. |
| Bundles / basket association | AOV explanation | No combo/bundle/co-occurrence concept exists anywhere in `business-logic/` or `intelligence/`. |
| Reactivated customers | Customers explanation | No such computed segment exists anywhere (confirmed via broad search). "Lost" customers *does* exist, via `src/lib/services/retention.service.ts`'s `getCustomerHealth`/`getCustomerHealthList` — a different module than assumed when this was first scoped. |
| Company-wide Forecast | Forecast explanation | `getStoreForecast()` (`src/lib/business-logic/store-forecast.ts`) requires a single `billedBy` — no function aggregates it across all stores. |
| Seasonality | Forecast explanation | Doesn't exist anywhere. The one file that sounds like it, `src/lib/intelligence/forecast/sales.ts`, is a hardcoded placeholder (fixed 8.5% trend, fixed 88%/75% confidence, `Math.sin` cosmetic noise) — not derived from real data. |

**Reason for deferring:** Building any of these would mean new SQL (exposing `sale_time` through the view, a basket-association query) or new aggregate business logic (company-wide forecast, seasonality) — both explicitly out of scope for Sprint 1/2's "compose existing data only, no new SQL" constraint.

**Do this before picking it up:** Treat each row as its own scoped mini-project with its own Lock Line review, not a quick addition to the Explainable KPI Framework — they involve real new calculations, not composition.
