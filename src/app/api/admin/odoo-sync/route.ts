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

type AuthOutcome = { ok: true } | { ok: false; diagnosis: string };

/**
 * Authorises a scheduler invocation.
 *
 * On failure it reports *which* check failed. A bare "Unauthorized" makes a misconfigured
 * scheduler indistinguishable from a missing environment variable, and the only way to tell
 * them apart is to have access to both systems at once. None of the detail below reveals the
 * secret or narrows it: a caller already knows whether its own header matched.
 */
function isAuthorized(req: NextRequest): AuthOutcome {
	const cronSecret = process.env.CRON_SECRET;
	const adminSecret = process.env.ODOO_WEBHOOK_SECRET;

	// Vercel Cron authenticates with a bearer token and cannot send custom headers. Without
	// this branch, enforcing ODOO_WEBHOOK_SECRET would 401 the cron and the scheduled pull
	// would stop running with no visible symptom.
	const bearer = req.headers.get("authorization");
	if (cronSecret && bearer === `Bearer ${cronSecret}`) return { ok: true };

	if (adminSecret && req.headers.get("x-webhook-secret") === adminSecret) {
		return { ok: true };
	}

	// Neither secret configured: allow, but only outside production.
	if (!cronSecret && !adminSecret) {
		return process.env.NODE_ENV !== "production"
			? { ok: true }
			: {
					ok: false,
					diagnosis:
						"No CRON_SECRET or ODOO_WEBHOOK_SECRET is set on the server.",
				};
	}

	if (!cronSecret) {
		return {
			ok: false,
			diagnosis:
				"CRON_SECRET is not set on the server, so bearer authentication cannot succeed. Add it in the hosting environment and redeploy.",
		};
	}
	if (!bearer) {
		return {
			ok: false,
			diagnosis:
				"No Authorization header was received. In the scheduler set header name 'Authorization' and value 'Bearer <CRON_SECRET>' as two separate fields.",
		};
	}
	if (!bearer.startsWith("Bearer ")) {
		return {
			ok: false,
			diagnosis:
				"Authorization header is missing the 'Bearer ' prefix. The value must be 'Bearer <CRON_SECRET>', with one space.",
		};
	}
	return {
		ok: false,
		diagnosis:
			"Bearer token does not match CRON_SECRET. Confirm the scheduler's value matches the deployed environment variable exactly — a trailing space or newline when pasting is the usual cause.",
	};
}

export async function POST(req: NextRequest) {
	const auth = isAuthorized(req);
	if (!auth.ok) {
		console.warn("[odoo-sync] rejected:", auth.diagnosis);
		return NextResponse.json(
			{ error: "Unauthorized", diagnosis: auth.diagnosis },
			{ status: 401 },
		);
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
