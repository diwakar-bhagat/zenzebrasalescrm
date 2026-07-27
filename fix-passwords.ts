import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
	algorithm: 2,
	memoryCost: 65536,
	timeCost: 3,
	parallelism: 4,
} as const;

const sql = neon(process.env.DATABASE_URL!);

async function main() {
	try {
		// Get the password hash for 'zebra'
		const users =
			await sql`SELECT id, username, password_hash FROM users WHERE username = 'zebra'`;
		const user = users[0] as any;
		console.log("User found:", { id: user.id, username: user.username });

		// Test if 'zebra123' matches
		const matches = await argon2Verify(
			user.password_hash,
			"zebra123",
			ARGON2_OPTIONS,
		);
		console.log("Does 'zebra123' match the stored hash?", matches);

		if (!matches) {
			console.log(
				"\n❌ Password does NOT match. Resetting all passwords to 'zebra123'...",
			);
			const newHash = await argon2Hash("zebra123", ARGON2_OPTIONS);

			await sql`UPDATE users SET password_hash = ${newHash} WHERE username = 'zebra'`;
			await sql`UPDATE users SET password_hash = ${newHash} WHERE username = 'diwakarpro01'`;
			await sql`UPDATE users SET password_hash = ${newHash} WHERE username = 'gautam12'`;

			// Verify the fix
			const verify = await argon2Verify(newHash, "zebra123", ARGON2_OPTIONS);
			console.log("✅ New hash verified:", verify);
			console.log(
				"✅ All user passwords reset to 'zebra123'. You can now login!",
			);
		} else {
			console.log(
				"✅ Password already matches 'zebra123'. Checking login route logic...",
			);
		}
	} catch (err: any) {
		console.error("Error:", err.message);
	}
}

main();
