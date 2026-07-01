/**
 * Migration: Odoo Webhook Tables
 *
 * Creates tables to receive real-time data from Odoo Standard Plan
 * via webhooks (Make.com / Zapier → /api/webhooks/odoo/*)
 *
 * Run: ts-node -P tsconfig.scripts.json src/scripts/migrate-odoo-webhook-tables.ts
 */

import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function migrate() {
	if (!process.env.DATABASE_URL) {
		console.error("❌ Missing DATABASE_URL");
		process.exit(1);
	}

	const sql = neon(process.env.DATABASE_URL);
	console.log("✅ Connected to Neon PostgreSQL");

	// ── 1. CRM Leads & Opportunities ──────────────────────────────────────────
	console.log("Creating crm_leads...");
	await sql`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id                SERIAL PRIMARY KEY,
      odoo_lead_id      INTEGER UNIQUE NOT NULL,
      name              TEXT NOT NULL,
      type              TEXT DEFAULT 'lead',         -- 'lead' or 'opportunity'
      stage             TEXT,
      salesperson       TEXT,
      partner_name      TEXT,
      email             TEXT,
      phone             TEXT,
      expected_revenue  NUMERIC DEFAULT 0,
      probability       NUMERIC DEFAULT 0,
      date_deadline     DATE,
      source            TEXT,
      medium            TEXT,
      active            BOOLEAN DEFAULT TRUE,
      won               BOOLEAN DEFAULT FALSE,
      odoo_created_at   TIMESTAMPTZ,
      odoo_updated_at   TIMESTAMPTZ,
      synced_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;

	await sql`CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON crm_leads (stage)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_crm_leads_salesperson ON crm_leads (salesperson)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_crm_leads_type ON crm_leads (type)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_crm_leads_won ON crm_leads (won)`;
	console.log("  ✅ crm_leads created");

	// ── 2. Purchase Orders ─────────────────────────────────────────────────────
	console.log("Creating purchase_orders...");
	await sql`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id               SERIAL PRIMARY KEY,
      odoo_po_id       INTEGER UNIQUE NOT NULL,
      po_number        TEXT NOT NULL,
      vendor_name      TEXT,
      vendor_email     TEXT,
      order_date       DATE,
      scheduled_date   DATE,
      state            TEXT DEFAULT 'draft',  -- draft|sent|purchase|done|cancel
      amount_untaxed   NUMERIC DEFAULT 0,
      amount_tax       NUMERIC DEFAULT 0,
      amount_total     NUMERIC DEFAULT 0,
      currency         TEXT DEFAULT 'INR',
      notes            TEXT,
      synced_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;

	await sql`CREATE INDEX IF NOT EXISTS idx_po_state ON purchase_orders (state)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders (vendor_name)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders (order_date)`;
	console.log("  ✅ purchase_orders created");

	console.log("Creating purchase_order_lines...");
	await sql`
    CREATE TABLE IF NOT EXISTS purchase_order_lines (
      id              SERIAL PRIMARY KEY,
      po_id           INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      product_name    TEXT NOT NULL,
      product_code    TEXT,
      quantity        NUMERIC DEFAULT 0,
      unit_price      NUMERIC DEFAULT 0,
      subtotal        NUMERIC DEFAULT 0,
      qty_received    NUMERIC DEFAULT 0,
      qty_billed      NUMERIC DEFAULT 0,
      scheduled_date  DATE
    )
  `;

	await sql`CREATE INDEX IF NOT EXISTS idx_pol_po_id ON purchase_order_lines (po_id)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_pol_product ON purchase_order_lines (product_name)`;
	console.log("  ✅ purchase_order_lines created");

	// ── 3. Inventory Snapshots (current stock on hand) ────────────────────────
	console.log("Creating inventory_snapshots...");
	await sql`
    CREATE TABLE IF NOT EXISTS inventory_snapshots (
      id                 SERIAL PRIMARY KEY,
      odoo_product_id    INTEGER NOT NULL,
      product_name       TEXT,
      product_code       TEXT,
      location           TEXT NOT NULL,
      quantity           NUMERIC DEFAULT 0,
      reserved_quantity  NUMERIC DEFAULT 0,
      snapshot_at        TIMESTAMPTZ NOT NULL,
      synced_at          TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (odoo_product_id, location)
    )
  `;

	await sql`CREATE INDEX IF NOT EXISTS idx_inv_snap_product ON inventory_snapshots (odoo_product_id)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_inv_snap_location ON inventory_snapshots (location)`;
	console.log("  ✅ inventory_snapshots created");

	// ── 4. Inventory Movements (receipts & deliveries) ────────────────────────
	console.log("Creating inventory_movements...");
	await sql`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id                SERIAL PRIMARY KEY,
      odoo_move_id      INTEGER UNIQUE NOT NULL,
      move_type         TEXT NOT NULL,             -- 'in' or 'out'
      reference         TEXT,
      odoo_product_id   INTEGER NOT NULL,
      product_name      TEXT,
      product_code      TEXT,
      quantity_moved    NUMERIC DEFAULT 0,
      from_location     TEXT,
      to_location       TEXT,
      moved_at          TIMESTAMPTZ NOT NULL,
      synced_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;

	await sql`CREATE INDEX IF NOT EXISTS idx_inv_mov_product ON inventory_movements (odoo_product_id)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON inventory_movements (move_type)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_inv_mov_date ON inventory_movements (moved_at)`;
	console.log("  ✅ inventory_movements created");

	console.log("\n🎉 All Odoo webhook tables created successfully.");
	console.log("Next step: set ODOO_WEBHOOK_SECRET in .env.local");
}

migrate().catch((err) => {
	console.error("❌ Migration failed:", err);
	process.exit(1);
});
