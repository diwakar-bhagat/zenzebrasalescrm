import { OdooClient, type VersionInfo } from "./odooClient";

export interface HealthTestResult {
	url: string;
	rootOk: boolean;
	webOk: boolean;
	versionInfo: VersionInfo | null;
}

export async function runTest00(
	client?: OdooClient,
): Promise<HealthTestResult> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 0: Endpoint Health & Odoo Version Check");
	console.log("========================================");

	const url = odoo.getUrl();
	console.log(`Target Odoo URL: ${url}`);

	try {
		const health = await odoo.healthCheck();
		console.log(
			`- GET /        : ${health.rootOk ? "✅ 200 OK" : `❌ Status ${health.rootStatus}`}`,
		);
		console.log(
			`- GET /web     : ${health.webOk ? "✅ 200 OK" : `❌ Status ${health.webStatus}`}`,
		);

		let versionInfo: VersionInfo | null = null;
		try {
			versionInfo = await odoo.getVersionInfo();
			console.log(
				`- Odoo Version : ${versionInfo.server_version || "Unknown"}`,
			);
			console.log(
				`- Server Series: ${versionInfo.server_serie || "Standard/Online"}`,
			);
		} catch (vErr: any) {
			console.log(`- Version Info : ⚠ ${vErr.message}`);
		}

		const allOk = health.rootOk && health.webOk;
		if (!allOk) {
			console.error("❌ Health check failed: Cannot reach Odoo endpoints.");
		}

		return {
			url,
			rootOk: health.rootOk,
			webOk: health.webOk,
			versionInfo,
		};
	} catch (error: any) {
		console.error(`❌ Health Check Exception: ${error.message}`);
		return {
			url,
			rootOk: false,
			webOk: false,
			versionInfo: null,
		};
	}
}

if (require.main === module) {
	runTest00();
}
