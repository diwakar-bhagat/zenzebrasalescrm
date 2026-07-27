import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
	commitNetPurchaseUploadFile,
	commitStagedNetPurchaseUpload,
	stageNetPurchaseUploadChunk,
	startNetPurchaseUploadBatch,
	validateStagedNetPurchaseUpload,
} from "@/lib/founder/net-purchase-import-service";
import { resolveNetPurchaseColumnMappings } from "@/lib/parser/net-purchase-parser";

export const runtime = "nodejs";

/**
 * GET /api/net-purchase/upload
 * Returns upload history from net_purchase_batches (never queries upload_batches).
 */
export async function GET() {
	try {
		const batches = await sql`
      SELECT
        id,
        filename,
        status,
        row_count AS "rowCount",
        valid_row_count AS "validRowCount",
        quarantined_row_count AS "quarantinedRowCount",
        date_range_start AS "dateRangeStart",
        date_range_end AS "dateRangeEnd",
        net_purchase AS "netPurchase",
        uploaded_at AS "uploadedAt"
      FROM net_purchase_batches
      ORDER BY uploaded_at DESC
    `;
		return NextResponse.json({ success: true, data: { batches } });
	} catch (error) {
		console.error("GET /api/net-purchase/upload failed:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch net purchase upload history" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/net-purchase/upload?mode=<mode>
 *
 * Modes: start_batch | upload_chunk | validate | commit | direct_upload
 *
 * This endpoint is completely isolated from /api/sales/imports.
 */
export async function POST(req: NextRequest) {
	try {
		const mode = req.nextUrl.searchParams.get("mode") ?? "validate";

		// ── Start a new chunked batch ──────────────────────────────────────
		if (mode === "start_batch") {
			const body = await req.json();
			const filename = body.filename ?? "net-purchase.xlsx";
			const batchId = await startNetPurchaseUploadBatch(sql, filename);
			return NextResponse.json({ success: true, data: { batchId } });
		}

		// ── Upload a chunk of raw rows ────────────────────────────────────
		if (mode === "upload_chunk") {
			const body = await req.json();
			const { batchId, chunkIndex, rows } = body;
			if (!batchId || chunkIndex === undefined || !rows) {
				return NextResponse.json(
					{ success: false, error: "Missing required parameters" },
					{ status: 400 },
				);
			}
			await stageNetPurchaseUploadChunk(sql, batchId, chunkIndex, rows);
			return NextResponse.json({ success: true });
		}

		// ── Validate staged rows ──────────────────────────────────────────
		if (mode === "validate") {
			const body = await req.json();
			const { batchId, rows: clientRows } = body;

			// If rows are sent directly (browser-side parsed), validate them.
			if (clientRows && Array.isArray(clientRows)) {
				const mappingResult = resolveNetPurchaseColumnMappings(
					clientRows[0] ?? {},
				);
				return NextResponse.json({
					success: true,
					data: {
						mappingResult,
						rowCount: clientRows.length,
					},
				});
			}

			// Otherwise validate staged rows for batchId.
			if (!batchId) {
				return NextResponse.json(
					{ success: false, error: "batchId is required for validation" },
					{ status: 400 },
				);
			}
			const result = await validateStagedNetPurchaseUpload(sql, batchId);
			return NextResponse.json({ success: result.success, data: result });
		}

		// ── Commit staged upload ──────────────────────────────────────────
		if (mode === "commit") {
			const body = await req.json();
			const { batchId, uploadType = "full_replace" } = body;
			if (!batchId) {
				return NextResponse.json(
					{ success: false, error: "batchId is required for commit" },
					{ status: 400 },
				);
			}
			const result = await commitStagedNetPurchaseUpload(
				sql,
				batchId,
				uploadType,
			);
			return NextResponse.json({ success: result.success, data: result });
		}

		// ── Direct file upload (single POST with the Excel file) ─────────
		if (mode === "direct_upload") {
			const formData = await req.formData();
			const file = formData.get("file") as File | null;
			const uploadType =
				(formData.get("uploadType") as string) || "full_replace";
			if (!file) {
				return NextResponse.json(
					{ success: false, error: "No file provided" },
					{ status: 400 },
				);
			}
			const result = await commitNetPurchaseUploadFile(
				sql,
				file,
				uploadType as "full_replace" | "incremental",
			);
			return NextResponse.json({ success: result.success, data: result });
		}

		return NextResponse.json(
			{ success: false, error: `Unknown mode: ${mode}` },
			{ status: 400 },
		);
	} catch (error) {
		console.error("POST /api/net-purchase/upload failed:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Internal server error",
			},
			{ status: 500 },
		);
	}
}
