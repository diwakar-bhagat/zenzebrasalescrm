import { OdooClient } from "./odooClient";

export interface ModelAuditResult {
	model: string;
	exists: boolean;
	modelName?: string;
}

const TARGET_MODELS = [
	"product.template",
	"product.product",
	"sale.order",
	"sale.order.line",
	"res.partner",
	"stock.quant",
	"stock.move",
	"account.move",
	"pos.order",
];

export async function runTest02(
	client?: OdooClient,
): Promise<ModelAuditResult[]> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 2: Model Existence Audit (ir.model)");
	console.log("========================================");

	const results: ModelAuditResult[] = [];

	try {
		// Query ir.model for target models
		const irModels = await odoo.searchRead("ir.model", {
			domain: [["model", "in", TARGET_MODELS]],
			fields: ["model", "name"],
		});

		const foundModelsMap = new Map<string, string>();
		for (const m of irModels) {
			foundModelsMap.set(m.model, m.name);
		}

		for (const modelKey of TARGET_MODELS) {
			const exists = foundModelsMap.has(modelKey);
			const modelName = foundModelsMap.get(modelKey);
			const icon = exists ? "✅" : "❌";
			console.log(
				`- Model: ${modelKey.padEnd(20)} ${icon} ${exists ? `(${modelName})` : "(Not Installed / Missing)"}`,
			);

			results.push({
				model: modelKey,
				exists,
				modelName,
			});
		}
	} catch (error: any) {
		console.warn(
			`⚠ Unable to query ir.model directly: ${error.message}. Falling back to search_read probe...`,
		);

		for (const modelKey of TARGET_MODELS) {
			try {
				await odoo.searchRead(modelKey, { limit: 1, fields: ["id"] });
				console.log(
					`- Model: ${modelKey.padEnd(20)} ✅ (Accessible via search_read)`,
				);
				results.push({ model: modelKey, exists: true });
			} catch (err: any) {
				console.log(
					`- Model: ${modelKey.padEnd(20)} ❌ (Not Accessible / Not Installed)`,
				);
				results.push({ model: modelKey, exists: false });
			}
		}
	}

	return results;
}

if (require.main === module) {
	runTest02();
}
