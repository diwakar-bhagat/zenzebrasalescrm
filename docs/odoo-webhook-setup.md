# Odoo 19 webhook setup

How to wire Odoo 19 Enterprise SaaS to push POS sales into ZenZebra in real time, and how to
verify it is actually working.

---

## The payload Odoo really sends

This is the single most important thing to know, and the reason a naively-written receiver
appears to work while ingesting nothing useful.

Odoo's *Send Webhook Notification* server action posts a **notification, not the record**:

```json
{ "_model": "pos.order", "_id": 1582 }
```

There is no order name, no date, no amounts and no lines. A handler that treats this as a
complete order produces a row with a synthetic bill number and zero revenue.

`/api/webhooks/odoo` therefore reads the record back over JSON-RPC before ingesting. That is
why the `ODOO_*` credentials are required even though deliveries are pushed to us.

If you instead relay through Make.com or Zapier with fields already mapped, post that to
`/api/webhooks/odoo/sales`, which accepts a pre-mapped shape.

---

## 1. Environment

Set these on the server (Vercel → Project → Settings → Environment Variables):

| Variable | Purpose |
|---|---|
| `ODOO_URL` | e.g. `https://your-instance.odoo.com` |
| `ODOO_DB` | Odoo database name |
| `ODOO_USERNAME` | Integration user |
| `ODOO_PASSWORD` | Integration user password |
| `ODOO_WEBHOOK_SECRET` | Shared secret, `openssl rand -hex 32` |
| `CRON_SECRET` | For the scheduled pull; Vercel sends it as a bearer token |

> The webhook **fails closed**. If `ODOO_WEBHOOK_SECRET` is unset, every delivery is rejected
> with 401 and logged as `REJECTED_AUTH`. It previously accepted all traffic when unset, which
> left an unauthenticated public write path into `sales_fact`.

Prefer a dedicated Odoo integration user over a founder account, so credentials can be rotated
without locking anyone out.

---

## 2. Odoo automation

**Settings → Technical → Automation Rules → New**

| Field | Value |
|---|---|
| Model | `Point of Sale Order` (`pos.order`) |
| Trigger | *On save* (or *On UI change* → state = `paid`) |
| Before Update Domain | `[["state","in",["paid","done","invoiced"]]]` |
| Action To Do | **Send Webhook Notification** |
| URL | `https://<your-domain>/api/webhooks/odoo` |

Odoo's webhook action does not expose custom headers in every build. If yours does, add:

```
x-webhook-secret: <ODOO_WEBHOOK_SECRET>
```

If it does not, put a relay (Make.com, Cloudflare Worker) in front that attaches the header.
**Do not** pass the secret in the query string — that form is rejected, because it leaks the
secret into access logs and any intermediary that records URLs.

---

## 3. Verify

### Endpoint is reachable and configured

```bash
curl -s https://<your-domain>/api/webhooks/odoo | jq
```

Check `secretConfigured: true` and `canHydrateThinPayloads: true`. If the latter is false the
`ODOO_*` credentials are missing and thin notifications cannot be hydrated.

### A real thin notification

Use an id that exists in Odoo:

```bash
curl -i -X POST https://<your-domain>/api/webhooks/odoo \
  -H 'Content-Type: application/json' \
  -H "x-webhook-secret: $ODOO_WEBHOOK_SECRET" \
  -d '{"_model":"pos.order","_id":1582}'
```

Expect `200` with `hydratedViaJsonRpc: true` and `upserted` ≥ 1.

### A bad secret is recorded, not silently dropped

```bash
curl -i -X POST https://<your-domain>/api/webhooks/odoo \
  -H 'Content-Type: application/json' -H 'x-webhook-secret: wrong' -d '{}'
```

Expect `401` **and** a `webhook_events` row with `status = 'REJECTED_AUTH'`.

### Confirm in the database

```sql
SELECT received_at, status, model, record_id, rows_upserted, latency_ms, error
FROM webhook_events ORDER BY received_at DESC LIMIT 10;

SELECT bill_no, sale_date, billed_by, net_amount, source_system, source_event_at
FROM sales_fact WHERE source_system = 'odoo_webhook'
ORDER BY ingested_at DESC LIMIT 10;
```

### Confirm in the UI

The dashboard header badge should read **Live** within five minutes of a successful delivery,
and the panel should show a measured reflection time instead of "awaiting first webhook".

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| No `webhook_events` rows at all | Odoo is not reaching the server. Check the URL, and that the automation rule is active and its domain matches. |
| `REJECTED_AUTH` | Secret mismatch, or `ODOO_WEBHOOK_SECRET` unset on the server (fails closed). |
| `FAILED` — "Odoo API is not configured" | `ODOO_*` credentials missing; the thin notification cannot be hydrated. |
| `FAILED` — "pos.order N not found" | The integration user cannot read that record, or it was deleted. Check record rules. |
| `PROCESSED` but `rows_upserted: 0` | The order had no lines and no totals. |
| Badge says **Synced**, not **Live** | No webhook in the last 5 minutes; you are running on the daily pull. This is accurate, not a UI bug. |
| Scheduled pull stopped silently | `CRON_SECRET` mismatch. Vercel Cron sends `Authorization: Bearer`, never `x-webhook-secret`. |

Ingested rows whose store has no `store_dimension` match are recorded with a warning in
`webhook_events.error` and a null `store_id`. Fix by adding the alias and re-running:

```bash
npm run repair:odoo-stores
```
