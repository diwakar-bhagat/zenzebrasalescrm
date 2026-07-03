# ZenZebra CRM — Architecture

This describes the **actual current** system, verified against code — not
the aspirational structure from any planning document. Where the codebase
deviates from a "textbook" layered architecture (e.g. no repository layer),
that deviation is documented as intentional current state, not an error to
silently "fix."

## Data flow (sales)

```
Excel/CSV → excel-parser → staging_upload_rows → validate → commit
          → sales_fact → sales_fact_v → business-logic → API → UI
```

- Never insert Excel data directly into `sales_fact` — always through
  `staging_upload_rows` and `src/lib/founder/import-service.ts`.
- All analytics queries read `sales_fact_v` (or `purchase_fact_v` for
  purchases), never the raw fact tables directly, with one exception:
  `customer_metrics` (a view) is itself built on top of `sales_fact_v`.
- Purchases live in a **fully separate** fact table (`purchase_fact`) and
  are never merged into `sales_fact` (explicit invariant in
  `purchase-import-service.ts`).

Upload types (tracked via `upload_batches.upload_type`):
- `full_replace` — morning file (~17K rows): TRUNCATE + insert, with a
  backup table created first.
- `incremental` — intraday: UPSERT on the natural key
  `(sale_date, bill_no, billed_by, product_key)`.

## Folder structure (`src/`)

| Folder | Role |
|---|---|
| `app/` | Next.js 16 App Router — `(main)` dashboard layout group, `(external)` for login, `api/` route handlers |
| `components/ui/` | Shadcn primitives + custom shared widgets (`metric-card.tsx`, `chart.tsx`) |
| `components/founder/`, `components/store-overview/`, `components/dashboard/` | Domain-specific composed components (filter bar, performance tables, export button) |
| `config/` | `app-config.ts` — app metadata |
| `data/` | Static seed data (e.g. dev user list) |
| `hooks/` | `useRetention.ts`, `useCohorts.ts`, `useLTV.ts`, `useCAC.ts`, `useHealth.ts`, `useSegments.ts` + generic hooks |
| `lib/business-logic/` | Pure, DB-agnostic calculation/shared logic (see below) |
| `lib/services/` | DB-touching functions per domain (`retention.service.ts`, `cohort.service.ts`, `ltv.service.ts`, `cac.service.ts`) |
| `lib/founder/` | Excel import pipeline: `validation.ts`, `import-service.ts`, `purchase-import-service.ts`, `date-utils.ts`, `types.ts` |
| `lib/auth.ts`, `lib/cookie.client.ts` | Session auth |
| `lib/db.ts` | Neon client singleton |
| `navigation/` | Sidebar route config |
| `server/server-actions.ts` | Next.js server actions |
| `stores/` | Zustand: `founder/filter-store.ts` (dashboard filters), `preferences/`, `settings/` |
| `styles/`, `types/` | Theme CSS/presets, shared TS types |

**There is no `repositories/` layer.** Services in `src/lib/services/` query
Neon directly via raw SQL template strings. Do not introduce a repository
abstraction unless explicitly asked — it doesn't match how this codebase is
built today.

## Database

**Client:** `src/lib/db.ts` — `@neondatabase/serverless`, raw SQL template
literals (`` sql`SELECT ...` ``), no ORM/query builder. Supports
`.query()` and `.transaction()`.

**Migrations:** plain `.ts` scripts in `src/scripts/` (e.g.
`migrate-founder.ts`, `migrate-excel-ground-truth.ts`,
`migrate-customer-retention.ts`, `migrate-purchase-fact.ts`,
`migrate-store-command-center-schema.ts`, `migrate-odoo-webhook-tables.ts`,
`migrate-auth.ts`). No migration framework — run manually with `ts-node`.

### Core tables

- `sales_fact` — main transactional fact table. Columns (post-rename):
  `sku_code`, `item_name`, `customer_mobile`, `upload_id`, `product_key`
  (`COALESCE(sku_code, item_name)`), `mrp_amount`, `discount_amount`,
  `gross_amount`, `tax_amount`, `net_amount`, `bill_no`, `billed_by`,
  `sale_date`. Unique key: `(sale_date, bill_no, billed_by, product_key)`.
- `staging_upload_rows` — transient JSONB staging rows, deleted after a
  successful commit.
- `upload_batches` — upload audit trail, extended with `upload_type`,
  `latest_sale_date`, `stores_found`, `categories_found`.
- `store_dimension` / `store_alias_mapping` — canonical store identity +
  raw `billed_by` alias normalization (seeded: `SWN01`/`SmartworksNoida
  Noida`, `KLJ01`/`Klj store`).
- `purchase_fact`, `purchase_batches`, `staging_purchase_rows` — mirror the
  sales pipeline for vendor-side purchases.
- `users`, `sessions` — auth.
- `crm_leads`, `purchase_orders`, `purchase_order_lines`,
  `inventory_snapshots`, `inventory_movements` — Odoo-sync tables (see
  `ODOO_INTEGRATION_PLAN.md`).

### Views

- `sales_fact_v` — **the** analytics source. Normalizes `billed_by` to one
  of `'Klj store' | 'SmartworksNoida Noida' | 'Head office'` and adds
  `store_display_name`. Store exclusion for category scoping happens here
  or in `filter-sql.ts`, never hardcoded in components.
- `purchase_fact_v` — same pattern for purchases.
- `customer_metrics` — per-`customer_mobile` rollup (first/last purchase
  date, total orders, total revenue, AOV, avg purchase gap). Built on
  `sales_fact_v`. **This one is actively used** by `cac.service.ts` and
  `retention.service.ts`.
- `customer_ltv`, `customer_segments`, `customer_retention_summary` — exist
  in the schema (`migrate-customer-retention.ts`) but as of this writing
  **are not queried by any service**. `ltv.service.ts` and
  `retention.service.ts` instead recompute equivalent logic inline via CTEs
  on `sales_fact_v` + `customer_metrics`. This is a known inconsistency —
  see `progress-tracker.md`. Don't assume these views are the live source
  without checking the service file first.
- `data_freshness` — latest sale date / staleness check.

### Ground truth verification

After a full re-import, run:
```
npx ts-node -P tsconfig.scripts.json src/scripts/verify-ground-truth.ts
```
This checks row/bill/revenue/customer counts and two financial identities
(`MRP - Discount = Collection`, `Collection - GST = Revenue`) against a
hardcoded expected snapshot, tolerance ±50.

## Service layer

Each `src/lib/services/*.service.ts` file exports functions that take
`(db, periods, filters)` and run raw SQL directly against `sales_fact_v` /
`customer_metrics`. No abstraction between SQL and the API route.

- `cac.service.ts` — `getCacMetrics()`. **Marketing spend is a hardcoded
  monthly constant** (₹200K total / ₹150K Smart Works / ₹50K KLJ, scaled by
  days-in-period), not real spend data — see `progress-tracker.md`.
- `cohort.service.ts` — `getCohortMetrics()`, CTE-based monthly cohort
  retention/revenue/AOV/bill-cuts.
- `ltv.service.ts` — `getLtvDistribution()`, `getTopCustomers()`.
- `retention.service.ts` — `getRetentionOverview()`, `getRetentionTrend()`,
  `getAiInsights()`, `getCustomerSegments()`, `getCustomerHealth()` (RFM).

## Business logic layer (`src/lib/business-logic/`)

Shared, DB-agnostic helpers — the single source of truth for cross-cutting
concerns. Never reimplement these inline in a component or route:

- `comparison.ts` — **owns all period/comparison-window logic**
  (`getDefaultPeriod`, `getMirrorPeriod`, `getComparisonPeriods`,
  `growthPct`, `cleanDashboardFilters`). Mirror-period only, no
  calendar-month shortcuts. Components never compute comparison windows.
- `filter-sql.ts` — `FOOD_CATEGORIES`, `retailCategoryClause()` (the
  `categoryScope: 'retail'` exclusion of LIVE MENU/SNACK CORNER/BEVERAGES).
- `metrics.ts` — reusable SQL aggregate fragments
  (`METRICS.revenue/collection/gst/discount/bills/mrp`).
- `customer-intelligence.ts` — `getCustomerIntelligence()` (total/repeat/new
  customers, top 10 by revenue).

## API layer

Routes under `src/app/api/customer-retention/{overview,cohorts,segments,
ltv,cac,health}/route.ts` all follow the same pattern:

```ts
const defaults = getDefaultPeriod().current;
const filters = cleanDashboardFilters({ startDate, endDate, store, categoryScope });
const periods = getComparisonPeriods(filters);
// call service(s) via Promise.all
return NextResponse.json({ success: true, data: { ... } });
// on error: { success: false, error: message }, status 500
```
`export const runtime = "nodejs"` on all data routes (Neon compatibility).

**None of the six customer-retention routes perform auth checks.** This is
inconsistent with the rest of the app's session-cookie model and is flagged
as an open item in `progress-tracker.md` — don't assume it's intentional,
but don't silently add auth either without confirming with the user first.

## Auth

Custom session system, not NextAuth: `src/lib/auth.ts`.
- Passwords hashed with Argon2id (`@node-rs/argon2`).
- Session token in `zz_session` cookie (httpOnly, secure in prod, sameSite
  strict, 8h maxAge), backed by a `sessions` table (dev fallback: in-memory
  Map).
- Flow: `POST /api/auth/login` → `createSession` → `setSessionCookie`;
  `GET /api/auth/me` validates and returns the user.

## State (Zustand)

- `stores/founder/filter-store.ts` — the shared dashboard filter state
  (date range, store, category, brand, sku, categoryScope, compare mode).
  This is what feeds API params — components never hold their own filtered
  dataset.
- `stores/preferences/preferences-store.ts` — theme/layout prefs.
- `stores/settings/settings-store.ts` — currency/timezone/company config.

## Next.js version note

This project pins `next: ^16.2.4`, a version with breaking changes vs.
older/training-era Next.js knowledge (see `AGENTS.md` at repo root — this is
an existing, enforced convention, not new guidance). Before writing App
Router / Route Handler / caching / middleware code, check
`node_modules/next/dist/docs/` for this version's actual behavior rather
than relying on prior pattern knowledge.
