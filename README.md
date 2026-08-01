# ZenZebra CRM

Retail operating system for ZenZebra. **Odoo 19 Enterprise SaaS is the source of truth**;
the dashboard reads a canonical PostgreSQL database that Odoo feeds.

---

## Architecture

```
Odoo 19 Enterprise SaaS
        │
        ├── webhook  ──►  /api/webhooks/odoo   ── primary, real-time
        │                        │
        └── JSON-RPC ──►  scheduled pull       ── safety net, daily
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
| **Webhook** | `/api/webhooks/odoo` | Real-time | Primary. The only live path. |
| **Scheduled pull** | `/api/admin/odoo-sync` | Daily | Recovers whatever the webhook missed. |
| **Excel adapter** | `/dashboard/sales/upload` | Manual | Pre-ERP history and gap backfills. |

> On Vercel's Hobby plan cron is capped at one run per day. The scheduled pull is therefore a
> safety net, **not** a near-real-time fallback: if webhooks stop, data goes stale until the
> next daily run. The status badge reports this honestly as `Synced` rather than `Live`.

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

| Mode | Meaning |
|---|---|
| `live` | A webhook succeeded in the last 5 minutes. |
| `scheduled` | No recent webhook; data is arriving from the daily pull. |
| `delayed` | Data is 26–48h old, or deliveries are failing. |
| `offline` | Nothing for 48h, or three consecutive sync failures. |

Metrics that cannot be measured are returned as `null` and rendered as pending — reflection
time is absent until a webhook has actually been delivered, and the SLA percentage is withheld
below 20 samples. Nothing on this endpoint is a placeholder constant.

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
