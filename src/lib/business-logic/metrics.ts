export const METRICS = {
	revenue: "SUM(net_amount)",
	collection: "SUM(gross_amount)",
	gst: "SUM(tax_amount)",
	discount: "SUM(discount_amount)",
	bills: "COUNT(DISTINCT bill_no)",
	mrp: "SUM(mrp_amount)",
} as const;
