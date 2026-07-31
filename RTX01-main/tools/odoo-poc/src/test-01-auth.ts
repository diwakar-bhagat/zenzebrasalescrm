import { OdooClient } from "./odooClient";

export async function runTest01(
	client?: OdooClient,
): Promise<{ success: boolean; details: any }> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 1: Odoo Authentication & Session Check");
	console.log("========================================");

	try {
		const session = await odoo.authenticate();

		console.log("✅ Authentication Successful!");
		console.log(
			`- Session ID:   ${session.sessionId ? session.sessionId.substring(0, 12) + "..." : "Acquired"}`,
		);
		console.log(`- User ID (UID): ${session.uid}`);
		console.log(`- Database:     ${session.db}`);
		console.log(`- User Context: ${JSON.stringify(session.userContext)}`);

		return {
			success: true,
			details: {
				sessionId: Boolean(session.sessionId),
				uid: session.uid,
				userContext: session.userContext,
			},
		};
	} catch (error: any) {
		console.error("❌ Test 1 FAILED:", error.message);
		return {
			success: false,
			details: { error: error.message },
		};
	}
}

if (require.main === module) {
	runTest01();
}
