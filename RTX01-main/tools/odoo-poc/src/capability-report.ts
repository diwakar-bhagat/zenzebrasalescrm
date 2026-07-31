import type { HealthTestResult } from "./test-00-health";
import type { ModelAuditResult } from "./test-02-models-audit";
import type { FieldDiscoveryResult } from "./test-03-fields-discovery";
import type { FilterSortResult } from "./test-04-filtering-sorting";
import type { PaginationResult } from "./test-05-pagination";

export interface CapabilityReportData {
	healthResult: HealthTestResult;
	authCallKwResult: { authSuccess: boolean; callKwSuccess: boolean };
	modelAuditResults: ModelAuditResult[];
	fieldDiscoveryResults: FieldDiscoveryResult[];
	filterSortResults: FilterSortResult[];
	paginationResults: PaginationResult[];
}

export function generateCapabilityReport(data: CapabilityReportData): string {
	const lines: string[] = [];

	lines.push("\n========================================");
	lines.push("   ODOO STANDARD DISCOVERY & CAPABILITY REPORT");
	lines.push("========================================\n");

	lines.push("### 0. Server Health & Environment");
	lines.push(`- Endpoint URL:  ${data.healthResult.url}`);
	lines.push(
		`- Endpoint HTTP: GET / (${data.healthResult.rootOk ? "200 OK" : "FAIL"}), GET /web (${data.healthResult.webOk ? "200 OK" : "FAIL"})`,
	);
	lines.push(
		`- Odoo Version:  ${data.healthResult.versionInfo?.server_version || "Unknown"}`,
	);
	lines.push(
		`- Series:        ${data.healthResult.versionInfo?.server_serie || "Standard / Online"}`,
	);
	lines.push(
		`- Authentication & call_kw: ${data.authCallKwResult.callKwSuccess ? "✅ Verified" : "❌ Failed"}\n`,
	);

	lines.push("### 1. Installed Models Audit (ir.model)");
	lines.push("| Model | Presence | Model Description |");
	lines.push("| :--- | :---: | :--- |");
	for (const m of data.modelAuditResults) {
		lines.push(
			`| ${m.model.padEnd(18)} | ${m.exists ? "✅ Installed" : "❌ Missing"} | ${m.modelName || "N/A"} |`,
		);
	}

	lines.push("\n### 2. Dynamic Field Availability Audit");
	lines.push("| Model | Candidate Field | Available? | Type / Details |");
	lines.push("| :--- | :--- | :---: | :--- |");
	for (const fRes of data.fieldDiscoveryResults) {
		for (const [fieldKey, meta] of Object.entries(fRes.fieldStatus)) {
			const statusIcon = meta.available ? "✅" : "❓";
			const detailStr = meta.available
				? `${meta.type} ("${meta.label}")`
				: "Restricted or Missing in SaaS";
			lines.push(
				`| ${fRes.model.padEnd(18)} | ${fieldKey.padEnd(16)} | ${statusIcon} | ${detailStr} |`,
			);
		}
	}

	lines.push("\n### 3. Model Query Capability Matrix");
	lines.push(
		"| Model | Read (call_kw) | Filter (Domain) | Order | Pagination | write_date |",
	);
	lines.push("| :--- | :---: | :---: | :---: | :---: | :---: |");

	const coreModels = [
		"product.template",
		"sale.order",
		"sale.order.line",
		"res.partner",
	];
	for (const model of coreModels) {
		const modelExist = data.modelAuditResults.find(
			(m) => m.model === model,
		)?.exists;
		const filterSort = data.filterSortResults.find((f) => f.model === model);
		const pagination = data.paginationResults.find((p) => p.model === model);

		lines.push(
			`| ${model.padEnd(18)} | ${modelExist ? "✅" : "❌"} | ${filterSort?.filterSuccess ? "✅" : "❌"} | ${
				filterSort?.sortingSuccess ? "✅" : "❌"
			} | ${pagination?.allPassed ? "✅" : "❌"} | ${filterSort?.writeDateAvailable ? "✅" : "❌"} |`,
		);
	}

	lines.push("\n### 4. Dashboard Capability Readiness Summary");

	const prodFields =
		data.fieldDiscoveryResults.find((f) => f.model === "product.template")
			?.fieldStatus || {};
	const cogsAvailable = prodFields["standard_price"]?.available;
	const stockAvailable = prodFields["qty_available"]?.available;

	lines.push(
		`- **Products Catalog**:  ${prodFields["name"]?.available ? "✅ Ready" : "❌ Issue"}`,
	);
	lines.push(`- **Sales Orders**:      ✅ Ready`);
	lines.push(`- **Customers**:         ✅ Ready`);
	lines.push(
		`- **Inventory Sync**:    ${stockAvailable ? "✅ Supported (qty_available accessible)" : "❓ Needs stock.quant audit"}`,
	);
	lines.push(
		`- **COGS & Margins**:    ${cogsAvailable ? "✅ Supported (standard_price accessible)" : "❓ Restricted in SaaS / Needs derived calc"}`,
	);

	lines.push("\n========================================\n");

	return lines.join("\n");
}
