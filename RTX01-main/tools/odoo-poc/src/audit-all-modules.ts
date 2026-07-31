import { OdooClient } from "./odooClient";

async function auditAllModules() {
	console.log("===========================================================");
	console.log(" ODOO 19 ENTERPRISE FULL MODULE & METADATA AUDIT");
	console.log("===========================================================\n");

	const client = new OdooClient();
	await client.authenticate();

	// 1. Fetch all installed models from ir.model
	console.log("Fetching installed models from ir.model...");
	const allIrModels = await client.searchRead("ir.model", {
		fields: ["model", "name", "transient", "state"],
		limit: 1000,
	});

	console.log(`Total models registered in ir.model: ${allIrModels.length}`);
	const modelMap = new Map<string, string>();
	for (const m of allIrModels) {
		modelMap.set(m.model, m.name);
	}

	// Target model list spanning all audited modules
	const targetModels = [
		// Product & Catalog
		"product.template",
		"product.product",
		"product.category",
		"product.attribute",
		// Sales & POS
		"sale.order",
		"sale.order.line",
		"pos.order",
		"pos.order.line",
		"pos.session",
		"pos.payment",
		// Inventory
		"stock.quant",
		"stock.move",
		"stock.picking",
		"stock.valuation.layer",
		// Accounting
		"account.move",
		"account.move.line",
		"account.payment",
		// CRM & Partners
		"crm.lead",
		"res.partner",
		"res.company",
		"res.users",
		// Website & E-commerce
		"website",
		"website.visitor",
		"website.track",
		"payment.provider",
		"payment.transaction",
		// Messaging & Collaboration
		"mail.message",
		"mail.activity",
		"ir.attachment",
		"discuss.channel",
		// HR & Operations
		"hr.employee",
		"project.project",
		"project.task",
		"hr.expense",
		"loyalty.program",
		"loyalty.card",
	];

	console.log("\n-----------------------------------------------------------");
	console.log("MODEL INSTALLED AUDIT RESULTS");
	console.log("-----------------------------------------------------------");

	const auditSummary: Array<{
		model: string;
		installed: boolean;
		name: string;
		fieldsCount: number;
		hasWriteDate: boolean;
		hasPartnerId: boolean;
		hasProductId: boolean;
		hasCompanyId: boolean;
		sampleCount: number;
		candidateFields: string[];
	}> = [];

	for (const modelKey of targetModels) {
		const isInstalled = modelMap.has(modelKey);
		const modelName = modelMap.get(modelKey) || "Not Installed";
		let fieldsCount = 0;
		let hasWriteDate = false;
		let hasPartnerId = false;
		let hasProductId = false;
		let hasCompanyId = false;
		let sampleCount = 0;
		let candidateFields: string[] = [];

		if (isInstalled) {
			try {
				const fields = await client.fieldsGet(modelKey, ["type", "string"]);
				candidateFields = Object.keys(fields);
				fieldsCount = candidateFields.length;
				hasWriteDate = Boolean(fields["write_date"]);
				hasPartnerId = Boolean(fields["partner_id"]);
				hasProductId = Boolean(fields["product_id"]);
				hasCompanyId = Boolean(fields["company_id"]);

				const samples = await client.searchRead(modelKey, {
					limit: 1,
					fields: ["id"],
				});
				sampleCount = samples.length;
			} catch (err: any) {
				// Restricted or missing permissions
			}
		}

		auditSummary.push({
			model: modelKey,
			installed: isInstalled,
			name: modelName,
			fieldsCount,
			hasWriteDate,
			hasPartnerId,
			hasProductId,
			hasCompanyId,
			sampleCount,
			candidateFields,
		});

		const statusIcon = isInstalled ? "✅" : "❌";
		console.log(
			`- ${modelKey.padEnd(24)} ${statusIcon} Installed: ${isInstalled ? "YES" : "NO"} | Fields: ${fieldsCount
				.toString()
				.padEnd(
					3,
				)} | write_date: ${hasWriteDate ? "YES" : "NO"} | Samples: ${sampleCount}`,
		);
	}

	console.log("\n===========================================================");
	console.log(" COMPREHENSIVE METADATA DISCOVERY COMPLETE");
	console.log("===========================================================");
}

auditAllModules().catch((err) => {
	console.error("Audit execution error:", err);
});
