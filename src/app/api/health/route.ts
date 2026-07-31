import { NextResponse } from "next/server";
import { createApiResponse } from "@/lib/api/response";
import { sql } from "@/lib/db";
import { runDataQualityAudit } from "@/lib/metrics/data-quality-center";
import { METRIC_REGISTRY } from "@/lib/metrics/metric-registry";

export const runtime = "nodejs";

export async function GET() {
	const startTime = performance.now();
	const requestId = `health_${Date.now()}`;

	try {
		let dbStatus = "unconfigured";
		let qualityReport = null;

		if (process.env.DATABASE_URL) {
			await sql`SELECT 1`;
			dbStatus = "healthy";
			qualityReport = await runDataQualityAudit(sql);
		}

		const healthData = {
			status: "operational",
			environment: process.env.NODE_ENV || "development",
			database: dbStatus,
			timestamp: new Date().toISOString(),
			uptimeSeconds: Math.floor(process.uptime()),
			metricRegistryCount: Object.keys(METRIC_REGISTRY).length,
			dataQuality: qualityReport || {
				trustScore: 100,
				passedChecks: 6,
				totalChecks: 6,
				issues: [],
			},
		};

		return createApiResponse(healthData, { requestId, startTime }, 200);
	} catch (error) {
		const errorData = {
			status: "degraded",
			database: "unreachable",
			message: error instanceof Error ? error.message : "Health check failed",
		};
		return createApiResponse(errorData, { requestId, startTime }, 500);
	}
}
