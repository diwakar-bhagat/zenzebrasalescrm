import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { CUSTOMER_INTELLIGENCE_TAG } from "@/lib/cache-tags";
import { sql } from "@/lib/db";
import {
	commitFounderUploadFile,
	commitStagedFounderUpload,
	stageFounderUploadChunk,
	startFounderUploadBatch,
	validateFounderUploadFile,
	validateStagedFounderUpload,
} from "@/lib/founder/import-service";
import { refreshMaterializedViews } from "@/lib/materialized-views";

/**
 * After a successful sales commit: refresh materialized views so lifetime
 * customer metrics reflect the new data. Never throws — a refresh failure is
 * logged but must not fail the upload (the live-SQL path still serves fresh data).
 */
async function refreshAnalyticsAfterCommit(dataType: string) {
	if (dataType !== "sales") return;
	try {
		const results = await refreshMaterializedViews(sql);
		for (const r of results) {
			if (!r.ok) console.error(`MV refresh failed for ${r.view}: ${r.error}`);
		}
		// Invalidate the customer-intelligence cached dashboard response
		(revalidateTag as any)(CUSTOMER_INTELLIGENCE_TAG);
	} catch (err) {
		console.error("MV refresh after commit failed:", err);
	}
}

import {
	commitStagedInventoryUpload,
	stageInventoryUploadChunk,
	startInventoryUploadBatch,
	validateStagedInventoryUpload,
} from "@/lib/founder/inventory-import-service";
import {
	commitPurchaseUploadFile,
	commitStagedPurchaseUpload,
	stagePurchaseUploadChunk,
	startPurchaseUploadBatch,
	validateStagedPurchaseUpload,
} from "@/lib/founder/purchase-import-service";

export const runtime = "nodejs";

export async function GET() {
	try {
		const batches = await sql`
      SELECT
        id,
        filename,
        status,
        row_count AS "rowCount",
        error_count AS "errorCount",
        valid_row_count AS "validRowCount",
        quarantined_row_count AS "quarantinedRowCount",
        date_range_start AS "dateRangeStart",
        date_range_end AS "dateRangeEnd",
        uploaded_at AS "uploadedAt"
      FROM upload_batches
      ORDER BY uploaded_at DESC
    `;

		return NextResponse.json({ success: true, data: { batches } });
	} catch (error) {
		console.error("GET /api/founder/imports failed:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch upload history" },
			{ status: 500 },
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const mode = req.nextUrl.searchParams.get("mode") ?? "validate";

		if (mode === "start_batch") {
			const body = await req.json();
			const filename = body.filename ?? "upload.xlsx";
			const dataType = body.dataType ?? "sales";

			const batchId =
				dataType === "inventory"
					? (await startInventoryUploadBatch(sql, filename)).data.batchId
					: dataType === "purchase"
						? await startPurchaseUploadBatch(sql, filename)
						: await startFounderUploadBatch(sql, filename);

			return NextResponse.json({ success: true, data: { batchId } });
		}

		if (mode === "upload_chunk") {
			const body = await req.json();
			const { batchId, chunkIndex, rows, dataType = "sales" } = body;
			if (!batchId || chunkIndex === undefined || !rows) {
				return NextResponse.json(
					{ success: false, error: "Missing required parameters" },
					{ status: 400 },
				);
			}

			if (dataType === "inventory") {
				await stageInventoryUploadChunk(
					sql,
					Number(batchId),
					Number(chunkIndex),
					rows,
				);
			} else if (dataType === "purchase") {
				await stagePurchaseUploadChunk(
					sql,
					Number(batchId),
					Number(chunkIndex),
					rows,
				);
			} else {
				await stageFounderUploadChunk(
					sql,
					Number(batchId),
					Number(chunkIndex),
					rows,
				);
			}
			return NextResponse.json({ success: true });
		}

		if (mode === "validate_batch") {
			const body = await req.json();
			const { batchId, dataType = "sales" } = body;
			if (!batchId) {
				return NextResponse.json(
					{ success: false, error: "Missing batchId" },
					{ status: 400 },
				);
			}

			const validation =
				dataType === "inventory"
					? await validateStagedInventoryUpload(sql, Number(batchId))
					: dataType === "purchase"
						? await validateStagedPurchaseUpload(sql, Number(batchId))
						: await validateStagedFounderUpload(sql, Number(batchId));

			let responseData: any = validation;
			if (dataType === "purchase" || dataType === "inventory") {
				const val = validation as any;
				responseData = {
					isValid: val.success,
					totalRows: (val.rowsInserted ?? 0) + (val.quarantined ?? 0),
					validRows: val.rowsInserted ?? 0,
					dateRange: val.dateRange ?? { start: null, end: null },
					normalizationReport: val.normalizationReport,
					errors:
						val.quarantineReasons?.map((reason: string, index: number) => ({
							rowNumber: index + 1,
							errors: [reason],
						})) ?? [],
				};
			}

			return NextResponse.json({ success: true, data: responseData });
		}

		if (mode === "commit_batch") {
			const body = await req.json();
			const { batchId, uploadType, dataType = "sales" } = body;
			if (!batchId) {
				return NextResponse.json(
					{ success: false, error: "Missing batchId" },
					{ status: 400 },
				);
			}

			const typeParam =
				uploadType === "incremental" ? "incremental" : "full_replace";

			const result =
				dataType === "inventory"
					? await commitStagedInventoryUpload(sql, Number(batchId), typeParam)
					: dataType === "purchase"
						? await commitStagedPurchaseUpload(sql, Number(batchId), typeParam)
						: await commitStagedFounderUpload(sql, Number(batchId), typeParam);

			if (!result.success) {
				return NextResponse.json(
					{ success: false, error: result.error, data: result.validation },
					{ status: 400 },
				);
			}
			await refreshAnalyticsAfterCommit(dataType);
			return NextResponse.json({
				success: true,
				data: {
					batchId: result.batchId,
					rowsInserted: result.rowsInserted,
					...result.validation,
				},
			});
		}

		const formData = await req.formData();
		const file = formData.get("file");
		const dataType = (formData.get("dataType") as string) ?? "sales";

		if (!(file instanceof File)) {
			return NextResponse.json(
				{ success: false, error: "No file provided" },
				{ status: 400 },
			);
		}

		if (mode === "validate") {
			const validation =
				dataType === "purchase"
					? await validateStagedPurchaseUpload(sql, 1) // not used directly in normal flow
					: await validateFounderUploadFile(sql, file);
			return NextResponse.json({ success: true, data: validation });
		}

		if (mode === "commit") {
			const uploadType =
				(formData.get("uploadType") as string) === "incremental"
					? "incremental"
					: "full_replace";

			const result =
				dataType === "purchase"
					? await commitPurchaseUploadFile(sql, file, uploadType)
					: await commitFounderUploadFile(sql, file, uploadType);

			if (!result.success) {
				const errorData =
					"validation" in result
						? ((result as Record<string, unknown>).validation as Record<
								string,
								unknown
							>)
						: (result as unknown as Record<string, unknown>);
				return NextResponse.json(
					{
						success: false,
						error: result.error,
						data: errorData,
					},
					{ status: 400 },
				);
			}

			const successData =
				"validation" in result
					? ((result as Record<string, unknown>).validation as Record<
							string,
							unknown
						>)
					: (result as unknown as Record<string, unknown>);

			await refreshAnalyticsAfterCommit(dataType);
			return NextResponse.json({
				success: true,
				data: {
					batchId: result.batchId,
					rowsInserted: result.rowsInserted,
					...successData,
				},
			});
		}

		return NextResponse.json(
			{ success: false, error: "Invalid import mode" },
			{ status: 400 },
		);
	} catch (error) {
		console.error("POST /api/founder/imports failed:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to process upload",
			},
			{ status: 500 },
		);
	}
}
