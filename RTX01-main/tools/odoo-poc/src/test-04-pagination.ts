import { OdooClient } from "./odooClient";

export interface PaginationResult {
	model: string;
	offsetsTested: Record<number, { success: boolean; count: number }>;
	allPassed: boolean;
}

export async function runTest04(
	client?: OdooClient,
): Promise<PaginationResult[]> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 4: Pagination & Offset Handling");
	console.log("========================================");

	const models = ["product.template", "sale.order", "res.partner"];
	const offsets = [0, 100, 500];
	const results: PaginationResult[] = [];

	for (const model of models) {
		console.log(`\nTesting Pagination on Model: [${model}]`);
		const offsetsTested: Record<number, { success: boolean; count: number }> =
			{};
		let allPassed = true;

		for (const offset of offsets) {
			try {
				const records = await odoo.searchRead(model, {
					domain: [],
					fields: ["id"],
					limit: 10,
					offset,
				});

				const success = Array.isArray(records);
				offsetsTested[offset] = { success, count: records.length };

				console.log(
					`  - Offset ${offset.toString().padEnd(4)} (limit 10): ✅ Success (Retrieved ${records.length} records)`,
				);
			} catch (error: any) {
				console.error(
					`  - Offset ${offset.toString().padEnd(4)}: ❌ Failed (${error.message})`,
				);
				offsetsTested[offset] = { success: false, count: 0 };
				allPassed = false;
			}
		}

		results.push({ model, offsetsTested, allPassed });
	}

	return results;
}

if (require.main === module) {
	runTest04();
}
