# ZenZebra CRM

Retail operating system for ZenZebra. **Odoo 19 Enterprise SaaS is the source of truth**;
the dashboard reads a canonical PostgreSQL database that Odoo feeds.

---

## Architecture

```
Odoo 19 Enterprise SaaS
        │
        ├── webhook  ──►  /api/webhooks/odoo/<secret>  ── primary, ~1 second
        │                        │
        └── JSON-RPC ──►  reconciliation pull          ── safety net, every 5 min
                                 │
                                 ▼
                    normalize → ingest  (src/lib/erp)
                                 │
                                 ▼
                   Canonical PostgreSQL (Neon)
                     sales_fact → sales_fact_v
                                 │
                                 ▼
                    business-logic → API → UI

Excel  ──►  import adapter  ──►  staging_upload_rows ──►  sales_fact
            (pre-ERP history, gap backfills)
```

The dashboard never queries Odoo. It reads `sales_fact_v` and does not know or care which
adapter produced a row — provenance is recorded in `source_system`, not branched on.

### Ingestion modes

| Mode | Path | Cadence | Role |
|---|---|---|---|
| **Webhook** | `/api/webhooks/odoo/<secret>` | ~1 second | **Primary.** Odoo pushes each sale as it is billed. |
| **Reconciliation pull** | `/api/admin/odoo-sync` | Every 5 min | Recovers anything the webhook missed. |
| **Excel adapter** | `/dashboard/sales/upload` | Manual | Pre-ERP history and gap backfills. |

> Vercel's Hobby plan caps its own cron at one run per day, so the reconciliation pull is
> driven by an external scheduler instead. Webhooks alone would lose data silently whenever a
> delivery fails; the pull re-covers everything since the stored cursor, so nothing is lost.

**Authentication.** Odoo's webhook action has no field for request headers, so the shared
secret is the final path segment of the URL — the pattern Slack uses for incoming webhooks:

```
https://<your-domain>/api/webhooks/odoo/<ODOO_WEBHOOK_SECRET>
```

`/api/webhooks/odoo` also accepts an `x-webhook-secret` header, for relays and smoke tests.
Both share one handler and produce identical rows.

### How Odoo actually delivers

Odoo's native *Send Webhook Notification* server action posts a **notification, not a record**:

```json
{ "_model": "pos.order", "_id": 1582 }
```

The webhook reads the order back over JSON-RPC before ingesting. This is why
`ODOO_URL` / `ODOO_DB` / `ODOO_USERNAME` / `ODOO_PASSWORD` are required even though
deliveries are pushed. See [docs/odoo-webhook-setup.md](docs/odoo-webhook-setup.md).

---

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL and the ODOO_* values
npm run dev
```

### Database setup

Migrations are idempotent TypeScript scripts run manually — there is no migration runner.

```bash
npm run migrate:erp-telemetry     # provenance columns, webhook_events, sync cursors
npm run repair:odoo-stores        # link any ERP rows with an unmapped store
```

### Sync operations

```bash
npm run sync:odoo                             # delta pull since the last cursor
npx ts-node -P tsconfig.scripts.json \
  src/scripts/odoo-backfill-sync.ts --backfill --since=2026-07-18
```

---

## Observability

`GET /api/system/sync-health` reports the pipeline's real state, and backs the status badge in
the dashboard header.

Health is measured by **when the pipeline last ran**, not when data last changed — the shops
close overnight, so keying off the newest row would raise a false outage every night. A
reconciliation run that finds zero new orders is a healthy run.

Thresholds derive from `SYNC_INTERVAL_MINUTES` (default 5):

| Mode | Meaning |
|---|---|
| `live` | Webhook or reconciliation succeeded within 2 intervals. |
| `scheduled` | Succeeded within 6 intervals — a missed tick. |
| `delayed` | Succeeded within 12 intervals, or ≥1 hour. |
| `offline` | Longer than that, or three consecutive failures. |

Metrics that cannot be measured are returned as `null` and rendered as pending. Nothing on this
endpoint is a placeholder constant.

**On-time rate** is the most useful single number: the share of sales visible within
`SLA_TARGET_SECONDS` (default 30). A webhook lands in about a second, so a low rate means
webhooks are being missed and reconciliation is doing the work. It is withheld below 20
samples, where one sale would read as 0% or 100%.

Every inbound delivery is recorded in `webhook_events`, **including rejected and malformed
ones**. To diagnose a silent integration, start there:

```sql
SELECT received_at, status, model, record_id, rows_upserted, error
FROM webhook_events ORDER BY received_at DESC LIMIT 20;
```

---

## Documentation

- [docs/erp-architecture.md](docs/erp-architecture.md) — data model, ingestion contract, provenance
- [docs/odoo-webhook-setup.md](docs/odoo-webhook-setup.md) — Odoo automation configuration and smoke tests
- [CLAUDE.md](CLAUDE.md) — agent rules and column contract
- [CONTRIBUTING.md](CONTRIBUTING.md) — project layout and conventions
