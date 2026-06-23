# ZenZebra CRM — Agent Rules

## Source of Truth

**Excel column mapping is absolute source of truth.** Real Neon column names override any product-doc examples:

- `net_amount` (not `net_sales`)
- `bill_no` (not `bill_number`)
- `customer_mobile` (not `customer_id`)
- `sku_code`, `item_name`, `billed_by` (raw store values)

Ground-truth file: sheet `main`, stores `'Klj store'` and `'SmartworksNoida Noida'` only.

## Architecture

```
Excel → excel-parser.ts → staging_upload_rows → validate → commit → sales_fact → sales_fact_v → business-logic → API → UI
```

- **Never** insert Excel directly into `sales_fact` without staging.
- **All analytics queries** use `sales_fact_v`, never raw `sales_fact`.
- Store exclusion lives in the view WHERE clause only — do not hardcode staff names in components.

## Upload

- `full_replace`: morning file (~17K rows) — TRUNCATE + insert
- `incremental`: intraday — DELETE latest sale_date + insert
- Track batches in `upload_batches` (extended with `upload_type`, `latest_sale_date`)

## Comparison

- `comparison.ts` owns all period logic — **mirror period only** (no calendar-month shortcut)
- Components never compute comparison windows

## Filters

- Zustand filter state → API params → SQL → computed response (no frontend `filteredDataset`)
- `store` = raw `billed_by` value
- `categoryScope`: `all` | `retail` (retail excludes LIVE MENU, SNACK CORNER, BEVERAGES)

## Out of Scope V1

- Weather/footfall correlation → Future Analytics module

## Verification

After full re-import, run: `npx ts-node -P tsconfig.scripts.json src/scripts/verify-ground-truth.ts`
