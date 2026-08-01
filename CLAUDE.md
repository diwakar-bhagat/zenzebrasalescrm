# ZenZebra CRM — Agent Rules

## Source of Truth

**Odoo 19 Enterprise SaaS is the primary source of truth.** Excel is a compatibility adapter
for pre-ERP history and gap backfills, not the operational pipeline.

**Excel column mapping remains the absolute column contract.** Real Neon column names override
any product-doc examples:

- `net_amount` (not `net_sales`)
- `bill_no` (not `bill_number`)
- `customer_mobile` (not `customer_id`)
- `sku_code`, `item_name`, `billed_by` (raw store values)

Ground-truth file: sheet `main`, stores `'Klj store'` and `'SmartworksNoida Noida'` only.

## Architecture

```
Odoo webhook ─┐
Odoo pull    ─┼─► normalize → ingest ─► sales_fact ─► sales_fact_v ─► business-logic → API → UI
Excel        ─┴─► excel-parser → staging_upload_rows → validate → commit ─┘
```

- **All ERP ingestion goes through `src/lib/erp/`.** Never map Odoo fields inline in a route.
  `normalizeOdooOrder` is the only mapper; `ingestSalesLines` is the only writer.
- **Never** insert Excel directly into `sales_fact` without staging.
- **All analytics queries** use `sales_fact_v`, never raw `sales_fact`.
- The dashboard reads the canonical database only — never Odoo directly.
- Store exclusion lives in the view WHERE clause only — do not hardcode staff names in components.

### Odoo specifics that bite

- Odoo's native webhook posts `{"_model","_id"}` only. Hydrate over JSON-RPC before ingesting.
- `pos.order.line.discount` is a **percentage**, not an amount.
- Odoo timestamps are naive UTC; convert to `Asia/Kolkata` before deriving `sale_date`.
- `pos.order.line` has no category — fetch `product.product.categ_id`.

## Provenance

`sales_fact.source_system` is the single provenance column: `odoo_webhook` | `odoo_sync` | `excel`.
Also `ingested_at`, `source_event_at` (Odoo `write_date`), `webhook_event_id`.

**When adding a provenance column, backfill explicitly before setting a default.** A default on
`ALTER TABLE ADD COLUMN` is applied to every existing row and will silently relabel history.

## Ingestion

- **Webhook** (`/api/webhooks/odoo`) — primary, real-time. Fails closed on `ODOO_WEBHOOK_SECRET`.
- **Scheduled pull** (`/api/admin/odoo-sync`) — daily; Vercel Hobby caps cron at one run/day.
- **Excel adapter** — `full_replace` (morning file, ~17K rows: TRUNCATE + insert) or
  `incremental` (intraday: DELETE latest `sale_date` + insert). Batches tracked in
  `upload_batches` (extended with `upload_type`, `latest_sale_date`).

Every webhook delivery is logged to `webhook_events`, including rejected ones. When an
integration looks silent, query that table first.

## Comparison

- `comparison.ts` owns all period logic — **mirror period only** (no calendar-month shortcut)
- Components never compute comparison windows

## Filters

- Zustand filter state → API params → SQL → computed response (no frontend `filteredDataset`)
- `store` = raw `billed_by` value
- `categoryScope`: `all` | `retail` (retail excludes LIVE MENU, SNACK CORNER, BEVERAGES) —
  this is why ERP rows must carry real product categories

## Health reporting

Never report a metric that has not been measured. `/api/system/sync-health` returns `null` for
reflection time until webhook events exist, and withholds the SLA percentage below 20 samples.
Do not substitute a plausible constant, and do not show "Live" when data arrived from the daily
pull — `mode` is derived from real event timestamps.

## Out of Scope V1

- Weather/footfall correlation → Future Analytics module
- CRM / purchase / inventory webhooks — tables do not exist; routes return 501

## Verification

```bash
npx ts-node -P tsconfig.scripts.json src/scripts/verify-ground-truth.ts   # after full re-import
npm run repair:odoo-stores                                               # after adding store aliases
```
