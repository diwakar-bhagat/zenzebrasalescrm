import { OdooClient } from "./odooClient";

export interface FieldDiscoveryResult {
	model: string;
	fieldStatus: Record<
		string,
		{ available: boolean; type?: string; label?: string }
	>;
}

const AUDIT_CANDIDATE_FIELDS: Record<string, string[]> = {
	"product.template": [
		"id",
		"name",
		"default_code",
		"barcode",
		"list_price",
		"standard_price",
		"qty_available",
		"virtual_available",
		"free_qty",
		"write_date",
	],
	"product.product": [
		"id",
		"name",
		"default_code",
		"qty_available",
		"virtual_available",
		"free_qty",
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
	"stock.quant": [
		"id",
		"product_id",
		"location_id",
		"quantity",
		"reserved_quantity",
		"write_date",
	],
	"account.move": [
		"id",
		"name",
		"move_type",
		"amount_total",
		"state",
		"write_date",
	],
};

export async function runTest03(
	client?: OdooClient,
): Promise<FieldDiscoveryResult[]> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 3: Dynamic Field Availability & Discovery Audit");
	console.log("========================================");

	const results: FieldDiscoveryResult[] = [];

	for (const [model, candidates] of Object.entries(AUDIT_CANDIDATE_FIELDS)) {
		console.log(`\nDiscovering Fields for Model: [${model}]`);
		const fieldStatus: Record<
			string,
			{ available: boolean; type?: string; label?: string }
		> = {};

		try {
			const fetchedFields = await odoo.fieldsGet(model, ["type", "string"]);

			for (const fieldKey of candidates) {
				const fieldMeta = fetchedFields[fieldKey];
				const isAvailable = Boolean(fieldMeta);

				fieldStatus[fieldKey] = {
					available: isAvailable,
					type: fieldMeta?.type,
					label: fieldMeta?.string,
				};

				const icon = isAvailable ? "✅" : "❓";
				const info = isAvailable
					? `(${fieldMeta.type} - "${fieldMeta.string}")`
					: "(Not Exposed / Missing on Standard SaaS)";
				console.log(`  - Field: ${fieldKey.padEnd(18)} ${icon} ${info}`);
			}
		} catch (error: any) {
			console.log(`  ❌ Model [${model}] fields_get failed: ${error.message}`);
			for (const fieldKey of candidates) {
				fieldStatus[fieldKey] = { available: false };
			}
		}

		results.push({ model, fieldStatus });
	}

	return results;
}

if (require.main === module) {
	runTest03();
}
