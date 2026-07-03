import { type NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

const DUMMY_PASSWORD_HASH =
	"$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const username =
			typeof body.username === "string"
				? body.username.toLowerCase().trim()
				: "";
		const password = typeof body.password === "string" ? body.password : "";

		if (!username || !password) {
			return NextResponse.json(
				{ error: "Invalid credentials" },
				{ status: 401 },
			);
		}

		// Find user by username
		let user: any;
		let passwordValid = false;

		if (!process.env.DATABASE_URL) {
			const lowercaseUsername = username.toLowerCase();
			if (
				(lowercaseUsername === "zebra" && password === "zebra123") ||
				(lowercaseUsername === "diwakarpro01" && password === "zebra123") ||
				(lowercaseUsername === "gautam12" && password === "zebra123")
			) {
				user = {
					id:
						lowercaseUsername === "zebra"
							? 999
							: lowercaseUsername === "diwakarpro01"
								? 1
								: 2,
					username: lowercaseUsername,
					is_active: true,
				};
				passwordValid = true;
			}
		} else {
			const users = await sql`
        SELECT id, username, password_hash, is_active
        FROM users
        WHERE username = ${username}
      `;
			user = users[0];
			if (user) {
				passwordValid = await verifyPassword(user.password_hash, password);
			} else {
				await verifyPassword(DUMMY_PASSWORD_HASH, password);
			}
		}

		if (!user || !user.is_active || !passwordValid) {
			return NextResponse.json(
				{ error: "Invalid credentials" },
				{ status: 401 },
			);
		}

		// Create session and set cookie
		const token = await createSession(user.id);
		await setSessionCookie(token);

		return NextResponse.json({ success: true, redirect: "/dashboard" });
	} catch (error: any) {
		console.error("Login error:", error);
		const isDev = process.env.NODE_ENV !== "production";
		return NextResponse.json(
			{
				error: isDev
					? `Internal server error: ${error?.message || String(error)}`
					: "Internal server error",
			},
			{ status: 500 },
		);
	}
}
