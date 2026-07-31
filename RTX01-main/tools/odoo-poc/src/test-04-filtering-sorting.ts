import { OdooClient } from "./odooClient";

export interface FilterSortResult {
	model: string;
	domainTested: any[];
	filterSuccess: boolean;
	sortingSuccess: boolean;
	writeDateAvailable: boolean;
	sampleCount: number;
}

export async function runTest04(
	client?: OdooClient,
): Promise<FilterSortResult[]> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 4: Domain Filtering, Sorting & write_date Verification");
	console.log("========================================");

	const tests = [
		{
			model: "product.template",
			domain: [["default_code", "!=", false]],
			fields: ["id", "name", "default_code", "write_date"],
		},
		{
			model: "sale.order",
			domain: [["date_order", ">=", "2020-01-01"]],
			fields: ["id", "name", "date_order", "state", "write_date"],
		},
		{
			model: "sale.order.line",
			domain: [["price_unit", ">", 0]],
			fields: ["id", "product_id", "price_unit", "write_date"],
		},
		{
			model: "res.partner",
			domain: [["customer_rank", ">=", 0]],
			fields: ["id", "name", "email", "customer_rank", "write_date"],
		},
	];

	const results: FilterSortResult[] = [];

	for (const t of tests) {
		console.log(`\nTesting Model: [${t.model}]`);
		let filterSuccess = false;
		let sortingSuccess = false;
		let writeDateAvailable = false;
		let sampleCount = 0;

		try {
			const records = await odoo.searchRead(t.model, {
				domain: t.domain,
				fields: t.fields,
				limit: 5,
				order: "write_date desc",
			});

			filterSuccess = Array.isArray(records);
			sampleCount = records.length;
			sortingSuccess = true;

			if (records.length > 0) {
				writeDateAvailable = Boolean(records[0].write_date);
			} else {
				const anyRecs = await odoo.searchRead(t.model, {
					fields: ["write_date"],
					limit: 1,
				});
				writeDateAvailable =
					anyRecs.length > 0 && Boolean(anyRecs[0].write_date);
			}

			console.log(
				`  - Domain Filtering (${JSON.stringify(t.domain)}): ${filterSuccess ? "✅ Passed" : "❌ Failed"} (Records: ${sampleCount})`,
			);
			console.log(
				`  - Sorting by 'write_date desc':                     ${sortingSuccess ? "✅ Supported" : "❌ Failed"}`,
			);
			console.log(
				`  - write_date Incremental Field:                    ${writeDateAvailable ? "✅ Present" : "❌ Missing"}`,
			);
		} catch (error: any) {
			console.error(
				`  ❌ Error testing filtering/sorting on ${t.model}:`,
				error.message,
			);
		}

		results.push({
			model: t.model,
			domainTested: t.domain,
			filterSuccess,
			sortingSuccess,
			writeDateAvailable,
			sampleCount,
		});
	}

	return results;
}

if (require.main === module) {
	runTest04();
}
