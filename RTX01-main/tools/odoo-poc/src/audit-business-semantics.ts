import { OdooClient } from "./odooClient";

async function auditBusinessSemantics() {
	console.log("===========================================================");
	console.log(" PHASE 2.8: BUSINESS SEMANTICS & IDENTITY AUDIT");
	console.log(" Target Instance: zenzebra1.odoo.com");
	console.log("===========================================================\n");

	const client = new OdooClient();
	await client.authenticate();

	// 1. Audit Store Identity (pos.config, pos.session, pos.order)
	console.log("-----------------------------------------------------------");
	console.log("1. AUDITING STORE IDENTITY & LOCATION STRUCTURE");
	console.log("-----------------------------------------------------------");
	try {
		const posConfigs = await client.searchRead("pos.config", {
			fields: ["id", "name", "company_id", "picking_type_id"],
		});

		console.log("POS Configurations (Store Entry Points):");
		console.log(JSON.stringify(posConfigs, null, 2));

		const posOrders = await client.searchRead("pos.order", {
			fields: [
				"id",
				"name",
				"session_id",
				"config_id",
				"company_id",
				"partner_id",
				"amount_total",
			],
			limit: 5,
		});

		console.log("\nSample POS Orders with Store Linkage:");
		console.log(JSON.stringify(posOrders, null, 2));
	} catch (err: any) {
		console.error("Error auditing Store Identity:", err.message);
	}

	// 2. Audit Customer Identity & Guest Checkouts (res.partner)
	console.log("\n-----------------------------------------------------------");
	console.log("2. AUDITING CUSTOMER IDENTITY & GUEST CHECKOUTS");
	console.log("-----------------------------------------------------------");
	try {
		const partners = await client.searchRead("res.partner", {
			domain: [["customer_rank", ">", 0]],
			fields: ["id", "name", "phone", "mobile", "email", "city", "write_date"],
			limit: 10,
		});

		console.log("Sample Active Customer Partners:");
		console.log(JSON.stringify(partners, null, 2));

		const totalPartners = await client.searchRead("res.partner", {
			fields: ["id"],
			limit: 1000,
		});
		const noEmail = partners.filter((p) => !p.email).length;
		const noPhone = partners.filter((p) => !p.phone && !p.mobile).length;

		console.log(`\nCustomer Identity Metrics (Sample ${partners.length}):`);
		console.log(
			`- Missing Email: ${noEmail} (${((noEmail / partners.length) * 100).toFixed(1)}%)`,
		);
		console.log(
			`- Missing Phone: ${noPhone} (${((noPhone / partners.length) * 100).toFixed(1)}%)`,
		);
	} catch (err: any) {
		console.error("Error auditing Customer Identity:", err.message);
	}

	// 3. Audit Refunds, Returns & Negative Line Totals (pos.order & pos.order.line)
	console.log("\n-----------------------------------------------------------");
	console.log("3. AUDITING REFUNDS & RETURNS STRUCTURE");
	console.log("-----------------------------------------------------------");
	try {
		const returnOrders = await client.searchRead("pos.order", {
			domain: [["amount_total", "<", 0]],
			fields: ["id", "name", "amount_total", "date_order", "state"],
			limit: 5,
		});

		console.log(
			`Negative Amount / Return Orders Found: ${returnOrders.length}`,
		);
		if (returnOrders.length > 0) {
			console.log(JSON.stringify(returnOrders, null, 2));
		}
	} catch (err: any) {
		console.error("Error auditing Returns:", err.message);
	}

	// 4. Audit Archived Records (active = False)
	console.log("\n-----------------------------------------------------------");
	console.log("4. AUDITING ARCHIVED RECORDS (active = False)");
	console.log("-----------------------------------------------------------");
	try {
		const archivedProducts = await client.searchRead("product.template", {
			domain: [["active", "=", false]],
			fields: ["id", "name", "active"],
			limit: 5,
		});

		console.log(`Archived Products Found (Sample): ${archivedProducts.length}`);
	} catch (err: any) {
		console.error("Error auditing Archived Records:", err.message);
	}

	console.log("\n===========================================================");
	console.log(" PHASE 2.8 BUSINESS SEMANTICS AUDIT COMPLETE");
	console.log("===========================================================");
}

auditBusinessSemantics().catch((err) => {
	console.error("Audit execution error:", err);
});
