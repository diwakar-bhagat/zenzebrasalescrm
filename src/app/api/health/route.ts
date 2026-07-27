import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createApiResponse } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  const startTime = performance.now();
  const requestId = `health_${Date.now()}`;

  try {
    // Light db ping to check database connectivity
    let dbStatus = "unconfigured";
    if (process.env.DATABASE_URL) {
      await sql`SELECT 1`;
      dbStatus = "healthy";
    }

    const healthData = {
      status: "operational",
      environment: process.env.NODE_ENV || "development",
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
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
