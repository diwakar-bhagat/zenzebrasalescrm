# ERP architecture

**Primary source of truth:** Odoo 19 Enterprise SaaS
**Canonical store:** PostgreSQL (Neon)
**Realtime strategy:** webhook-first, scheduled pull as a safety net
**Excel:** compatibility adapter
**Dashboard:** reads the canonical database only, never the ERP

> Supersedes `ODOO_INTEGRATION_PLAN.md`, which described a Make.com relay for an Odoo plan
> "with no external API". That is no longer accurate: the integration talks to Odoo directly
> over JSON-RPC.

---

## Ingestion contract

Every adapter converts its input into `CanonicalSaleLine[]` and hands it to one writer. No
adapter writes `sales_fact` directly.

```
Odoo webhook ─┐
Odoo pull    ─┼─► normalizeOdooOrder ─► ingestSalesLines ─► sales_fact ─► sales_fact_v
Excel        ─┴─► excel-parser ─► staging_upload_rows ─► commit ─┘
```

| Module | Responsibility |
|---|---|
| `src/lib/erp/types.ts` | `CanonicalSaleLine` — the contract |
| `src/lib/erp/normalize-odoo-order.ts` | Odoo `pos.order` → canonical rows |
| `src/lib/erp/odoo-fetch.ts` | JSON-RPC reads, line dereferencing, product metadata |
| `src/lib/erp/ingest-sales.ts` | The single writer into `sales_fact` |
| `src/lib/erp/store-resolver.ts` | Memoized store identity resolution |
| `src/lib/erp/webhook-log.ts` | Delivery logging |
| `src/lib/erp/sync-health.ts` | Health computation |

**Why one mapper.** The same order used to be mapped three different ways — the primary
webhook, the `/sales` webhook and the sync script disagreed on `category`, `brand`,
`payment_method`, `upload_id` and whether `customer_mobile` was written at all. An order
arriving by two paths produced two different rows.

### Mapping rules worth knowing

- **`discount` is a percentage.** Odoo stores `pos.order.line.discount` as 0–100, not an
  amount. `discount_amount = mrp_amount × discount / 100`. Writing the raw value recorded a
  10% discount as ₹10.
- **`sale_date` is store-local.** Odoo returns naive UTC. Dates are converted to
  `Asia/Kolkata` before truncation; taking the UTC date mis-files any sale after 18:30 UTC.
- **Category comes from the product.** `pos.order.line` carries no category, so
  `product.product.categ_id` is fetched and attached. Hardcoding a synthetic category breaks
  the `categoryScope: retail` filter, which excludes LIVE MENU, SNACK CORNER and BEVERAGES.
- **`source_event_at` is Odoo's `write_date`.** Reflection time is
  `ingested_at − source_event_at`. Without it, latency is unmeasurable.

---

## Provenance

`sales_fact.source_system` is the **single** provenance column:

| Value | Meaning |
|---|---|
| `odoo_webhook` | Real-time delivery |
| `odoo_sync` | Scheduled/backfill pull |
| `excel` | Spreadsheet import adapter |

Plus `ingested_at` (when we stored it), `source_event_at` (when Odoo recorded it) and
`webhook_event_id` (the delivery that produced the row).

> A previous migration added `source` and `sync_type` with `DEFAULT 'WEBHOOK'`/`'REALTIME'`.
> PostgreSQL applies a default to existing rows, so all 25,696 rows — including every Excel
> import since Sep 2025 — claimed to have arrived by real-time webhook. Both columns were
> dropped. **When adding a provenance column, backfill explicitly before setting a default.**

---

## Observability

`webhook_events` records **every** delivery, including ones turned away:

| Status | Meaning |
|---|---|
| `RECEIVED` | Accepted, in flight |
| `PROCESSED` | Ingested successfully |
| `FAILED` | Reached ingestion and errored |
| `REJECTED_AUTH` | Bad or missing secret |
| `INVALID_PAYLOAD` | Malformed body |
| `IGNORED` | A model this endpoint does not handle |

Logging happens *before* the auth check. Rejected deliveries used to return 401 with no
record, which is exactly why the integration sat at zero successful deliveries with nothing
anywhere explaining why.

`sync_cursors` (one row, `odoo_pos_sync`) tracks the scheduled pull: `last_success_at`,
`last_error`, `consecutive_failures`. It previously only ever wrote on success, so a failed
sync was indistinguishable from one that found nothing to do.

---

## Health reporting

`GET /api/system/sync-health`. Mode is derived, never asserted:

| Mode | Condition |
|---|---|
| `live` | Successful webhook < 5 min ago and 24h success rate ≥ 95% |
| `scheduled` | No recent webhook; last ingestion < 26h |
| `delayed` | Last ingestion 26–48h, or success rate < 95% |
| `offline` | > 48h, or ≥ 3 consecutive sync failures |

**Unmeasurable means null.** Reflection time is absent until webhook rows exist; the SLA
percentage is withheld below 20 samples, where one delivery reads as 0% or 100%. Queue depth
and server load are not reported at all — there is no queue and no load signal on Vercel, so
any number would be invented.

---

## Deployment constraints

- **Vercel Hobby caps cron at one run per day.** The scheduled pull cannot be a near-real-time
  fallback. If webhooks stop, data is stale until the next daily run, and the badge says
  `Synced` rather than `Live`. Upgrading to Pro is what unlocks a frequent fallback.
- **Vercel Cron cannot send custom headers.** It authenticates with
  `Authorization: Bearer $CRON_SECRET`. `/api/admin/odoo-sync` accepts both that and
  `x-webhook-secret`; requiring only the latter would 401 the cron and stop the pull silently.

---

## Not implemented

`/api/webhooks/odoo/{crm,purchase,inventory}` return **501**. Their tables
(`crm_leads`, `purchase_orders`, `inventory_snapshots`, `inventory_movements`) were never
created — `migrate-odoo-webhook-tables.ts` has not been run — and no part of the application
reads them. They previously returned 500 on every delivery.

To enable one: run the migration, build a reader, then implement ingestion through
`src/lib/erp` the way `/api/webhooks/odoo` does.
