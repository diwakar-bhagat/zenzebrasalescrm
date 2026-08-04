import Ably from "ably";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SUBSCRIBE_SCOPE } from "@/lib/realtime/channels";

/**
 * GET /api/realtime/token — issues a short-lived Ably token for the browser.
 *
 * The API key stays on the server. Browsers receive a capability-scoped token instead, so a
 * leaked token expires on its own, is limited to this dashboard's channels, and cannot be used
 * to publish.
 *
 * Requires a valid session: sales data is not public, and an unauthenticated token would let
 * anyone subscribe to live revenue.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const key = process.env.ABLY_API_KEY;
	if (!key) {
		// Not an error: realtime is optional. The client treats this as "stay on refresh".
		return NextResponse.json(
			{ enabled: false, reason: "ABLY_API_KEY is not configured" },
			{ status: 200 },
		);
	}

	try {
		const ably = new Ably.Rest({ key });

		const tokenRequest = await ably.auth.createTokenRequest({
			// Subscribe only, and only within the dashboard namespace. No publish capability:
			// events must originate from the server after a committed write, never from a client.
			capability: { [SUBSCRIBE_SCOPE]: ["subscribe"] },
			clientId: String(user.userId),
			ttl: 60 * 60 * 1000,
		});

		return NextResponse.json({ enabled: true, tokenRequest });
	} catch (error) {
		console.error("[realtime] token request failed:", error);
		return NextResponse.json(
			{ error: "Failed to create realtime token" },
			{ status: 500 },
		);
	}
}
