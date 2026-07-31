import {
	type OdooInventory,
	upsertInventory,
} from "../../repositories/odoo.repository";
import type { OdooClient } from "../client";

/**
 * Synchronizes current stock levels (stock.quant) from Odoo.
 * Since stock.quant represents current point-in-time stock levels,
 * we fetch the active inventory and upsert it.
 */
export async function syncInventory(client: OdooClient): Promise<number> {
	console.log("[syncInventory] Starting stock levels sync...");

	const fields = ["product_id", "location_id", "quantity", "reserved_quantity"];

	// Filter to check only internal stock locations (e.g. usage = 'internal')
	// To be safe and compatible with all Odoo setups, we query all stock.quant,
	// but restrict to internal locations if we know the domain. For a general POC,
	// checking location_id.usage = 'internal' is standard in Odoo.
	const domain = [["location_id.usage", "=", "internal"]];

	let offset = 0;
	const limit = 100;
	let totalUpserted = 0;
	let hasMore = true;

	while (hasMore) {
		console.log(
			`[syncInventory] Fetching batch (offset: ${offset}, limit: ${limit})...`,
		);

		let records: any[] = [];
		try {
			records = await client.fetchBatch(
				"stock.quant",
				fields,
				domain,
				"id asc",
				limit,
				offset,
			);
		} catch (err: any) {
			console.warn(
				"[syncInventory] Failed to query stock.quant with location filters. Retrying without filters...",
				err.message,
			);
			// Fallback: Query without usage = internal filter in case standard SaaS permissions restrict location queries
			records = await client.fetchBatch(
				"stock.quant",
				fields,
				[],
				"id asc",
				limit,
				offset,
			);
		}

		if (records.length === 0) {
			hasMore = false;
			break;
		}

		console.log(`[syncInventory] Processing ${records.length} records...`);
		const inventoryToUpsert = records
			.map((rec: any) => {
				const productId = Array.isArray(rec.product_id)
					? Number(rec.product_id[0])
					: null;
				const locationId = Array.isArray(rec.location_id)
					? Number(rec.location_id[0])
					: null;
				const locationName = Array.isArray(rec.location_id)
					? String(rec.location_id[1])
					: undefined;

				if (!productId || !locationId) return null;

				return {
					productId,
					locationId,
					locationName,
					quantity: Number(rec.quantity || 0),
					reservedQuantity: Number(rec.reserved_quantity || 0),
				};
			})
			.filter((rec) => rec !== null) as OdooInventory[];

		await upsertInventory(inventoryToUpsert);
		totalUpserted += inventoryToUpsert.length;

		if (records.length < limit) {
			hasMore = false;
		} else {
			offset += limit;
		}
	}

	console.log(
		`[syncInventory] Completed. Total stock.quant levels upserted: ${totalUpserted}`,
	);
	return totalUpserted;
}
