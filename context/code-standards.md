# ZenZebra CRM — Code Standards

## Source of truth for column/store names

Absolute (from repo root `CLAUDE.md`, do not override with any planning
doc): `net_amount`, `bill_no`, `customer_mobile`, `sku_code`, `item_name`,
`billed_by`. Ground-truth stores: `'Klj store'`, `'SmartworksNoida Noida'`.

## Next.js version fidelity

`next: ^16.2.4` — this major version has breaking changes vs. older
training-data patterns (`AGENTS.md`, repo root). Before writing App Router,
Route Handler, Server/Client Component, data-fetching, caching, or
middleware code, check `node_modules/next/dist/docs/` for this version's
actual behavior. Prefer the project's installed dependency behavior over
historical Next.js patterns.

## Layering — no repository abstraction

This codebase does **not** use a repositories layer. The real boundary is:

- `lib/business-logic/*.ts` — pure functions, no DB access (period math,
  SQL fragment constants, filter clause builders).
- `lib/services/*.service.ts` — DB-touching functions, raw SQL via
  `db.ts`'s Neon client, called from API routes.
- `app/api/**/route.ts` — parses request params, calls service functions
  (often in parallel via `Promise.all`), returns the response envelope.
- Components — render only. **Never calculate metrics, comparison windows,
  or filtered datasets inside React.** Comparison windows come from
  `comparison.ts`; filtering comes from the Zustand filter store → API
  params → SQL.

Do not add a `repositories/` folder or a query-builder/ORM layer unless
explicitly asked — it would be inconsistent with every existing service.

## Filters

Zustand filter state (`stores/founder/filter-store.ts`) → API query params
→ SQL `WHERE` clauses → computed API response. No frontend
`filteredDataset` derived from a larger fetched set. `store` filter values
are the raw `billed_by` string. `categoryScope: 'all' | 'retail'` — retail
excludes LIVE MENU / SNACK CORNER / BEVERAGES via `filter-sql.ts`; never
hardcode this exclusion list in a component.

## Comparison periods

`comparison.ts` owns all period logic — mirror-period only, no
calendar-month shortcuts. Never compute a comparison window inline in a
service or component.

## Response envelope

API routes return `{ success: true, data: {...} }` or
`{ success: false, error: string }`, status 500 on error. All
customer-retention/sales data routes set `export const runtime = "nodejs"`
(Neon serverless compatibility). Match this shape for any new route.

## TypeScript / linting

- `tsconfig.json`: `strict: true`, `noEmit: true`, `isolatedModules: true`,
  path alias `@/*` → `./src/*`.
- Linting/formatting via Biome (`biome.json`) — `npm run lint`,
  `npm run format`, `npm run check:fix`. `src/components/ui/**` has relaxed
  a11y/array-index-key rules (shadcn-generated code); don't relax rules
  elsewhere without reason.
- `.husky/pre-commit` regenerates theme presets
  (`npm run generate:presets`), stages `src/lib/preferences/theme.ts`, then
  runs `lint-staged` (Biome check --write on staged `.{js,ts,jsx,tsx}`).
  Don't bypass with `--no-verify`.

## Upload pipeline invariants

- Never insert Excel rows directly into `sales_fact` — always through
  `staging_upload_rows` + validation (`lib/founder/import-service.ts`).
- Purchases go to `purchase_fact` and are never merged into `sales_fact`.
- After a full re-import, run `verify-ground-truth.ts`
  (`npx ts-node -P tsconfig.scripts.json src/scripts/verify-ground-truth.ts`).

## When something looks like a hardcoded business assumption

Some existing code encodes business constants directly (e.g. CAC marketing
spend figures in `cac.service.ts`/`retention.service.ts`). Don't silently
"fix" or generalize these — flag them to the user and confirm intent before
changing, since they may reflect a real (if temporary) business decision
rather than a bug. See `progress-tracker.md` for the current list of these.

## General

- No comments explaining *what* code does — only non-obvious *why* (a
  workaround, a hidden constraint).
- No speculative abstractions, feature flags, or backwards-compat shims for
  scenarios that don't currently exist in this codebase.
- Match `ui-context.md` exactly for any new page — don't introduce new
  spacing units, card treatments, or color coding.
