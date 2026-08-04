/**
 * Canonical ingestion contract.
 *
 * Every adapter (Odoo webhook, Odoo scheduled sync, Excel) produces rows in this shape
 * before anything touches sales_fact. The dashboard reads sales_fact_v and never learns
 * which adapter a row came from — provenance is recorded, not branched on.
 */

/** Which adapter produced a sales_fact row. Stored in sales_fact.source_system. */
export type SourceSystem = "odoo_webhook" | "odoo_sync" | "excel";

/**
 * Outcome recorded for every inbound webhook delivery, in webhook_events.status.
 *
 * PROCESSED / FAILED / RECEIVED are the pre-existing vocabulary and are preserved so historic
 * rows keep their meaning. The remaining three cover deliveries that were turned away before
 * processing — previously these were rejected with no record at all, which is exactly how the
 * integration sat at zero successful deliveries with nothing explaining why.
 */
export type WebhookStatus =
	| "PROCESSED"
	| "FAILED"
	| "RECEIVED"
	| "REJECTED_AUTH"
	| "INVALID_PAYLOAD"
	| "IGNORED";

/** One sales_fact row, fully resolved and ready to upsert. */
export interface CanonicalSaleLine {
	/** YYYY-MM-DD in store-local time (Asia/Kolkata), not UTC. */
	sale_date: string;
	bill_no: string;
	/** Canonical store name, already resolved through store_alias_mapping. */
	billed_by: string;
	/** Raw store name as it arrived from the source, kept for auditing. */
	source_billed_by: string;
	store_id: number | null;
	product_key: string;
	sku_code: string | null;
	item_name: string;
	category: string;
	brand: string;
	quantity: number;
	mrp_amount: number;
	discount_amount: number;
	gross_amount: number;
	tax_amount: number;
	net_amount: number;
	payment_method: string | null;
	customer_mobile: string | null;
	customer_name: string | null;
	/** When the event happened in the source system (Odoo write_date). Drives reflection time. */
	source_event_at: string | null;
}

/** An Odoo pos.order as returned by search_read. Fields are loosely typed by design —
 *  Odoo omits keys and returns many-to-one fields as [id, name] tuples. */
export interface OdooPosOrder {
	id?: number;
	name?: string;
	date_order?: string;
	write_date?: string;
	amount_total?: number;
	amount_tax?: number;
	state?: string;
	config_id?: unknown;
	company_id?: unknown;
	partner_id?: unknown;
	lines?: number[];
	[key: string]: unknown;
}

/** An Odoo pos.order.line as returned by search_read. */
export interface OdooPosOrderLine {
	id?: number;
	order_id?: unknown;
	product_id?: unknown;
	qty?: number;
	price_unit?: number;
	price_subtotal?: number;
	price_subtotal_incl?: number;
	/** Odoo stores this as a PERCENTAGE (0-100), not a currency amount. */
	discount?: number;
	[key: string]: unknown;
}
