import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleOdooWebhook, webhookStatus } from "@/lib/erp/webhook-handler";

/**
 * POST /api/webhooks/odoo — header-authenticated ingestion.
 *
 * For senders that can set request headers: relays (Make.com, n8n), scripts and smoke tests.
 * Odoo's own webhook action cannot set headers, so it posts to /api/webhooks/odoo/<secret>
 * instead; both routes share one handler and produce identical rows.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/webhooks/odoo";

export async function POST(req: NextRequest) {
	const provided =
		req.headers.get("x-webhook-secret") ?? req.headers.get("x-odoo-secret");
	return handleOdooWebhook(req, ENDPOINT, provided);
}

export async function GET() {
	return NextResponse.json(await webhookStatus(ENDPOINT));
}
