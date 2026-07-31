# Field Mapping: Dashboard Concepts vs. Odoo Standard Models

This reference maps core ZenZebra Sales CRM Dashboard data elements to native **Odoo Standard** fields, identifying direct mappings, calculated metrics, and missing fields.

## 1. Product Catalog & Inventory (`product.template` / `product.product`)

| Dashboard Field | Odoo Model | Odoo Field | Data Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Product ID | `product.template` | `id` | Integer | System primary key |
| SKU / Part Number | `product.template` | `default_code` | String | Internal Reference |
| Product Name | `product.template` | `name` | String | Display Name |
| Barcode / EAN | `product.template` | `barcode` | String | Scannable code |
| Selling Price | `product.template` | `list_price` | Float | Sales price |
| Cost Price (COGS) | `product.template` | `standard_price` | Float | Cost price (Check permission/SaaS availability) |
| Category | `product.template` | `categ_id` | Many2one `[id, name]` | Product category |
| On-Hand Inventory | `product.product` | `qty_available` | Float | Physical stock on hand |
| Forecasted Inventory | `product.product` | `virtual_available` | Float | Forecasted quantity |
| Unreserved / Free Stock | `product.product` | `free_qty` | Float | Quantity available to promise |

---

## 2. Customers & Accounts (`res.partner`)

| Dashboard Field | Odoo Model | Odoo Field | Data Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Customer ID | `res.partner` | `id` | Integer | Partner ID |
| Customer Name | `res.partner` | `name` | String | Company or individual name |
| Phone / Mobile | `res.partner` | `mobile` | String | Mobile contact |
| Email | `res.partner` | `email` | String | Email address |
| City | `res.partner` | `city` | String | Address city |
| Customer Rank | `res.partner` | `customer_rank` | Integer | > 0 for active sales customers |
| Last Updated | `res.partner` | `write_date` | Datetime | Incremental sync tracking |

---

## 3. Sales Orders (`sale.order`)

| Dashboard Field | Odoo Model | Odoo Field | Data Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Order ID | `sale.order` | `id` | Integer | Sales Order ID |
| Order Reference | `sale.order` | `name` | String | e.g. `SO001` |
| Order Date | `sale.order` | `date_order` | Datetime | Confirmation / order date |
| Customer | `sale.order` | `partner_id` | Many2one `[id, name]` | Linked partner |
| Total Amount | `sale.order` | `amount_total` | Float | Grand total inclusive of tax |
| Net Untaxed Amount | `sale.order` | `amount_untaxed` | Float | Subtotal excluding tax |
| Order State | `sale.order` | `state` | Selection | `draft`, `sent`, `sale`, `done`, `cancel` |
| Last Modified | `sale.order` | `write_date` | Datetime | Incremental sync tracking |

---

## 4. Sales Order Items / Lines (`sale.order.line`)

| Dashboard Field | Odoo Model | Odoo Field | Data Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Line Item ID | `sale.order.line` | `id` | Integer | Line ID |
| Order Link | `sale.order.line` | `order_id` | Many2one `[id, name]` | Parent order link |
| Product Link | `sale.order.line` | `product_id` | Many2one `[id, name]` | Specific variant |
| Unit Selling Price | `sale.order.line` | `price_unit` | Float | Agreed price per unit |
| Discount (%) | `sale.order.line` | `discount` | Float | Discount percentage |
| Quantity Ordered | `sale.order.line` | `product_uom_qty` | Float | Quantity ordered |
| Line Subtotal | `sale.order.line` | `price_subtotal` | Float | Subtotal before tax |
| Taxes Applied | `sale.order.line` | `tax_id` | Many2many `[ids]` | Applied tax rules |
| Last Modified | `sale.order.line` | `write_date` | Datetime | Incremental sync tracking |

---

## 5. Metrics & Dashboard Calculations

| Dashboard Metric | Derived Formula | Odoo Source Data |
| :--- | :--- | :--- |
| **Gross Margin ($)** | `Total Sales Amount - (Quantity * Unit Cost)` | `sale.order.line.price_subtotal` - (`product_uom_qty` * `product.standard_price`) |
| **Margin (%)** | `(Gross Margin / Total Sales Amount) * 100` | Calculated from Sales & Cost data |
| **Net Purchases** | Aggregated completed orders (`state in ['sale', 'done']`) | Filtered `sale.order` query |
| **Customer LTV** | Sum of `sale.order.amount_total` grouped by `partner_id` | `sale.order` query filtered by `partner_id` |
