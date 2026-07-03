import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import crypto from "crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

const SESSION_COOKIE_NAME = "zz_session";
const SESSION_EXPIRY_HOURS = 8;
const ARGON2_OPTIONS = {
	algorithm: 2,
	memoryCost: 65536,
	timeCost: 3,
	parallelism: 4,
} as const;

// ── Argon2id helpers ──────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
	return argon2Hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
	hash: string,
	password: string,
): Promise<boolean> {
	try {
		return await argon2Verify(hash, password);
	} catch {
		return false;
	}
}

// ── Token + SHA-256 helpers ───────────────────────────────────────────

function generateToken(): string {
	return crypto.randomBytes(32).toString("hex");
}

function sha256(input: string): string {
	return crypto.createHash("sha256").update(input).digest("hex");
}

// ── Developer / Fallback session store ────────────────────────────────
export const devSessions = new Map<
	string,
	{ userId: number; expiresAt: Date }
>();

export function isDevSessionValid(tokenHash: string): boolean {
	const session = devSessions.get(tokenHash);
	if (!session) return false;
	if (session.expiresAt < new Date()) {
		devSessions.delete(tokenHash);
		return false;
	}
	return true;
}

// ── Session management ───────────────────────────────────────────────

export async function createSession(userId: number): Promise<string> {
	const token = generateToken();
	const tokenHash = sha256(token);
	const expiresAt = new Date(
		Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
	).toISOString();

	if (!process.env.DATABASE_URL) {
		devSessions.set(tokenHash, { userId, expiresAt: new Date(expiresAt) });
		return token;
	}

	await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

	return token;
}

export async function validateSession(token: string): Promise<{
	userId: number;
	name: string;
	username: string;
	employeeId: string;
} | null> {
	if (!token) return null;

	const tokenHash = sha256(token);

	if (!process.env.DATABASE_URL) {
		const session = devSessions.get(tokenHash);
		if (!session) return null;
		if (session.expiresAt < new Date()) {
			devSessions.delete(tokenHash);
			return null;
		}
		// Return mock user info based on userId
		if (session.userId === 1) {
			return {
				userId: 1,
				name: "Diwakar Bhagat",
				username: "Diwakarpro01",
				employeeId: "EMP001",
			};
		} else if (session.userId === 2) {
			return {
				userId: 2,
				name: "Gautam",
				username: "Gautam12",
				employeeId: "EMP002",
			};
		} else {
			return {
				userId: 999,
				name: "Zebra",
				username: "zebra",
				employeeId: "ZEBRA001",
			};
		}
	}

	const rows = await sql`
    SELECT s.user_id, s.expires_at, u.name, u.username, u.employee_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
  `;

	if (rows.length === 0) return null;

	const session = rows[0];
	const expiresAt = new Date(session.expires_at);

	if (expiresAt < new Date()) {
		// Expired — clean up
		await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
		return null;
	}

	return {
		userId: session.user_id,
		name: session.name,
		username: session.username,
		employeeId: session.employee_id,
	};
}

export async function deleteSession(token: string): Promise<void> {
	if (!token) return;
	const tokenHash = sha256(token);
	if (!process.env.DATABASE_URL) {
		devSessions.delete(tokenHash);
		return;
	}
	await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}

// ── Cookie helpers ───────────────────────────────────────────────────

export async function setSessionCookie(token: string): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
	});
}

export async function getSessionToken(): Promise<string | undefined> {
	const cookieStore = await cookies();
	return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function clearSessionCookie(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.delete(SESSION_COOKIE_NAME);
}

// ── Get current user (for server components / API routes) ────────────

export async function getCurrentUser() {
	const token = await getSessionToken();
	if (!token) return null;
	return validateSession(token);
}
