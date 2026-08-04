import { type NextRequest, NextResponse } from "next/server";
import { runOdooSync } from "@/scripts/odoo-backfill-sync";

/**
 * POST|GET /api/admin/odoo-sync
 *
 * Scheduled reconciliation pull. Runs `write_date >= last_sync` against Odoo to recover
 * anything the webhook missed during an outage.
 *
 * On Vercel's Hobby plan cron is limited to one execution per day, so this is a safety net
 * rather than a real-time fallback — webhooks are the only path to live data.
 *
 * Accepts either:
 *   - Authorization: Bearer <CRON_SECRET>   (what Vercel Cron actually sends)
 *   - x-webhook-secret: <ODOO_WEBHOOK_SECRET> (manual/admin invocation)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel's Hobby plan caps serverless execution at 60s. A delta pull covers only what changed
// since the last cursor, so it finishes in well under that; a full historical backfill will
// not, and must be run from the CLI (npm run sync:odoo -- --backfill) rather than over HTTP.
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
	const cronSecret = process.env.CRON_SECRET;
	const adminSecret = process.env.ODOO_WEBHOOK_SECRET;

	// Vercel Cron authenticates with a bearer token and cannot send custom headers. Without
	// this branch, enforcing ODOO_WEBHOOK_SECRET would 401 the cron and the scheduled pull
	// would stop running with no visible symptom.
	const bearer = req.headers.get("authorization");
	if (cronSecret && bearer === `Bearer ${cronSecret}`) return true;

	if (adminSecret && req.headers.get("x-webhook-secret") === adminSecret)
		return true;

	// Neither secret configured: allow, but only outside production.
	if (!cronSecret && !adminSecret) return process.env.NODE_ENV !== "production";

	return false;
}

export async function POST(req: NextRequest) {
	if (!isAuthorized(req)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Read mode from the query string as well as the body. vercel.json invokes this with
	// `?mode=delta`, which the previous body-only parsing ignored entirely.
	let mode: "delta" | "backfill" = "delta";
	const queryMode = req.nextUrl.searchParams.get("mode");
	if (queryMode === "backfill" || queryMode === "delta") {
		mode = queryMode;
	} else {
		try {
			const body = await req.json();
			if (body?.mode === "backfill" || body?.mode === "delta") mode = body.mode;
		} catch {
			// No body (Vercel Cron sends none): keep the default.
		}
	}

	try {
		const result = await runOdooSync({ mode });
		return NextResponse.json({ mode, ...result });
	} catch (error) {
		console.error("[api/admin/odoo-sync] sync failed:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Sync failed" },
			{ status: 500 },
		);
	}
}

export async function GET(req: NextRequest) {
	return POST(req);
}
