import { type NextRequest } from "next/server";
import { createApiErrorResponse, createApiResponse } from "@/lib/api/response";
import { logger } from "@/lib/observability/logger";
import { getCrmIntelligence } from "@/features/crm/services/crm.service";

export async function GET(req: NextRequest) {
	const { requestId, startTime } = logger.startRequest("GET", "/api/v1/crm/intelligence");

	try {
		const data = await getCrmIntelligence();

		logger.logApiPerformance({
			requestId,
			method: "GET",
			path: "/api/v1/crm/intelligence",
			durationMs: performance.now() - startTime,
			status: 200,
		});

		return createApiResponse(data, { requestId, startTime });
	} catch (err: any) {
		logger.logApiPerformance({
			requestId,
			method: "GET",
			path: "/api/v1/crm/intelligence",
			durationMs: performance.now() - startTime,
			status: 500,
			error: err.message,
		});

		return createApiErrorResponse(err.message || "Failed to fetch CRM intelligence", {
			requestId,
			startTime,
		});
	}
}
