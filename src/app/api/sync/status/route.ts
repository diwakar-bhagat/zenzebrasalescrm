import { NextResponse } from "next/server";
import { getLatestTelemetryStatus } from "@/lib/repositories/odoo.repository";

export const runtime = "nodejs";

function formatHumanTimeAgo(seconds: number | null): string {
	if (seconds === null || seconds < 0) return "just now";
	if (seconds < 5) return "3 sec ago";
	if (seconds < 15) return `${seconds} sec ago`;
	if (seconds < 60) return `${seconds} sec ago`;
	const mins = Math.floor(seconds / 60);
	if (mins < 60) return `${mins} min ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours} hr ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function GET() {
	try {
		const telemetry = await getLatestTelemetryStatus();
		const secondsAgo = telemetry.maxSecondsAgo;

		let formattedStatus: "LIVE" | "FRESH" | "SYNCING" | "DELAYED" | "OFFLINE" = "OFFLINE";

		if (telemetry.overallStatus === "syncing") {
			formattedStatus = "SYNCING";
		} else if (secondsAgo !== null && secondsAgo <= 5) {
			formattedStatus = "LIVE";
		} else if (secondsAgo !== null && secondsAgo <= 15) {
			formattedStatus = "FRESH";
		} else if (secondsAgo !== null && secondsAgo <= 60) {
			formattedStatus = "FRESH";
		} else if (secondsAgo !== null && secondsAgo > 60) {
			formattedStatus = "DELAYED";
		}

		return NextResponse.json({
			success: true,
			data: {
				status: formattedStatus,
				lastSyncAt: telemetry.lastSyncAt,
				secondsAgo,
				formattedTimeAgo: formatHumanTimeAgo(secondsAgo),
				isStale: secondsAgo === null || secondsAgo > 60,
				entityStatuses: telemetry.entityStatuses,
			},
		});
	} catch (error: any) {
		console.error("Failed to fetch sync status:", error);
		return NextResponse.json(
			{ success: false, error: error.message || "Failed to fetch sync status" },
			{ status: 500 },
		);
	}
}
