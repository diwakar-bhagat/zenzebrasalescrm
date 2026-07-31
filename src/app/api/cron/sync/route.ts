import { NextResponse } from "next/server";
import { runSyncPipeline } from "@/lib/odoo/sync/orchestrator";

/**
 * API Cron Endpoint for background Odoo synchronization.
 * Triggers orchestrator.ts incrementally using write_date filters.
 * Runs every 5 minutes or on demand.
 */
export async function GET(request: Request) {
	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;

	// Basic security check if CRON_SECRET is configured
	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		console.log(
			"[API Cron Sync] Triggering background Odoo synchronization...",
		);
		await runSyncPipeline();

		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			message: "Sync pipeline executed successfully.",
		});
	} catch (error: any) {
		console.error("[API Cron Sync] Sync failed:", error.message);
		return NextResponse.json(
			{
				success: false,
				error: error.message,
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	return GET(request);
}
