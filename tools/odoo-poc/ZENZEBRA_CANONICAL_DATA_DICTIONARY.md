# ZenZebra CRM Canonical Data Dictionary Contract

This contract defines the business semantics, transformation logic, and PostgreSQL DDL schemas mapped between Odoo 19 SaaS and ZenZebra Sales CRM.

---

## 1. Master Identity & Transaction Mapping Rules

### Store Identity Mapping
- Physical retail stores are represented by Odoo's `pos.config` model:
  - `config_id = 1`: **ZenZebra** (Flagship Store) - mapped to store code `ZZ`
  - `config_id = 2`: **KLJ** (KLJ Noida Store) - mapped to store code `KLJ`
  - `config_id = 3`: **SWN** (Smartworks Noida Store) - mapped to store code `SWN`
- Transactions in POS orders (`pos.order`) reference a store config via the `config_id` field.
- Standard backend Sales Orders (`sale.order`) are created from head office and do not map to physical retail POS configs (`store_id` is null).

### Returns, Refunds & Negative Totals
- Returns are stored in `pos.order` as transactions with `amount_total < 0` (e.g., `KLJ - 000278 REFUND`, `amount_total: -2600.00`, state: `"paid"`).
- Quantities (`qty`) and subtotals (`price_subtotal`) in return line items (`pos.order.line`) are negative.
- Net revenue is calculated by summing `amount_total` (inclusive of negative refund orders).

### Active vs. Archived Items (Deactivation Sync)
- Archived products (`product.product`) and customers (`res.partner`) have `active = false`.
- To sync archived items and propagate their state to local database tables, sync query filters use `['active', 'in', [True, False]]`.

---

## 2. Canonical Data Dictionary

| Dashboard Field / Metric | Odoo Source Model | Odoo Field | Transformation / Mapping Logic | Local DB Table & Column |
| :--- | :--- | :--- | :--- | :--- |
| **Store Code** | `pos.config` | `name` | Code inferred from name (`ZZ`, `KLJ`, `SWN`) | `dim_stores.code` |
| **SKU Code** | `product.product` | `default_code` | Raw SKU identifier | `dim_products.default_code` |
| **Product Name** | `product.product` | `name` | Variant display name | `dim_products.name` |
| **Retail Selling Price**| `product.product` | `list_price` | Standard selling price | `dim_products.list_price` |
| **COGS / Cost Price** | `product.product` | `standard_price` | Cost price (standard_price) | `dim_products.cost_price` |
| **Quantity on Hand** | `product.product` | `qty_available` | Cumulative stock on hand | `dim_products.qty_available` |
| **Free to Use Qty** | `product.product` | `free_qty` | Stock available minus reservations | `dim_products.free_qty` |
| **Active Status** | `product.product` | `active` | Boolean deactivation | `dim_products.active` |
| **Customer Name** | `res.partner` | `name` | Customer name | `dim_customers.name` |
| **Customer Phone** | `res.partner` | `phone` | Standard phone number | `dim_customers.mobile` |
| **Customer City** | `res.partner` | `city` | Mailing city | `dim_customers.city` |
| **Customer Rank** | `res.partner` | `customer_rank` | Customer rank index | `dim_customers.customer_rank` |
| **Order Reference** | `sale.order` / `pos.order` | `name` | Direct name lookup | `fact_sales_orders.name` |
| **Order Date** | `sale.order` / `pos.order` | `date_order` | Timezone-naive ISO parsing | `fact_sales_orders.date_order` |
| **Order Net Amount** | `sale.order` / `pos.order` | `amount_total` | Net amount including tax | `fact_sales_orders.amount_total` |
| **Order Line Product** | `sale.order.line` / `pos.order.line`| `product_id` | Mapped via variant ID many2one array | `fact_sales_lines.product_id` |
| **Order Line Qty** | `sale.order.line` / `pos.order.line`| `product_uom_qty` / `qty`| Direct quantity lookup | `fact_sales_lines.qty` |

---

## 3. Canonical Database DDL Schemas

All synced records are written into local PostgreSQL tables defined below:

```sql
-- 1. Store Dimension
CREATE TABLE dim_stores (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product Dimension
CREATE TABLE dim_products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    default_code TEXT,
    barcode TEXT,
    list_price NUMERIC(12, 2) DEFAULT 0.00,
    cost_price NUMERIC(12, 2) DEFAULT 0.00,
    qty_available NUMERIC(12, 2) DEFAULT 0.00,
    free_qty NUMERIC(12, 2) DEFAULT 0.00,
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customer Dimension
CREATE TABLE dim_customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    mobile TEXT,
    city TEXT,
    customer_rank INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sales Orders Fact
CREATE TABLE fact_sales_orders (
    id TEXT PRIMARY KEY,               -- prefixed: 'sale_{id}' or 'pos_{id}'
    name TEXT NOT NULL,
    date_order TIMESTAMP WITH TIME ZONE NOT NULL,
    partner_id INTEGER REFERENCES dim_customers(id) ON DELETE SET NULL,
    store_id INTEGER REFERENCES dim_stores(id) ON DELETE SET NULL,
    amount_total NUMERIC(12, 2) DEFAULT 0.00,
    amount_untaxed NUMERIC(12, 2) DEFAULT 0.00,
    state TEXT NOT NULL,
    order_type TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Sales Order Lines Fact
CREATE TABLE fact_sales_lines (
    id TEXT PRIMARY KEY,               -- prefixed: 'sale_line_{id}' or 'pos_line_{id}'
    order_id TEXT REFERENCES fact_sales_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES dim_products(id) ON DELETE RESTRICT,
    price_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    qty NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
    price_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Inventory Fact
CREATE TABLE fact_inventory (
    product_id INTEGER REFERENCES dim_products(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL,
    location_name TEXT,
    quantity NUMERIC(12, 2) DEFAULT 0.00,
    reserved_quantity NUMERIC(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, location_id)
);

-- 7. Sync Telemetry
CREATE TABLE sync_telemetry (
    id SERIAL PRIMARY KEY,
    sync_type TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
```
