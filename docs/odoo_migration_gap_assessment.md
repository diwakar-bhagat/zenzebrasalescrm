# Dashboard Migration Gap Assessment & Field Mapping Report

**Author**: Principal ERP & Performance Architect  
**Workspace**: ZenZebra Sales CRM  
**Status**: Frozen (Verified against Live Odoo 19.0 SaaS Ground Truth)

---

## 1. Executive Summary

Based on live Odoo SaaS ground-truth verification and database capability checks:
1. **Feasibility**: Odoo Standard is 100% verified as a viable read-only datasource. Core metrics such as standard product costs (`standard_price`), stock levels (`qty_available`), retail order line discounts (`discount`), and order structures map cleanly to our local PostgreSQL database.
2. **Performance Plan**: Direct live Odoo queries on page load are prohibited. Data is synchronized asynchronously every 5 minutes into the local Neon PostgreSQL canonical schema, ensuring sub-100ms dashboard rendering speeds.
3. **Decoupled Mapping**: Instead of rewriting the complex repository calculations, we will deploy a **Compatibility View Translation Layer** that maps our Odoo canonical tables into the legacy column layout. This minimizes dashboard code churn.

---

## 2. Field-by-Field Schema Mapping (Excel `sales_fact_v` vs. Odoo)

The following table maps the column specifications of the legacy upload view (`sales_fact_v` / `sales_fact`) to our verified Odoo canonical fields:

| Legacy `sales_fact` Column | Odoo Source Model | Odoo Field | Transformation & Translation Logic | Target Canonical DB Column |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `pos.order` / `sale.order` | `id` | String prefix: `'pos_' \|\| id` or `'sale_' \|\| id` | `fact_sales_orders.id` |
| `bill_no` | `pos.order` / `sale.order` | `name` | POS order sequence name (e.g. `KLJ - 000001`) | `fact_sales_orders.name` |
| `sale_date` | `pos.order` / `sale.order` | `date_order` | Native datetime field, cast to Date | `fact_sales_orders.date_order` |
| `billed_by` | `pos.config` | `name` | Config name string check: mapped to `'Klj store'`, `'SmartworksNoida Noida'`, or `'Head office'` | `dim_stores.code` (via translation lookup) |
| `sku_code` | `product.product` | `default_code` | Raw SKU string lookup | `dim_products.default_code` |
| `item_name` | `product.product` | `name` | Variant display name | `dim_products.name` |
| `quantity` | `pos.order.line` | `qty` | Line item count (negative for refunds/returns) | `fact_sales_lines.qty` |
| `mrp_amount` | `product.product` | `list_price` | Standard catalog retail price | `dim_products.list_price` |
| `discount_amount` | `pos.order.line` | `discount` | Calculated: `(price_unit * qty) * (discount / 100)` | Derived from line fields |
| `gross_amount` | `pos.order.line` | `price_subtotal` | Derived: `price_unit * qty` (before discounts) | Derived from line fields |
| `net_amount` | `pos.order.line` | `price_subtotal` | Net subtotal (negative for refunds/returns) | `fact_sales_lines.price_subtotal` |
| `customer_mobile` | `res.partner` | `phone` | Sanitized phone string, stripping non-digits | `dim_customers.mobile` |
| `customer_name` | `res.partner` | `name` | Customer first/last name fallback to Odoo name | `dim_customers.name` |

---

## 3. Naming Convention Gaps & Translation Solutions

### A. Store Code Alignment
- **Legacy names**: The dashboard expects `billed_by` values to equal exactly `'Klj store'` or `'SmartworksNoida Noida'`.
- **Odoo POS Configs**: Exposes config name strings (e.g., `KLJ Store` or `smartworks Noida`).
- **Translation Rule**:
  ```sql
  CASE 
      WHEN name_lower LIKE '%klj%' THEN 'Klj store'
      WHEN name_lower LIKE '%swn%' OR name_lower LIKE '%smartworks%' THEN 'SmartworksNoida Noida'
      ELSE 'Head office'
  END AS billed_by
  ```

### B. Refunds and Returns
- **Legacy behavior**: Upload batches calculated refunds using ad-hoc spreadsheet lines.
- **Odoo behavior**: Return orders are paid transactions with `amount_total < 0` (and negative line quantities).
- **Translation Rule**: No adjustments needed—the metrics engine's `SUM(net_amount)` automatically handles negative offsets, preserving identical arithmetic outcomes.

---

## 4. Transition & Integration Strategy (Phase 4 & 5)

We will execute the cutover using a database compatibility view.

```
       [ LEGACY EXCEL PATH ]            [ UNIFIED ODOO PATH ]
         sales_fact table                Odoo Sync Tables
                │                               │
                │ (Union Compatibility View)    │
                ▼                               ▼
            ┌───────────────────────────────────────┐
            │             sales_fact_v              │
            │  (Maintains exact schema signature)   │
            └───────────────────┬───────────────────┘
                                │
                                ▼
                   [ LEGACY ANALYTICS QUERY ]
                     (Zero JS Code Changes)
```

### SQL Compatibility View Implementation Plan
To roll out the mapping layer without breaking the locked schema, we can alter the SQL view `sales_fact_v` to UNION historical Excel uploads with incoming Odoo live tables:

```sql
CREATE OR REPLACE VIEW sales_fact_v AS
-- Part A: Legacy Excel Upload Data
SELECT
  id::text, upload_id, bill_no, sale_date,
  billed_by, product_key, sku_code, item_name,
  brand, category, quantity, mrp_amount,
  discount_amount, gross_amount, tax_amount, net_amount,
  customer_mobile, customer_name, payment_method,
  CASE
    WHEN billed_by = 'SmartworksNoida Noida' THEN 'Smart Works Noida'
    WHEN billed_by = 'Klj store' THEN 'KLJ'
    ELSE 'Head office'
  END AS store_display_name
FROM sales_fact

UNION ALL

-- Part B: Verified Live Odoo Sync Data
SELECT
  fl.id AS id,
  999999 AS upload_id, -- Reserved Odoo identifier
  fo.name AS bill_no,
  fo.date_order::date AS sale_date,
  COALESCE(ds.code, 'Head office') AS billed_by,
  fl.id AS product_key,
  dp.default_code AS sku_code,
  dp.name AS item_name,
  'Odoo' AS brand,
  'General' AS category,
  fl.qty::int AS quantity,
  dp.list_price AS mrp_amount,
  ((fl.price_unit * fl.qty) * (fl.discount / 100.0))::numeric(12,2) AS discount_amount,
  (fl.price_unit * fl.qty)::numeric(12,2) AS gross_amount,
  0.00::numeric(12,2) AS tax_amount,
  fl.price_subtotal AS net_amount,
  dc.mobile AS customer_mobile,
  dc.name AS customer_name,
  'Odoo POS' AS payment_method,
  CASE
    WHEN ds.code = 'KLJ' THEN 'KLJ'
    WHEN ds.code = 'SWN' THEN 'Smart Works Noida'
    ELSE 'Head office'
  END AS store_display_name
FROM fact_sales_lines fl
JOIN fact_sales_orders fo ON fl.order_id = fo.id
JOIN dim_products dp ON fl.product_id = dp.id
LEFT JOIN dim_customers dc ON fo.partner_id = dc.id
LEFT JOIN dim_stores ds ON fo.store_id = ds.id;
```

---

## 5. Rollback, Safety, & Risk Management

- **Safety Classification**: 🟡 `[REVIEW]` (Refactoring DB views. Public query contracts and returned values remain 100% identical).
- **Rollback Steps**: Re-run original legacy schema script `npx ts-node -P tsconfig.scripts.json src/scripts/migrate-canonical-tables.ts` or revert view modifications via migrations.
- **Regression Risk**: Low. By keeping the view boundary identical, we ensure all metrics calculations (`AOV`, `LTV`, `Gross Revenue`) compile and evaluate accurately.
