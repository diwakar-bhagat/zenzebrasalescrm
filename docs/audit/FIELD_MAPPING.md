# Odoo 19 Enterprise SaaS Field Mapping Reference

**Source Instance**: `https://zenzebra1.odoo.com` (Odoo 19.0 Enterprise)

---

## 1. Product Master & Variant Field Mapping

| Odoo Model | Odoo Field Name | Data Type | ZenZebra Canonical Field | Description / Verified Value |
| :--- | :--- | :--- | :--- | :--- |
| `product.template` | `id` | Integer | `template_id` | Master product template ID |
| `product.template` | `name` | String | `name` | Product display name |
| `product.template` | `list_price` | Float | `list_price` | Standard catalog selling price (e.g. `699.00`) |
| `product.template` | `standard_price` | Float | `cost_price` | Procurement cost price / COGS (e.g. `524.25`) |
| `product.template` | `categ_id` | Many2One | `category_name` | Product category reference |
| `product.product` | `id` | Integer | `product_id` | Variant ID |
| `product.product` | `default_code` | String | `sku` | Stock Keeping Unit code |
| `product.product` | `barcode` | String | `barcode` | Product barcode / EAN / UPC |
| `product.product` | `qty_available` | Float | `qty_on_hand` | Physical stock on hand (e.g. `1.0`) |
| `product.product` | `free_qty` | Float | `qty_free` | Unreserved stock available to promise |
| `product.product` | `virtual_available` | Float | `qty_virtual` | Forecasted quantity including pending MO/PO |
| `product.product` | `active` | Boolean | `is_active` | Archival status (`true` / `false`) |
| `product.product` | `write_date` | Timestamp | `updated_at` | Delta sync timestamp |

---

## 2. Point of Sale Transaction Mapping

| Odoo Model | Odoo Field Name | Data Type | ZenZebra Canonical Field | Description / Verified Value |
| :--- | :--- | :--- | :--- | :--- |
| `pos.config` | `id` | Integer | `store_id` | Store POS config ID (`1` = ZenZebra, `2` = KLJ, `3` = SWN) |
| `pos.config` | `name` | String | `store_name` | POS store display name |
| `pos.order` | `id` | Integer | `order_id` | POS transaction ID |
| `pos.order` | `name` | String | `order_name` | POS order reference (e.g. `KLJ - 000278`) |
| `pos.order` | `date_order` | Timestamp | `order_date` | Transaction timestamp |
| `pos.order` | `partner_id` | Many2One | `customer_id` | Customer link (`NULL` for guest checkout) |
| `pos.order` | `config_id` | Many2One | `store_id` | Store configuration reference |
| `pos.order` | `session_id` | Many2One | `session_id` | POS register session reference |
| `pos.order` | `amount_total` | Monetary | `amount_total` | Total order amount (negative for returns) |
| `pos.order` | `amount_untaxed` | Monetary | `amount_untaxed` | Subtotal before taxes |
| `pos.order` | `amount_tax` | Monetary | `amount_tax` | Total GST liability |
| `pos.order` | `state` | Selection | `order_state` | Order state (`paid`, `done`, `invoiced`) |
| `pos.order.line` | `id` | Integer | `line_id` | Order line item ID |
| `pos.order.line` | `order_id` | Many2One | `order_id` | Link to parent POS order |
| `pos.order.line` | `product_id` | Many2One | `product_id` | Link to variant product |
| `pos.order.line` | `price_unit` | Float | `unit_price` | Unit price charged |
| `pos.order.line` | `discount` | Float | `discount_pct` | Line discount percentage |
| `pos.order.line` | `qty` | Float | `quantity` | Item quantity (negative for return lines) |
| `pos.order.line` | `price_subtotal` | Monetary | `subtotal` | Line net total excluding tax |
| `pos.order.line` | `price_subtotal_incl` | Monetary | `subtotal_incl` | Line gross total including tax |

---

## 3. Customer & Contact Field Mapping

| Odoo Model | Odoo Field Name | Data Type | ZenZebra Canonical Field | Description / Verified Value |
| :--- | :--- | :--- | :--- | :--- |
| `res.partner` | `id` | Integer | `customer_id` | Partner record ID |
| `res.partner` | `name` | String | `name` | Contact / Partner display name |
| `res.partner` | `email` | String | `email` | Customer email address |
| `res.partner` | `mobile` | String | `phone` | Mobile phone number |
| `res.partner` | `city` | String | `city` | City location |
| `res.partner` | `customer_rank` | Integer | `customer_rank` | Customer ranking indicator (`> 0`) |
| `res.partner` | `active` | Boolean | `is_active` | Archival status |
| `res.partner` | `write_date` | Timestamp | `updated_at` | Delta sync timestamp |
