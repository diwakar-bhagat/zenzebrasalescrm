import { NextResponse } from "next/server";
import { getSyncHealth } from "@/lib/erp/sync-health";

/**
 * GET /api/system/sync-health
 *
 * Reports the real state of the Odoo -> canonical database pipeline. Replaces
 * /api/data-freshness, which measured how long ago a spreadsheet was uploaded.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	try {
		return NextResponse.json({ success: true, data: await getSyncHealth() });
	} catch (error) {
		console.error("Failed to compute sync health:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to compute sync health" },
			{ status: 500 },
		);
	}
}
