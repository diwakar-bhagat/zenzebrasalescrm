import { OdooClient } from "./odooClient";

export async function runTest01(
	client?: OdooClient,
): Promise<{ authSuccess: boolean; callKwSuccess: boolean; details: any }> {
	const odoo = client || new OdooClient();
	console.log("\n========================================");
	console.log("Test 1: Authentication & Minimal call_kw Probe");
	console.log("========================================");

	try {
		const session = await odoo.authenticate();

		console.log("✅ Authentication Successful!");
		console.log(
			`- Session ID:   ${session.sessionId ? session.sessionId.substring(0, 12) + "..." : "Acquired"}`,
		);
		console.log(`- User ID (UID): ${session.uid}`);
		console.log(`- User Context: ${JSON.stringify(session.userContext)}`);

		// Test 1b: Minimal call_kw on res.users (search_read limit=1)
		console.log("\nExecuting minimal call_kw on [res.users] (limit 1)...");
		const users = await odoo.callKw(
			"res.users",
			"search_read",
			[[["id", "=", session.uid]]],
			{
				fields: ["id", "name", "login"],
				limit: 1,
			},
		);

		if (Array.isArray(users) && users.length > 0) {
			console.log(
				`✅ call_kw Successful! Verified user record: [${users[0].name}] (${users[0].login})`,
			);
			return {
				authSuccess: true,
				callKwSuccess: true,
				details: { session, user: users[0] },
			};
		} else {
			console.warn("⚠ call_kw executed but returned no user records.");
			return {
				authSuccess: true,
				callKwSuccess: false,
				details: { session, warning: "No user records returned" },
			};
		}
	} catch (error: any) {
		console.error("❌ Test 1 FAILED:", error.message);
		return {
			authSuccess: false,
			callKwSuccess: false,
			details: { error: error.message },
		};
	}
}

if (require.main === module) {
	runTest01();
}
