import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { sql } from "../lib/db";

async function migrateWebhookEventsTable() {
  console.log("🚀 Starting Webhook Events Observability Table Migration...");

  // 1. Create webhook_events table for full audit trail & observability
  await sql`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      latency_ms INT,
      status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
      error TEXT,
      model VARCHAR(100),
      record_id BIGINT,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log("✅ Created 'webhook_events' table");

  // Create indexes on webhook_events
  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_record ON webhook_events(model, record_id);
  `;

  // 2. Add observability & metadata columns to sales_fact
  await sql`
    ALTER TABLE sales_fact 
    ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'WEBHOOK',
    ADD COLUMN IF NOT EXISTS sync_type VARCHAR(50) DEFAULT 'REALTIME',
    ADD COLUMN IF NOT EXISTS webhook_event_id BIGINT REFERENCES webhook_events(id) ON DELETE SET NULL;
  `;
  console.log("✅ Added ingestion tracking columns to 'sales_fact'");

  // 3. Ensure sync_cursors has tracking for webhook & delta sync health
  await sql`
    ALTER TABLE sync_cursors
    ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_webhook_latency_ms INT,
    ADD COLUMN IF NOT EXISTS last_webhook_status VARCHAR(50);
  `;
  console.log("✅ Added webhook health tracking columns to 'sync_cursors'");

  console.log("🎉 Webhook Events & Observability Migration Complete!");
  process.exit(0);
}

migrateWebhookEventsTable().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
