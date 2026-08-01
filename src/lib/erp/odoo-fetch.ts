import type { OdooClient } from "@/lib/odoo-client";
import { relationId } from "./normalize-odoo-order";
import type { OdooPosOrder, OdooPosOrderLine } from "./types";

/**
 * Shared Odoo read helpers used by both the webhook (hydrating a single record) and the
 * scheduled sync (paginating many). Keeping the field lists in one place stops the two paths
 * from drifting into fetching different data for the same order.
 */

export const POS_ORDER_FIELDS = [
	"id",
	"name",
	"date_order",
	"amount_total",
	"amount_tax",
	"state",
	"config_id",
	"company_id",
	"partner_id",
	"lines",
	"write_date",
];

export const POS_ORDER_LINE_FIELDS = [
	"id",
	"order_id",
	"product_id",
	"qty",
	"price_unit",
	"price_subtotal",
	"price_subtotal_incl",
	"discount",
];

/** Odoo rejects very large `in` domains; chunk id lists before querying. */
const ID_CHUNK = 500;

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size)
		out.push(items.slice(i, i + size));
	return out;
}

/**
 * Resolves product category and internal reference for a set of product ids.
 *
 * pos.order.line carries no category, but categoryScope ("retail" excludes LIVE MENU,
 * SNACK CORNER and BEVERAGES) is a first-class filter in this product. Without this lookup
 * every ERP row would land in a single synthetic category and that filter would be meaningless.
 */
async function fetchProductMeta(
	client: OdooClient,
	productIds: number[],
): Promise<Map<number, { category: string; sku: string | null }>> {
	const meta = new Map<number, { category: string; sku: string | null }>();
	if (productIds.length === 0) return meta;

	for (const ids of chunk([...new Set(productIds)], ID_CHUNK)) {
		const products = await client.searchRead(
			"product.product",
			[["id", "in", ids]],
			["id", "categ_id", "default_code"],
			{ limit: ids.length },
		);
		for (const product of products) {
			const categ = product.categ_id;
			meta.set(Number(product.id), {
				category:
					Array.isArray(categ) && typeof categ[1] === "string"
						? categ[1]
						: "POS General",
				sku:
					typeof product.default_code === "string"
						? product.default_code
						: null,
			});
		}
	}

	return meta;
}

/**
 * Dereferences the line ids on a set of orders and enriches each line with its product's
 * category and internal reference. Returns a map of order id -> lines.
 */
export async function fetchOrderLines(
	client: OdooClient,
	orders: OdooPosOrder[],
): Promise<Map<number, OdooPosOrderLine[]>> {
	const lineIds = orders.flatMap((o) =>
		Array.isArray(o.lines) ? o.lines : [],
	);
	const byOrder = new Map<number, OdooPosOrderLine[]>();
	if (lineIds.length === 0) return byOrder;

	const allLines: OdooPosOrderLine[] = [];
	for (const ids of chunk(lineIds, ID_CHUNK)) {
		const lines = await client.searchRead(
			"pos.order.line",
			[["id", "in", ids]],
			POS_ORDER_LINE_FIELDS,
			{ limit: ids.length },
		);
		allLines.push(...lines);
	}

	const productMeta = await fetchProductMeta(
		client,
		allLines
			.map((l) => relationId(l.product_id))
			.filter((id): id is number => id !== null),
	);

	for (const line of allLines) {
		const orderId = relationId(line.order_id);
		if (orderId === null) continue;

		const productId = relationId(line.product_id);
		const meta = productId !== null ? productMeta.get(productId) : undefined;
		// The normalizer reads these enrichment keys; see normalize-odoo-order.ts.
		line.categ_id = meta?.category ?? "POS General";
		line.default_code = meta?.sku ?? null;

		const bucket = byOrder.get(orderId);
		if (bucket) bucket.push(line);
		else byOrder.set(orderId, [line]);
	}

	return byOrder;
}

/**
 * Fetches one pos.order by id, with lines.
 *
 * Odoo 19's native "Send Webhook Notification" action posts only {"_model", "_id"}, so the
 * webhook route must read the record back before it can ingest anything meaningful.
 */
export async function fetchOrderById(
	client: OdooClient,
	orderId: number,
): Promise<{ order: OdooPosOrder; lines: OdooPosOrderLine[] } | null> {
	const orders = await client.searchRead(
		"pos.order",
		[["id", "=", orderId]],
		POS_ORDER_FIELDS,
		{ limit: 1 },
	);
	if (orders.length === 0) return null;

	const order = orders[0] as OdooPosOrder;
	const lines = await fetchOrderLines(client, [order]);
	return { order, lines: lines.get(orderId) ?? [] };
}
