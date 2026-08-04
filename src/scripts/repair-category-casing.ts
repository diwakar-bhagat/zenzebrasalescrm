import path from "node:path";
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Normalises sales_fact.category to the canonical uppercase, trimmed form.
 *
 * The retail scope filter uses an exact, case-sensitive comparison:
 *   category <> ALL(ARRAY['LIVE MENU','SNACK CORNER','BEVERAGES'])
 *
 * Odoo's product categories are free text and arrived as "Live menu " and "Beverages " —
 * mixed case with a trailing space — so food sales sourced from the ERP were silently counted
 * as retail, and the dashboard listed the same category twice under two spellings.
 *
 * Merging rows is safe: category is not part of the uq_sales_fact_key grain
 * (sale_date, bill_no, billed_by, product_key), so rewriting it cannot collide.
 *
 * Idempotent.
 */

async function repair() {
	if (!process.env.DATABASE_URL) {
		console.error("Missing DATABASE_URL in environment.");
		process.exit(1);
	}

	const sql = neon(process.env.DATABASE_URL);
	console.log("Connected. Normalising category casing...\n");

	try {
		const before = await sql`
			SELECT '[' || COALESCE(category, '<null>') || ']' AS category, COUNT(*)::int AS rows
			FROM sales_fact
			WHERE category IS NULL OR category <> UPPER(TRIM(category))
			GROUP BY 1 ORDER BY 2 DESC
		`;

		if (before.length === 0) {
			console.log("✅ Every category is already canonical. Nothing to do.");
			return;
		}

		console.log("Non-canonical values found:");
		console.table(before);

		const [impact] = await sql`
			SELECT ROUND(SUM(net_amount))::int AS misfiled_food_revenue
			FROM sales_fact
			WHERE UPPER(TRIM(category)) = ANY(ARRAY['LIVE MENU','SNACK CORNER','BEVERAGES'])
				AND category <> ALL(ARRAY['LIVE MENU','SNACK CORNER','BEVERAGES'])
		`;
		console.log(
			`\nFood revenue currently escaping the retail filter: ${impact.misfiled_food_revenue ?? 0}`,
		);

		const updated = await sql`
			UPDATE sales_fact
			SET category = CASE
					WHEN category IS NULL OR TRIM(category) = '' THEN 'UNCATEGORISED'
					ELSE UPPER(TRIM(category))
				END
			WHERE category IS NULL OR category <> UPPER(TRIM(category))
			RETURNING id
		`;
		console.log(`\nNormalised ${updated.length} row(s).`);

		console.log("\nCategories after normalisation:");
		console.table(
			await sql`
				SELECT category, COUNT(*)::int AS rows,
					COUNT(*) FILTER (WHERE source_system <> 'excel')::int AS from_erp
				FROM sales_fact GROUP BY 1 ORDER BY 2 DESC
			`,
		);

		const [check] = await sql`
			SELECT COUNT(*)::int AS n FROM sales_fact
			WHERE category IS NULL OR category <> UPPER(TRIM(category))
		`;
		console.log(
			check.n === 0
				? "\n✅ All categories canonical; the retail scope filter now matches every source."
				: `\n⚠️  ${check.n} row(s) still non-canonical.`,
		);
	} catch (error) {
		console.error("\n❌ Repair failed:", error);
		process.exit(1);
	}
}

repair();
