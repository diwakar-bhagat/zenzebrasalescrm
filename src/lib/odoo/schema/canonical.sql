-- DDL Schema for ZenZebra Canonical Odoo Sync Tables

-- 1. Store Dimension Table (pos.config mapping)
CREATE TABLE IF NOT EXISTS dim_stores (
    id INTEGER PRIMARY KEY,           -- Matches config_id (pos.config ID) in Odoo
    name TEXT NOT NULL,                -- POS store name
    code TEXT,                         -- Store code alias
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product Dimension Table (product.product level)
CREATE TABLE IF NOT EXISTS dim_products (
    id INTEGER PRIMARY KEY,           -- Matches product.product variant ID in Odoo
    name TEXT NOT NULL,                -- Product variant display name
    default_code TEXT,                 -- SKU
    barcode TEXT,                      -- Barcode / UPC
    list_price NUMERIC(12, 2) DEFAULT 0.00,  -- Retail Selling Price
    cost_price NUMERIC(12, 2) DEFAULT 0.00,  -- Standard Price / COGS Cost
    qty_available NUMERIC(12, 2) DEFAULT 0.00,  -- Quantity on Hand
    free_qty NUMERIC(12, 2) DEFAULT 0.00,       -- Free to use quantity
    active BOOLEAN DEFAULT TRUE,       -- Archival status
    category TEXT,                     -- product.template.categ_id name (added: migrate-odoo-category-tax.ts)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customer Dimension Table (res.partner level)
CREATE TABLE IF NOT EXISTS dim_customers (
    id INTEGER PRIMARY KEY,           -- Matches res.partner ID in Odoo
    name TEXT NOT NULL,                -- Customer Name
    email TEXT,                        -- Email Address
    mobile TEXT,                       -- Phone / Mobile Number
    city TEXT,                         -- City
    customer_rank INTEGER DEFAULT 0,   -- Odoo Customer Rank
    active BOOLEAN DEFAULT TRUE,       -- Archival status
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sales Orders Fact Table
CREATE TABLE IF NOT EXISTS fact_sales_orders (
    id TEXT PRIMARY KEY,               -- Prefixed key: 'sale_{id}' or 'pos_{id}' to prevent collision
    name TEXT NOT NULL,                -- Order reference name (e.g., SO0001, KLJ-000123)
    date_order TIMESTAMP WITH TIME ZONE NOT NULL, -- Order creation date/time
    partner_id INTEGER REFERENCES dim_customers(id) ON DELETE SET NULL, -- Customer ID link
    store_id INTEGER REFERENCES dim_stores(id) ON DELETE SET NULL,       -- Store / POS link
    amount_total NUMERIC(12, 2) DEFAULT 0.00,    -- Total amount including taxes (net of refund if returns)
    amount_untaxed NUMERIC(12, 2) DEFAULT 0.00,  -- Untaxed amount
    state TEXT NOT NULL,               -- Order state (e.g. 'sale', 'done', 'paid', 'invoiced')
    order_type TEXT NOT NULL,          -- 'sale' or 'pos'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Sales Order Lines Fact Table
CREATE TABLE IF NOT EXISTS fact_sales_lines (
    id TEXT PRIMARY KEY,               -- Prefixed line key: 'sale_line_{id}' or 'pos_line_{id}'
    order_id TEXT REFERENCES fact_sales_orders(id) ON DELETE CASCADE, -- Link to order
    product_id INTEGER REFERENCES dim_products(id) ON DELETE RESTRICT, -- Link to product variant
    price_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,  -- Unit price charged
    discount NUMERIC(5, 2) NOT NULL DEFAULT 0.00,      -- Discount percentage (0-100)
    qty NUMERIC(12, 2) NOT NULL DEFAULT 1.00,          -- Quantity ordered (negative if POS return line)
    price_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Line total excluding taxes
    tax_amount NUMERIC(12, 2) DEFAULT 0.00,  -- price_total/price_subtotal_incl minus price_subtotal (added: migrate-odoo-category-tax.ts)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Inventory Fact Table (stock.quant level snapshots)
CREATE TABLE IF NOT EXISTS fact_inventory (
    product_id INTEGER REFERENCES dim_products(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL,      -- Location ID in Odoo
    location_name TEXT,                -- Full path name of the stock location
    quantity NUMERIC(12, 2) DEFAULT 0.00,
    reserved_quantity NUMERIC(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, location_id)
);

-- 7. Sync Telemetry & Tracking Table
CREATE TABLE IF NOT EXISTS sync_telemetry (
    id SERIAL PRIMARY KEY,
    sync_type TEXT NOT NULL,           -- 'products' | 'customers' | 'sales' | 'inventory' | 'full'
    records_processed INTEGER DEFAULT 0,
    status TEXT NOT NULL,              -- 'success' | 'failed'
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_dim_products_sku ON dim_products (default_code);
CREATE INDEX IF NOT EXISTS idx_dim_customers_mobile ON dim_customers (mobile);
CREATE INDEX IF NOT EXISTS idx_fact_sales_orders_date ON fact_sales_orders (date_order);
CREATE INDEX IF NOT EXISTS idx_fact_sales_orders_store ON fact_sales_orders (store_id);
CREATE INDEX IF NOT EXISTS idx_fact_sales_lines_product ON fact_sales_lines (product_id);
