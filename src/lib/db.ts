import { neon } from "@neondatabase/serverless";

// Define a placeholder SQL executor if the database URL isn't present
// This ensures Next.js can compile pages without breaking on missing DB env vars
const mockSql = async (strings: TemplateStringsArray, ...values: any[]) => {
	console.warn("Neon DB not configured. Missing DATABASE_URL.");
	return [];
};
(mockSql as any).query = mockSql;

export const sql = process.env.DATABASE_URL
	? neon(process.env.DATABASE_URL)
	: mockSql;
