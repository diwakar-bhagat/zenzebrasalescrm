import { createHash } from "node:crypto";

/**
 * Customer Identity Layer.
 *
 * The database has no `customer_identity_key` column. Customer identity is
 * resolved consistently everywhere from `sales_fact_v` rows using this priority:
 *
 *   1. Mobile        -> MOBILE_<digits-only mobile>
 *   2. Normalized name -> NAME_<md5(normalized name)>
 *   3. Anonymous     -> ANON_<bill_no>
 *
 * Anonymous customers are keyed per bill and must NEVER be merged together.
 *
 * These SQL fragments reference `sales_fact_v` columns directly and are meant to
 * be embedded inside a query (e.g. inside a CTE `SELECT`). The TypeScript mirrors
 * (`normalizeName`, `normalizeMobile`, `resolveIdentityKey`) exist so the same
 * rules can be unit-tested without a database.
 */

/** True when the row carries a usable (digit-bearing) mobile number. */
export const MOBILE_PRESENT_SQL = `regexp_replace(COALESCE(customer_mobile, ''), '\\D', '', 'g') <> ''`;

/** True when the row carries a non-blank customer name. */
export const NAME_PRESENT_SQL = `btrim(COALESCE(customer_name, '')) <> ''`;

/** Digits-only mobile expression. */
const MOBILE_DIGITS_SQL = `regexp_replace(customer_mobile, '\\D', '', 'g')`;

/** md5 of the normalized (collapsed-whitespace, trimmed, lowercased) name. */
const NAME_HASH_SQL = `md5(lower(btrim(regexp_replace(customer_name, '\\s+', ' ', 'g'))))`;

/**
 * SQL expression producing the customer identity key for a `sales_fact_v` row.
 * Priority: mobile -> normalized-name hash -> anonymous (per bill).
 */
export const CUSTOMER_IDENTITY_KEY_SQL = `
  CASE
    WHEN ${MOBILE_PRESENT_SQL} THEN 'MOBILE_' || ${MOBILE_DIGITS_SQL}
    WHEN ${NAME_PRESENT_SQL}   THEN 'NAME_' || ${NAME_HASH_SQL}
    ELSE 'ANON_' || bill_no
  END`;

/**
 * SQL predicate: the customer is *identified* (has a mobile or a name).
 * Used to exclude anonymous customers from retention cohorts.
 */
export const IS_IDENTIFIED_SQL = `(${MOBILE_PRESENT_SQL} OR ${NAME_PRESENT_SQL})`;

/** TS mirror: collapse internal whitespace, trim, lowercase. */
export function normalizeName(name: string | null | undefined): string {
	return (name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** TS mirror: strip every non-digit character from a mobile number. */
export function normalizeMobile(mobile: string | null | undefined): string {
	return (mobile ?? "").replace(/\D/g, "");
}

export interface IdentityInput {
	billNo: string;
	customerMobile?: string | null;
	customerName?: string | null;
}

/**
 * TS mirror of {@link CUSTOMER_IDENTITY_KEY_SQL}. Kept in lockstep with the SQL
 * so the resolution can be verified independently of the database.
 */
export function resolveIdentityKey(row: IdentityInput): string {
	const mobile = normalizeMobile(row.customerMobile);
	if (mobile) return `MOBILE_${mobile}`;

	const name = normalizeName(row.customerName);
	if (name) return `NAME_${createHash("md5").update(name).digest("hex")}`;

	return `ANON_${row.billNo}`;
}

/** TS mirror of {@link IS_IDENTIFIED_SQL}. */
export function isIdentified(row: IdentityInput): boolean {
	return (
		normalizeMobile(row.customerMobile) !== "" ||
		normalizeName(row.customerName) !== ""
	);
}
