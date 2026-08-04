import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Repairs store identity on ERP-sourced sales_fact rows.
 *
 * The original Odoo sync looked up store_dimension per order and silently accepted a miss,
 * leaving 882 of 2,540 rows with a null store_id. sales_fact_v falls back to billed_by for
 * store_display_name, so those rows render under a raw ERP name instead of the display name.
 *
 * Also seeds aliases for Odoo POS config names that had no mapping — notably 'ZenZebra',
 * which arrived on 123 rows.
 *
 * Idempotent. Reports what it changed rather than assuming.
 */

const ODOO_ALIASES = [
	{ source: "ZenZebra", canonical: "SmartworksNoida Noida" },
	{ source: "SWN", canonical: "SmartworksNoida Noida" },
	{ source: "KLJ", canonical: "Klj store" },
];

async function repair() {
	if (!process.env.DATABASE_URL) {
		console.error("Missing DATABASE_URL in environment.");
		process.exit(1);
	}

	const sql = neon(process.env.DATABASE_URL);
	console.log("Connected. Repairing ERP store mapping...\n");

	try {
		console.log("Before:");
		console.table(
			await sql`
				SELECT source_system, source_billed_by, billed_by, store_id, COUNT(*)::int AS rows
				FROM sales_fact WHERE source_system LIKE 'odoo%'
				GROUP BY 1,2,3,4 ORDER BY 5 DESC
			`,
		);

		console.log("\n[1/3] Seeding Odoo POS config aliases...");
		for (const alias of ODOO_ALIASES) {
			await sql`
				INSERT INTO store_alias_mapping (source_name, canonical_store)
				VALUES (${alias.source}, ${alias.canonical})
				ON CONFLICT (source_name) DO UPDATE SET canonical_store = EXCLUDED.canonical_store
			`;
		}

		// Re-resolve billed_by through the alias table for ERP rows whose raw name now maps.
		console.log("[2/3] Re-normalising billed_by from source_billed_by...");
		const renamed = await sql`
			UPDATE sales_fact sf
			SET billed_by = sam.canonical_store
			FROM store_alias_mapping sam
			WHERE sf.source_system LIKE 'odoo%'
				AND LOWER(TRIM(COALESCE(sf.source_billed_by, sf.billed_by))) = LOWER(TRIM(sam.source_name))
				AND sf.billed_by IS DISTINCT FROM sam.canonical_store
			RETURNING sf.id
		`;
		console.log(`      Renormalised ${renamed.length} row(s).`);

		console.log("[3/3] Linking store_id from store_dimension...");
		const linked = await sql`
			UPDATE sales_fact sf
			SET store_id = sd.id
			FROM store_dimension sd
			WHERE sf.store_id IS NULL AND sf.billed_by = sd.store_name
			RETURNING sf.id
		`;
		console.log(`      Linked ${linked.length} row(s).`);

		console.log("\nAfter:");
		console.table(
			await sql`
				SELECT source_system, source_billed_by, billed_by, store_id, COUNT(*)::int AS rows
				FROM sales_fact WHERE source_system LIKE 'odoo%'
				GROUP BY 1,2,3,4 ORDER BY 5 DESC
			`,
		);

		const [remaining] = await sql`
			SELECT COUNT(*)::int AS n FROM sales_fact WHERE store_id IS NULL
		`;
		if (Number(remaining.n) > 0) {
			console.warn(
				`\n⚠️  ${remaining.n} row(s) still have a null store_id. Inspect their source_billed_by and add an alias:`,
			);
			console.table(
				await sql`
					SELECT source_billed_by, billed_by, COUNT(*)::int AS rows
					FROM sales_fact WHERE store_id IS NULL GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10
				`,
			);
		} else {
			console.log("\n✅ Every sales_fact row is linked to a store.");
		}
	} catch (error) {
		console.error("\n❌ Repair failed:", error);
		process.exit(1);
	}
}

repair();
