# ZenZebra Canonical Data Dictionary & Business Semantics Contract

**Target Instance**: `https://zenzebra1.odoo.com` (Odoo 19.0 Enterprise SaaS)  
**Contract Date**: July 31, 2026  
**Status**: Freeze Draft (Phase 2.8 Completed)

---

## 1. Master Identity Rules

### 1.1 Physical Store Identity Rule
In Odoo 19, physical retail stores are represented by **Point of Sale Configurations (`pos.config`)**.
- `config_id` on `pos.order` defines the physical store location:
  - `config_id = 1`: **ZenZebra** (Flagship Store)
  - `config_id = 2`: **KLJ** (KLJ Noida Store)
  - `config_id = 3`: **SWN** (Smartworks Noida Store)
- **Canonical Column**: `store_code` (`VARCHAR(20)`), mapped via `pos_config.name`.

### 1.2 Customer Identity & Guest Checkout Rule
- Retail POS checkouts may assign default walk-in partner records (e.g. `[73, "Billu- didn't give number"]`).
- **Customer Unique Key**: `partner_id` (Odoo Partner Primary Key).
- **Guest Filter**: Customers with name containing `"didn't give number"` or `customer_rank = 0` are flagged as `is_guest = TRUE`.
- **Identity Hierarchy**:
  1. `phone` / `mobile` (Cleaned 10-digit number)
  2. `email` (Lowercased)
  3. Odoo `partner_id` fallback

### 1.3 Returns, Refunds & Cancellation Rule
- Returns are created in `pos.order` with `amount_total < 0` (e.g. `KLJ - 000278 REFUND`, `amount_total: -42`).
- **Gross Revenue**: `Sum(amount_total) FILTER (WHERE amount_total > 0 AND state IN ('paid', 'done'))`.
- **Net Revenue**: `Sum(amount_total) FILTER (WHERE state IN ('paid', 'done'))` (Includes returns).
- **Refund Count**: `Count(*) FILTER (WHERE amount_total < 0)`.

### 1.4 Active & Archived Record Sync Rule
- Products or partners archived in Odoo have `active = false`.
- **Sync Domain Requirement**: All sync queries MUST pass `['active', 'in', [True, False]]` to detect deactivated items and set `is_active = FALSE` in the canonical database.

---

## 2. Canonical Data Dictionary

### 2.1 Sales & Revenue Metrics

| Metric Name | Business Definition | Odoo Source Model & Fields | Verified | Transformation Logic | Canonical Database Table & Column | Dashboard Consumer Widgets | Founder AI Automations |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Gross Revenue** | Total value of sales transactions before returns and taxes | `pos.order.line` (`price_subtotal_incl`), `pos.order.state` | ✅ | `Sum(price_subtotal_incl)` where `state IN ('paid', 'done') AND price_subtotal_incl > 0` | `fact_sales.gross_revenue` | Store Overview Total Revenue, Sales Module | Morning Briefing, Revenue Drop Alert |
| **Net Revenue** | Total sales value minus returns and refunds | `pos.order` (`amount_total`), `pos.order.state` | ✅ | `Sum(amount_total)` where `state IN ('paid', 'done')` | `fact_sales.net_revenue` | Net Purchase & Sales Summary | Daily Executive Target Tracker |
| **Order Count (Bill Cuts)** | Total distinct sales transactions completed | `pos.order.id`, `pos.order.state` | ✅ | `Count(distinct pos.order.id)` where `state IN ('paid', 'done') AND amount_total > 0` | `fact_sales.order_count` | Store Overview Bill Cuts, Hourly Traffic | Staffing Predictor |
| **Average Order Value (AOV)** | Average revenue per completed bill cut | Derived from `pos.order` | ✅ | `Net Revenue / Order Count` | `fact_sales.aov` | Sales Dashboard KPI Card | AOV Anomaly Warning |
| **Refund Total ($)** | Total value of refunds processed | `pos.order` (`amount_total`) | ✅ | `Sum(ABS(amount_total))` where `amount_total < 0 AND state IN ('paid', 'done')` | `fact_sales.refund_amount` | Returns & Refunds Widget | Fraud & Abuse Detector |

---

### 2.2 Product Profitability & COGS Metrics

| Metric Name | Business Definition | Odoo Source Model & Fields | Verified | Transformation Logic | Canonical Database Table & Column | Dashboard Consumer Widgets | Founder AI Automations |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Unit Selling Price** | Agreed price per item unit | `product.template.list_price` / `pos.order.line.price_unit` | ✅ | Direct float | `dim_products.list_price`, `fact_sales_lines.price_unit` | Product Catalog, Sales Line Items | Pricing Recommendation |
| **Unit Cost Price (COGS)** | Cost to procure item unit | `product.template.standard_price` | ✅ | Direct float (`standard_price`) | `dim_products.cost_price` | Profitability Module, Gross Margin | Margin Erosion Alert |
| **Gross Margin ($)** | Profit generated per sales line | `pos.order.line` + `product.template` | ✅ | `price_subtotal_incl - (qty * standard_price)` | `fact_sales_lines.gross_margin` | Product Profitability Table | Low Margin Warning (<15%) |
| **Gross Margin (%)** | Profit margin percentage | Derived | ✅ | `(Gross Margin / price_subtotal_incl) * 100` | `fact_sales_lines.margin_pct` | Store Profitability Ranking | Category Margin Alert |

---

### 2.3 Inventory & Stock Metrics

| Metric Name | Business Definition | Odoo Source Model & Fields | Verified | Transformation Logic | Canonical Database Table & Column | Dashboard Consumer Widgets | Founder AI Automations |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **On-Hand Quantity** | Physical units in store/warehouse | `product.product.qty_available` / `stock.quant` | ✅ | Direct float (`qty_available`) | `dim_inventory.qty_on_hand` | Inventory Overview, Low Stock | Stockout Risk Warning |
| **Free / Available Stock** | Units available to promise | `product.product.free_qty` | ✅ | Direct float (`free_qty`) | `dim_inventory.qty_free` | Inventory Overview | Automated Reorder Trigger |
| **Stock Days Remaining** | Days until stockout at current velocity | `stock.quant` + `pos.order.line` | ✅ | `qty_on_hand / (30-day Avg Daily Units Sold)` | `dim_inventory.days_remaining` | Stock Risk Widget | Stockout Predictor (<5 days) |
| **Dead Stock Value** | Capital locked in items zero sales >90d | `product.product` + `pos.order.line` | ✅ | `Sum(qty_on_hand * standard_price)` where no sales in 90 days | `dim_inventory.dead_stock_value` | Inventory Capital Health | Dead Stock Liquidator Trigger |

---

### 2.4 Customer Intelligence Metrics

| Metric Name | Business Definition | Odoo Source Model & Fields | Verified | Transformation Logic | Canonical Database Table & Column | Dashboard Consumer Widgets | Founder AI Automations |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Customer LTV** | Total historical spend by customer | `res.partner` + `pos.order` | ✅ | `Sum(pos.order.amount_total)` by `partner_id` | `dim_customers.lifetime_value` | Customer Intelligence Leaderboard | VIP Customer Detector |
| **Recency (Days)** | Days since customer's last purchase | `res.partner` + `pos.order` | ✅ | `CURRENT_DATE - MAX(date_order)` | `dim_customers.days_since_last_order` | Churn Risk Segment | Churn Warning Trigger (>45 days) |
| **Order Frequency** | Total distinct orders per customer | `res.partner` + `pos.order` | ✅ | `Count(distinct pos.order.id)` by `partner_id` | `dim_customers.order_frequency` | Repeat Customer Cohorts | Customer Win-Back Campaign |
| **RFM Segment** | Categorization (Champions, At-Risk, New) | Derived from Recency, Frequency, Value | ✅ | Composite percentile scoring | `dim_customers.rfm_segment` | Customer Segment Breakdown | Automated WhatsApp Campaign |

---

## 3. Canonical Database Schema DDL Blueprint

```sql
-- Store Dimension Table
CREATE TABLE IF NOT EXISTS dim_stores (
    store_id INT PRIMARY KEY,
    store_code VARCHAR(20) NOT NULL UNIQUE,
    store_name VARCHAR(100) NOT NULL,
    company_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product Dimension Table
CREATE TABLE IF NOT EXISTS dim_products (
    product_id INT PRIMARY KEY,
    template_id INT NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category_id INT,
    category_name VARCHAR(100),
    list_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    qty_on_hand NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    qty_free NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customer Dimension Table
CREATE TABLE IF NOT EXISTS dim_customers (
    customer_id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    city VARCHAR(100),
    is_guest BOOLEAN DEFAULT FALSE,
    lifetime_value NUMERIC(12, 2) DEFAULT 0.00,
    order_frequency INT DEFAULT 0,
    last_order_date TIMESTAMP WITH TIME ZONE,
    rfm_segment VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fact Sales Orders Table
CREATE TABLE IF NOT EXISTS fact_sales_orders (
    order_id INT PRIMARY KEY,
    order_name VARCHAR(100) NOT NULL,
    store_id INT REFERENCES dim_stores(store_id),
    customer_id INT REFERENCES dim_customers(customer_id),
    session_id INT,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    amount_total NUMERIC(12, 2) NOT NULL,
    amount_untaxed NUMERIC(12, 2) NOT NULL,
    order_state VARCHAR(50) NOT NULL,
    is_refund BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fact Sales Order Lines Table
CREATE TABLE IF NOT EXISTS fact_sales_lines (
    line_id INT PRIMARY KEY,
    order_id INT REFERENCES fact_sales_orders(order_id),
    product_id INT REFERENCES dim_products(product_id),
    unit_price NUMERIC(12, 2) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    quantity NUMERIC(12, 2) NOT NULL,
    subtotal_incl NUMERIC(12, 2) NOT NULL,
    gross_margin NUMERIC(12, 2) NOT NULL,
    margin_pct NUMERIC(5, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Architectural Sign-Off

This document serves as the **contract between the Odoo Sync Engine, the local PostgreSQL Canonical Database, the Next.js Dashboard UI, and the Founder AI Engine**. All sync modules built in Phase 3 MUST strictly implement these transformation rules and data contracts.
