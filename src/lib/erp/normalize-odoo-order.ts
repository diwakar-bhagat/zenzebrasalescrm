import { resolveStore } from "./store-resolver";
import type { CanonicalSaleLine, OdooPosOrder, OdooPosOrderLine } from "./types";

/**
 * The single Odoo -> canonical mapper.
 *
 * Before this existed the same pos.order was mapped three different ways (the primary webhook
 * route, the /sales webhook route and the backfill script), which disagreed on category, brand,
 * payment_method, product_key and whether customer_mobile was written at all. The same order
 * arriving by two paths produced two different rows. Everything now goes through here.
 */

/** Stores operate in IST. Odoo returns naive UTC timestamps. */
const STORE_TIMEZONE = "Asia/Kolkata";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: STORE_TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/**
 * Converts an Odoo timestamp ("YYYY-MM-DD HH:MM:SS", UTC and naive) to a store-local
 * calendar date. Taking the UTC date directly — as the previous code did — files any sale
 * transacted after 18:30 UTC under the wrong day.
 */
export function odooTimestampToStoreDate(raw: string | undefined | null): string {
	if (!raw) return dateFormatter.format(new Date());

	const trimmed = String(raw).trim();
	// Odoo omits the timezone designator; append Z so it is parsed as UTC rather than local.
	const isoish = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
	const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(isoish) ? isoish : `${isoish}Z`;

	const parsed = new Date(withZone);
	if (Number.isNaN(parsed.getTime())) {
		// Unparseable: fall back to the leading date portion rather than throwing.
		return trimmed.split(" ")[0].split("T")[0];
	}
	return dateFormatter.format(parsed);
}

/** Converts an Odoo naive-UTC timestamp to a real ISO instant, or null. */
export function odooTimestampToIso(raw: string | undefined | null): string | null {
	if (!raw) return null;
	const trimmed = String(raw).trim();
	const isoish = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
	const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(isoish) ? isoish : `${isoish}Z`;
	const parsed = new Date(withZone);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Odoo many-to-one fields arrive as [id, "Display Name"]. Pull the name. */
export function relationName(value: unknown, fallback: string): string {
	if (Array.isArray(value) && value.length > 1 && typeof value[1] === "string") {
		return value[1];
	}
	if (typeof value === "string" && value.trim().length > 0) return value;
	return fallback;
}

/** Odoo many-to-one fields arrive as [id, "Display Name"]. Pull the id. */
export function relationId(value: unknown): number | null {
	if (Array.isArray(value) && value.length > 0 && typeof value[0] === "number") {
		return value[0];
	}
	if (typeof value === "number") return value;
	return null;
}

function toNumber(value: unknown, fallback = 0): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

/**
 * True when a payload carries enough detail to ingest without calling back to Odoo.
 *
 * Odoo 19's native "Send Webhook Notification" action posts only {"_model", "_id"}. Treating
 * that as a complete order — which the previous handler did — invents a zero-amount sale.
 * Callers use this to decide whether to hydrate the record over JSON-RPC first.
 */
export function isHydratedOrder(payload: OdooPosOrder): boolean {
	const hasLines = Array.isArray(payload.lines) && payload.lines.length > 0;
	const hasInlineLines = Array.isArray((payload as { line_details?: unknown }).line_details);
	const hasAmounts =
		payload.amount_total !== undefined && payload.amount_total !== null;
	return Boolean(payload.date_order) && (hasLines || hasInlineLines || hasAmounts);
}

/** Extracts the Odoo record id from either a full record or a thin webhook notification. */
export function extractRecordId(payload: Record<string, unknown>): number | null {
	const candidate = payload.id ?? payload._id ?? payload.res_id;
	const n = Number(candidate);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** Extracts the Odoo model name from a thin webhook notification. */
export function extractModel(payload: Record<string, unknown>): string | null {
	const candidate = payload._model ?? payload.model;
	return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

/**
 * Maps one Odoo POS order plus its resolved lines into canonical sales_fact rows.
 *
 * `lines` should already be dereferenced from the order's line ids. When it is empty the order
 * collapses to a single summary row carrying the header totals, so revenue is never lost even
 * if line detail is unavailable.
 */
export async function normalizeOdooOrder(
	order: OdooPosOrder,
	lines: OdooPosOrderLine[] = [],
): Promise<CanonicalSaleLine[]> {
	const recordId = extractRecordId(order as Record<string, unknown>);
	const bill_no = order.name ?? (recordId ? `POS-${recordId}` : null);
	if (!bill_no) return [];

	const sale_date = odooTimestampToStoreDate(order.date_order);
	// write_date is when Odoo last touched the record: the instant reflection time measures from.
	const source_event_at =
		odooTimestampToIso(order.write_date) ?? odooTimestampToIso(order.date_order);

	const rawStoreName = relationName(
		order.config_id,
		relationName(order.company_id, "Head office"),
	);
	const { canonicalStore, storeId } = await resolveStore(rawStoreName);

	const customer_name = relationName(order.partner_id, "Walk-in Customer");
	const customer_mobile =
		(order.customer_mobile as string) ?? (order.phone as string) ?? (order.mobile as string) ?? null;

	const shared = {
		sale_date,
		bill_no,
		billed_by: canonicalStore,
		source_billed_by: rawStoreName,
		store_id: storeId,
		payment_method: "POS Cash/Card",
		customer_mobile,
		customer_name,
		source_event_at,
	};

	if (lines.length === 0) {
		const net_amount = toNumber(order.amount_total);
		const tax_amount = toNumber(order.amount_tax);
		return [
			{
				...shared,
				product_key: `PROD-SUMMARY-${recordId ?? bill_no}`,
				sku_code: `SKU-${recordId ?? bill_no}`,
				item_name: `POS Order ${bill_no}`,
				category: "POS Summary",
				brand: "Odoo POS",
				quantity: 1,
				mrp_amount: net_amount,
				discount_amount: 0,
				gross_amount: net_amount - tax_amount,
				tax_amount,
				net_amount,
			},
		];
	}

	return lines.map((line, index) => {
		const productId = relationId(line.product_id);
		const productName = relationName(line.product_id, `Item ${index + 1}`);

		const quantity = toNumber(line.qty, 1);
		const priceUnit = toNumber(line.price_unit);
		const mrp_amount = priceUnit * quantity;

		// Odoo's `discount` is a percentage, not an amount. The previous sync wrote the raw
		// percentage into discount_amount, so a 10% discount was recorded as ₹10.
		const discountPercent = toNumber(line.discount);
		const discount_amount = (mrp_amount * discountPercent) / 100;

		const gross_amount = toNumber(line.price_subtotal, mrp_amount - discount_amount);
		const net_amount = toNumber(line.price_subtotal_incl, gross_amount);
		const tax_amount = net_amount - gross_amount;

		return {
			...shared,
			product_key: productId ? `PROD-${productId}` : `PROD-${bill_no}-${index}`,
			sku_code: productId ? `SKU-${productId}` : null,
			item_name: productName,
			category: relationName(line.categ_id, "POS General"),
			brand: "Odoo POS",
			quantity,
			mrp_amount,
			discount_amount,
			gross_amount,
			tax_amount,
			net_amount,
		};
	});
}
