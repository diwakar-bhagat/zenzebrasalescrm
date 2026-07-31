import { generateCapabilityReport } from "./capability-report";
import { OdooClient } from "./odooClient";
import { runTest00 } from "./test-00-health";
import { runTest01 } from "./test-01-auth-callkw";
import { runTest02 } from "./test-02-models-audit";
import { runTest03 } from "./test-03-fields-discovery";
import { runTest04 } from "./test-04-filtering-sorting";
import { runTest05 } from "./test-05-pagination";

async function main() {
	console.log("====================================================");
	console.log(" ZENZEBRA SALES CRM - ODOO STANDARD FEASIBILITY POC");
	console.log("====================================================");

	const client = new OdooClient();

	if (!client.isConfigured()) {
		console.log(
			"\n[NOTICE] Odoo credentials are not populated in tools/odoo-poc/.env.",
		);
		console.log("To run against a live Odoo instance, populate:");
		console.log("  - ODOO_URL");
		console.log("  - ODOO_DB");
		console.log("  - ODOO_USERNAME");
		console.log("  - ODOO_PASSWORD\n");
	}

	// Step 0: Health Check & Version Info
	const healthRes = await runTest00(client);

	// Step 1: Authentication & Minimal call_kw Probe
	const authCallKwRes = await runTest01(client);

	if (!authCallKwRes.authSuccess || !authCallKwRes.callKwSuccess) {
		console.log("\n❌ [STOPPING EXECUTION] Test 1 (Auth / call_kw) failed.");
		console.log(
			"Verify credentials and permissions in tools/odoo-poc/.env to run remaining tests.\n",
		);
		return;
	}

	// Step 2: Installed Models Audit (ir.model)
	const modelAuditResults = await runTest02(client);

	// Step 3: Dynamic Field Availability & Discovery Audit
	const fieldDiscoveryResults = await runTest03(client);

	// Step 4: Domain Filtering, Sorting & write_date Check
	const filterSortResults = await runTest04(client);

	// Step 5: Pagination & Offset Check
	const paginationResults = await runTest05(client);

	// Step 6: Generate Capability Report
	const report = generateCapabilityReport({
		healthResult: healthRes,
		authCallKwResult: authCallKwRes,
		modelAuditResults,
		fieldDiscoveryResults,
		filterSortResults,
		paginationResults,
	});

	console.log(report);
}

main().catch((err) => {
	console.error("Unhandled error running POC test suite:", err);
});
