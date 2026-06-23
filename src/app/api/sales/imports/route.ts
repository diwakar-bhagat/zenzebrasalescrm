import { type NextRequest, NextResponse } from "next/server";

import { commitFounderUploadFile, validateFounderUploadFile } from "@/lib/founder/import-service";
import { sql } from "@/lib/db";

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
    return NextResponse.json({ success: false, error: "Failed to fetch upload history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get("mode") ?? "validate";
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (mode === "validate") {
      const validation = await validateFounderUploadFile(file);
      return NextResponse.json({ success: true, data: validation });
    }

    if (mode === "commit") {
      const uploadType = (formData.get("uploadType") as string) === "incremental" ? "incremental" : "full_replace";
      const result = await commitFounderUploadFile(sql, file, uploadType);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, data: result.validation },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          batchId: result.batchId,
          rowsInserted: result.rowsInserted,
          ...result.validation,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid import mode" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/founder/imports failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process upload",
      },
      { status: 500 },
    );
  }
}
