# ZenZebra CRM — Project Overview

## What this is

An internal retail analytics dashboard for ZenZebra, covering two physical
stores: `Klj store` and `SmartworksNoida Noida`. Built on a Next.js 16
admin-dashboard template (Studio Admin / `next-shadcn-admin-dashboard` fork),
backed by Neon serverless Postgres.

Data currently arrives as daily/intraday Excel exports from POS and is
imported through a staging → validate → commit pipeline (see
`architecture.md`). A migration to real-time Odoo webhook sync (sales, CRM,
purchase, inventory) is planned and partially scaffolded — see
`ODOO_INTEGRATION_PLAN.md` at the repo root.

Users are internal staff/owner, authenticated via a custom session-cookie
login (no public signup). Currency/locale are fixed to INR / `Asia/Kolkata`
(`src/stores/settings/settings-store.ts`).

## Dashboard modules

Existing routes under `src/app/(main)/dashboard/`:

- `store` — Store Overview
- `sales` — Sales Analytics
- `analytics` — web/footfall analytics
- `crm` — CRM (Odoo lead pipeline)
- `finance`
- `ecommerce`
- `retention` — **Customer Retention** (this is the module most recently
  built out): `overview`, `cohorts`, `segments`, `ltv`, `cac`, `health`

The Customer Retention module is **already implemented** end-to-end (pages +
API routes + service layer + business logic) — it is not a greenfield build.
Any future work here is an *iteration* on existing code, not a from-scratch
build. See `progress-tracker.md` for what's done vs. open.

## Why Customer Retention exists as a module

The module exists to answer owner-facing questions that a generic sales
dashboard doesn't:

- Are customers coming back, and how much are they worth (LTV)?
- Is growth coming from new customers or repeat spend?
- Is acquisition cost (CAC) sustainable relative to LTV?
- Which customer cohorts/segments are healthiest or at risk (RFM)?

These map directly to the built pages: **Overview** (KPIs + trend + AI
insights), **Cohorts** (retention/revenue/AOV/bill-cuts heatmaps),
**Segments** (new vs. returning), **LTV** (distribution + top customers),
**CAC** (spend, LTV:CAC ratio, payback period), **Health** (RFM segments:
champions/loyal/at-risk/lost).

Ideas beyond the current six pages (revenue decomposition, churn-risk
scoring, employee/store quality ranking, revenue forecasting) are documented
as **candidate Phase 2 work** in `progress-tracker.md` — they are not
implemented and should not be assumed to exist.

## Out of scope (V1)

- Weather/footfall correlation → deferred to a future Analytics module.
- Marketing-spend integration for CAC — currently a hardcoded constant in
  code, not a real spend feed (flagged in `progress-tracker.md`).

## Source of truth

Real Neon column names and store names are absolute — see the "Source of
Truth" section in the repo root `CLAUDE.md`. Do not use product-doc examples
or naming from any pasted planning document (including prior ChatGPT
brainstorms) over what's actually in the database/migrations.
