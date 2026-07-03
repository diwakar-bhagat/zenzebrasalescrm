# ZenZebra CRM — Progress Tracker

_Last updated: 2026-07-02, initial creation of the context doc set._

## Current phase: Customer Retention module

Status: **built, not greenfield.** All six pages, their API routes, and
their service-layer logic already exist and appear feature-complete (real
SQL against `sales_fact_v`/`customer_metrics`, not stubs).

| Page | Route | API | Service | Status |
|---|---|---|---|---|
| Overview | `retention/overview` | `/api/customer-retention/overview` | `retention.service.ts` (`getRetentionOverview`, `getRetentionTrend`, `getAiInsights`) | Done |
| Cohorts | `retention/cohorts` | `/api/customer-retention/cohorts` | `cohort.service.ts` (`getCohortMetrics`) | Done — retention %, revenue, AOV, bill-cuts tabs |
| Segments | `retention/segments` | `/api/customer-retention/segments` | `retention.service.ts` (`getCustomerSegments`) | Done |
| LTV | `retention/ltv` | `/api/customer-retention/ltv` | `ltv.service.ts` (`getLtvDistribution`, `getTopCustomers`) | Done |
| CAC | `retention/cac` | `/api/customer-retention/cac` | `cac.service.ts` (`getCacMetrics`) | Done, but see open item #3 below |
| Health | `retention/health` | `/api/customer-retention/health` | `retention.service.ts` (`getCustomerHealth`, RFM) | Done |

Recent git history (inner repo) shows active work on exactly this: cohort/
retention/CAC/LTV/segments/health analytics, alongside a parallel effort on
purchase-file chunked upload and Odoo webhook integration.

## Open questions / known gaps

These are flagged, not fixed — each needs a user decision before touching:

1. **No auth on customer-retention API routes.** All six
   `/api/customer-retention/*` routes are unauthenticated, unlike the rest
   of the app's session-cookie model (`lib/auth.ts`). Confirm whether this
   is intentional (internal-network-only?) before adding auth or shipping
   more broadly.
2. **Unused DB views.** `customer_ltv`, `customer_segments`,
   `customer_retention_summary` exist in the schema
   (`migrate-customer-retention.ts`) but no service currently queries them
   — `ltv.service.ts` and `retention.service.ts` recompute equivalent logic
   inline via CTEs on `sales_fact_v` + `customer_metrics` instead. Decide:
   consolidate services onto the views (single source of truth, likely
   better perf) or drop the unused views.
3. **CAC marketing spend is a hardcoded constant**, not real spend data:
   ₹200K/month total, ₹150K Smart Works, ₹50K KLJ, scaled by
   days-in-period (`cac.service.ts`, `retention.service.ts`). Needs a real
   spend data source or an admin-configurable setting before CAC/LTV:CAC
   numbers can be trusted for decisions.
4. **Repo duplication.** `c:/Users/pc/Documents/zenzebrasalescrm-main`
   (outer) has no git history (fresh, empty `git init`, current branch
   `main` with zero commits). The nested
   `c:/Users/pc/Documents/zenzebrasalescrm-main/zenzebrasalescrm/` (inner)
   is the real repo with full history and a GitHub remote
   (`diwakar-bhagat/zenzebrasalescrm`). All context docs and future work
   target the **inner** folder. Consider cleaning up the outer duplicate
   folder to avoid confusion in future sessions — not done here since it
   wasn't asked for.

## Not started (candidate Phase 2, unconfirmed priority)

From founder-question brainstorming, not yet built — don't assume any of
these exist:
- Revenue decomposition (new-customer vs. AOV vs. frequency growth split)
- Churn-risk scoring (days-since-last-purchase vs. average gap)
- Cohort quality score (weighted retention/LTV/AOV/frequency composite)
- Revenue forecast / "locked-in" backlog projection
- Store-level cohort quality ranking
- Employee (`billed_by`)-level customer retention ranking
- "Emerging VIP" predictive segment

## Next steps

Awaiting user direction on which open item (1–4 above) or which Phase 2
candidate to prioritize next.
