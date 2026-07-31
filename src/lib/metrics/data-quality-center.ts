import type { NeonQueryFunction } from "@neondatabase/serverless";

export interface DataQualityIssue {
	id: string;
	category: "Duplicate" | "Missing Data" | "Invalid Value" | "Anomaly";
	severity: "Critical" | "Warning" | "Info";
	title: string;
	description: string;
	affectedCount: number;
}

export interface DataQualityReport {
	timestamp: string;
	trustScore: number; // 0 - 100%
	totalChecks: number;
	passedChecks: number;
	issues: DataQualityIssue[];
}

export async function runDataQualityAudit(
	db: NeonQueryFunction<false, false>,
): Promise<DataQualityReport> {
	const issues: DataQualityIssue[] = [];
	let passedChecks = 0;
	const totalChecks = 10;

	try {
		// Check 1: Negative Revenue
		const negRows =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE net_amount < 0`;
		const negCount = Number(negRows[0]?.count || 0);
		if (negCount > 0) {
			issues.push({
				id: "NEG_REV",
				category: "Invalid Value",
				severity: "Critical",
				title: "Negative Net Revenue Detected",
				description: `${negCount} rows have net_amount < 0 in sales_fact`,
				affectedCount: negCount,
			});
		} else {
			passedChecks++;
		}

		// Check 2: Invalid Date Range
		const futureRows =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE sale_date > CURRENT_DATE + INTERVAL '1 day'`;
		const futureCount = Number(futureRows[0]?.count || 0);
		if (futureCount > 0) {
			issues.push({
				id: "FUTURE_DATE",
				category: "Anomaly",
				severity: "Warning",
				title: "Future Sale Dates Detected",
				description: `${futureCount} rows have sale_date in the future`,
				affectedCount: futureCount,
			});
		} else {
			passedChecks++;
		}

		// Check 3: Missing SKU
		const missingSkuRows =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE sku_code IS NULL OR sku_code = ''`;
		const missingSkuCount = Number(missingSkuRows[0]?.count || 0);
		if (missingSkuCount > 0) {
			issues.push({
				id: "MISSING_SKU",
				category: "Missing Data",
				severity: "Info",
				title: "Missing SKU Codes",
				description: `${missingSkuCount} sales rows are missing SKU codes`,
				affectedCount: missingSkuCount,
			});
		} else {
			passedChecks++;
		}

		// Check 4: Zero Quantity
		const zeroQtyRows =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE quantity <= 0`;
		const zeroQtyCount = Number(zeroQtyRows[0]?.count || 0);
		if (zeroQtyCount > 0) {
			issues.push({
				id: "ZERO_QTY",
				category: "Invalid Value",
				severity: "Warning",
				title: "Zero or Negative Quantity",
				description: `${zeroQtyCount} rows have quantity <= 0`,
				affectedCount: zeroQtyCount,
			});
		} else {
			passedChecks++;
		}

		// Check 5: Duplicate Bills across different stores
		const dupBillRows = await db`
      SELECT COUNT(*)::int as count FROM (
        SELECT bill_no FROM sales_fact GROUP BY bill_no HAVING COUNT(DISTINCT store_id) > 1
      ) sub
    `;
		const dupBillCount = Number(dupBillRows[0]?.count || 0);
		if (dupBillCount > 0) {
			issues.push({
				id: "DUP_BILL_STORE",
				category: "Duplicate",
				severity: "Info",
				title: "Bill Shared Across Stores",
				description: `${dupBillCount} bill numbers exist in multiple store IDs`,
				affectedCount: dupBillCount,
			});
		} else {
			passedChecks++;
		}

		// Check 6: Quarantined Upload Batches
		const errorBatches =
			await db`SELECT COUNT(*)::int as count FROM upload_batches WHERE error_count > 0`;
		const errorBatchCount = Number(errorBatches[0]?.count || 0);
		if (errorBatchCount > 0) {
			issues.push({
				id: "BATCH_ERRORS",
				category: "Anomaly",
				severity: "Warning",
				title: "Batches With Quarantined Rows",
				description: `${errorBatchCount} upload batches contain quarantined error rows`,
				affectedCount: errorBatchCount,
			});
		} else {
			passedChecks++;
		}

		// Check 7: Discount Greater Than MRP (Sanity Check)
		const badDiscRows =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE discount_amount > mrp_amount AND mrp_amount > 0`;
		const badDiscCount = Number(badDiscRows[0]?.count || 0);
		if (badDiscCount > 0) {
			issues.push({
				id: "DISCOUNT_EXCEEDS_MRP",
				category: "Invalid Value",
				severity: "Warning",
				title: "Discount Exceeds MRP",
				description: `${badDiscCount} rows have discount_amount > mrp_amount`,
				affectedCount: badDiscCount,
			});
		} else {
			passedChecks++;
		}

		// Check 8: Missing Category Classification
		const missingCatRows =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE category IS NULL OR category = '' OR category = 'Uncategorized'`;
		const missingCatCount = Number(missingCatRows[0]?.count || 0);
		if (missingCatCount > 0) {
			issues.push({
				id: "UNCATEGORIZED_SALES",
				category: "Missing Data",
				severity: "Info",
				title: "Uncategorized Sales Rows",
				description: `${missingCatCount} rows belong to Uncategorized category`,
				affectedCount: missingCatCount,
			});
		} else {
			passedChecks++;
		}

		// Check 9: Anonymous Customer Ratio
		const anonCustRows =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE customer_mobile IS NULL OR customer_mobile = ''`;
		const anonCustCount = Number(anonCustRows[0]?.count || 0);
		if (anonCustCount > 0) {
			issues.push({
				id: "ANONYMOUS_CUSTOMERS",
				category: "Missing Data",
				severity: "Info",
				title: "Anonymous Customer Purchases",
				description: `${anonCustCount} sales rows lack customer mobile numbers`,
				affectedCount: anonCustCount,
			});
		} else {
			passedChecks++;
		}

		// Check 10: Store Alias Resolution Coverage
		const unmappedStores =
			await db`SELECT COUNT(*)::int as count FROM sales_fact WHERE billed_by = 'Head office'`;
		const unmappedStoreCount = Number(unmappedStores[0]?.count || 0);
		if (unmappedStoreCount > 0) {
			issues.push({
				id: "STORE_ALIAS_DRIFT",
				category: "Anomaly",
				severity: "Info",
				title: "Fallback Head Office Store Mapping",
				description: `${unmappedStoreCount} rows fell back to Head Office store mapping`,
				affectedCount: unmappedStoreCount,
			});
		} else {
			passedChecks++;
		}
	} catch (err) {
		console.error("Data Quality Audit check failed:", err);
	}

	const trustScore = Math.round((passedChecks / totalChecks) * 100);

	return {
		timestamp: new Date().toISOString(),
		trustScore,
		totalChecks,
		passedChecks,
		issues,
	};
}
