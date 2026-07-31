import { OdooClient } from "./odooClient";

export interface FieldAuditResult {
	model: string;
	fieldResults: Record<string, boolean>;
	allPassed: boolean;
}

const TARGET_MODELS_FIELDS: Record<string, string[]> = {
	"product.template": [
		"id",
		"name",
		"default_code",
		"barcode",
		"list_price",
		"standard_price",
		"qty_available",
		"write_date",
	],
	"sale.order": [
		"id",
		"name",
		"date_order",
		"partner_id",
		"amount_total",
		"amount_untaxed",
		"state",
		"write_date",
	],
	"sale.order.line": [
		"id",
		"product_id",
		"price_unit",
		"discount",
		"product_uom_qty",
		"price_subtotal",
		"tax_id",
		"write_date",
	],
	"res.partner": [
		"id",
		"name",
		"mobile",
		"email",
		"city",
		"customer_rank",
		"write_date",
	],
};

export async function runTest02(
	client?: OdooClient,
): Promise<FieldAuditResult[]> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 2: Field Availability & Permission Audit");
	console.log("========================================");

	const auditResults: FieldAuditResult[] = [];

	for (const [model, requiredFields] of Object.entries(TARGET_MODELS_FIELDS)) {
		console.log(`\nAuditing Model: [${model}]`);
		const fieldResults: Record<string, boolean> = {};
		let allPassed = true;

		try {
			const availableFields = await odoo.fieldsGet(model, ["type", "string"]);

			for (const field of requiredFields) {
				const isAvailable = Boolean(availableFields[field]);
				fieldResults[field] = isAvailable;
				if (!isAvailable) allPassed = false;

				const icon = isAvailable ? "✅" : "❌";
				const typeInfo = isAvailable
					? `(${availableFields[field].type})`
					: "(Field Not Accessible or Restricted)";
				console.log(`  - Field: ${field.padEnd(18)} ${icon} ${typeInfo}`);
			}
		} catch (error: any) {
			console.error(
				`  ❌ Failed to fetch fields for model ${model}:`,
				error.message,
			);
			for (const field of requiredFields) {
				fieldResults[field] = false;
			}
			allPassed = false;
		}

		auditResults.push({ model, fieldResults, allPassed });
	}

	return auditResults;
}

if (require.main === module) {
	runTest02();
}
