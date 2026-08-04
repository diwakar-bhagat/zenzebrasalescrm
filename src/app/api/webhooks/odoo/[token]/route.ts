import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleOdooWebhook, webhookStatus } from "@/lib/erp/webhook-handler";

/**
 * POST /api/webhooks/odoo/<secret> — Odoo's native webhook entry point.
 *
 * Odoo 19's "Send Webhook Notification" server action exposes only a URL: there is no field
 * for request headers. The shared secret therefore travels as the final path segment, the same
 * pattern Slack uses for incoming webhooks. It is sent over TLS and is rotated by editing the
 * URL in the Odoo action.
 *
 * The token must equal ODOO_WEBHOOK_SECRET exactly. Static sibling routes (/sales, /crm,
 * /purchase, /inventory) take precedence over this dynamic segment in Next.js routing, so a
 * secret must not collide with one of those names.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
	req: NextRequest,
	ctx: { params: Promise<{ token: string }> },
) {
	const { token } = await ctx.params;
	return handleOdooWebhook(req, "/api/webhooks/odoo/[token]", token);
}

export async function GET(
	_req: NextRequest,
	ctx: { params: Promise<{ token: string }> },
) {
	const { token } = await ctx.params;
	const expected = process.env.ODOO_WEBHOOK_SECRET;

	// Confirms the configured URL is correct without revealing the secret itself.
	if (expected && token !== expected) {
		return NextResponse.json(
			{
				status: "unauthorized",
				detail: "Token in URL does not match ODOO_WEBHOOK_SECRET",
			},
			{ status: 401 },
		);
	}
	return NextResponse.json(await webhookStatus("/api/webhooks/odoo/[token]"));
}
