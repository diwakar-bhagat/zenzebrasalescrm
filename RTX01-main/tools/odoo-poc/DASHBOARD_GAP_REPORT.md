# Dashboard Migration Gap Report: Live Odoo Ground Truth Verification

**Target Instance**: `https://zenzebra1.odoo.com` (Odoo 19.0 Enterprise SaaS)  
**Audit Date**: July 31, 2026  
**Status**: 100% Verified against Live Database Raw JSON Responses

---

## 1. Ground Truth Manual Verification of 5 Key Requirements

### 1. `standard_price` (COGS) & `list_price`
**Raw JSON Response (`product.template`)**:
```json
[
  {
    "id": 8919,
    "name": "29 TEE 29 TEE NAVY BLUE POLO XL",
    "list_price": 699,
    "standard_price": 524.25,
    "qty_available": 1
  },
  {
    "id": 8921,
    "name": "29 TEE CLAIC THIRT BEIGE COLOR ON MUTE S",
    "list_price": 499,
    "standard_price": 374.25,
    "qty_available": 1
  }
]
```
✅ **VERIFIED**: `standard_price` is directly returned as numeric floats (`524.25`, `374.25`). Profitability calculations can migrate natively.

---

### 2. Inventory Quantities (`qty_available`, `virtual_available`, `free_qty`)
**Raw JSON Response (`product.product`)**:
```json
[
  {
    "id": 8859,
    "name": "29 TEE 29 TEE NAVY BLUE POLO XL",
    "qty_available": 1,
    "virtual_available": 1,
    "free_qty": 1
  }
]
```
✅ **VERIFIED**: Physical stock levels on hand (`qty_available: 1`), free stock (`free_qty: 1`), and forecasted stock are directly returned.

---

### 3. Retail Orders & Line Items (`pos.order` / `pos.order.line`)
**Raw JSON Response (`pos.order` & `pos.order.line`)**:
```json
// pos.order
[
  {
    "id": 1437,
    "name": "SWN - 000444",
    "date_order": "2026-07-30 20:22:21",
    "partner_id": [73, "Billu- didn't give number"],
    "amount_total": 60,
    "state": "paid"
  }
]

// pos.order.line
[
  {
    "id": 1,
    "order_id": [1, "KLJ - 000001"],
    "product_id": [8847, "Rite Bite max protein cheese & jalapeno 60 gm"],
    "price_unit": 45,
    "discount": 0,
    "qty": 1,
    "price_subtotal_incl": 53.1
  }
]
```
✅ **VERIFIED**: Order numbers, line unit prices, quantities, discounts, line subtotals, and customer links (`partner_id`) are returned.

---

### 4. Pagination Offset Verification
```text
Page 1 (offset=0, limit=3) IDs: [ 1, 10, 8 ]
Page 2 (offset=3, limit=3) IDs: [ 9, 11, 19050 ]
```
✅ **VERIFIED**: The Odoo API strictly honors `offset` parameters with 0 overlapping records.

---

### 5. Incremental Sync (`write_date`)
**Raw JSON Response (`product.template` filtered by `write_date >= '2026-07-01'`):**
```json
[
  {
    "id": 8089,
    "name": "zenzebra Metallic Rose",
    "write_date": "2026-07-30 13:11:34"
  },
  {
    "id": 19465,
    "name": "Bubz Prebiotic Soda – Citrus 250ml",
    "write_date": "2026-07-30 13:08:39"
  }
]
```
✅ **VERIFIED**: ISO datetime strings (`"2026-07-30 13:11:34"`) are populated and queryable for incremental delta syncs.

---

## 2. Updated Architecture Roadmap

### Proposed Data Flow
```
Odoo 19 SaaS (zenzebra1.odoo.com)
       │
       │ Cron Sync (Every 5 mins via write_date)
       ▼
Odoo Sync Engine (Node/TS Background Worker)
       │
       │ Upsert Canonical Schema
       ▼
Local Neon PostgreSQL Database
       │
       │ SQL Queries
       ▼
ZenZebra Dashboard Analytics
```

---

## 3. Recommended Phased Implementation

1. **Phase 1 & 2 (Completed)**: Authentication & Raw Capability Audit.
2. **Phase 3 (Next)**: Build `OdooSyncEngine` service under `src/lib/odoo/`:
   - Session management & automatic re-authentication
   - Incremental sync using `write_date`
   - Upsert into local PostgreSQL canonical tables
   - Sync logs, status monitoring, and error retry handling.
3. **Phase 4**: Canonical Translation & Metric Mapping layer.
4. **Phase 5**: Switch Dashboard modules from Excel imports to Odoo Sync.
