import { NextResponse } from "next/server";

/**
 * POST /api/webhooks/odoo/crm — not implemented.
 *
 * This endpoint was written against tables that were never created: the migration in
 * src/scripts/migrate-odoo-webhook-tables.ts has not been run, so every delivery here
 * failed with an undefined-table error. Nothing in the application reads those tables
 * either, so there is no consumer waiting on the data.
 *
 * It returns 501 rather than 500 so an Odoo automation pointed here reports a clear,
 * actionable status instead of looking like an intermittent server fault.
 *
 * To enable: run the migration, build a reader for the data, then implement ingestion
 * through the shared pipeline in src/lib/erp/ as /api/webhooks/odoo does.
 */

export const runtime = "nodejs";

const MESSAGE =
	"The crm webhook is not implemented. Its backing tables do not exist and no part of the application reads them.";

export async function POST() {
	return NextResponse.json({ error: MESSAGE }, { status: 501 });
}

export async function GET() {
	return NextResponse.json(
		{ status: "not_implemented", detail: MESSAGE },
		{ status: 501 },
	);
}
