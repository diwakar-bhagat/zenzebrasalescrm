/**
 * Margin math — the single place profit + margin are computed so the whole
 * Profit Intelligence layer stays consistent with the core financial rule:
 *
 *   Gross Profit = SUM(net_amount)  -  SUM(net_purchase_amount)
 *   Margin %     = Gross Profit / Net Sales * 100
 *
 * Revenue is ALWAYS net_amount (taxable). Never gross_amount / totalAmount.
 */

export function toNumber(value: unknown): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function grossProfit(netSales: number, cogs: number): number {
	return toNumber(netSales) - toNumber(cogs);
}

/**
 * Margin percent. Returns null when it cannot be meaningfully computed:
 *  - net sales is zero (division by zero)
 *  - there is no purchase/cost data at all (cost === 0 && !hasPurchase)
 */
export function marginPercent(
	netSales: number,
	cogs: number,
	hasPurchase = true,
): number | null {
	const sales = toNumber(netSales);
	if (sales <= 0) return null;
	const cost = toNumber(cogs);
	if (!hasPurchase && cost <= 0) return null;
	const profit = grossProfit(sales, cost);
	return Math.round((profit / sales) * 1000) / 10;
}

/** Profit generated per bill; null when bill count is zero. */
export function profitPerBill(profit: number, billCuts: number): number | null {
	const bills = toNumber(billCuts);
	if (bills <= 0) return null;
	return Math.round((toNumber(profit) / bills) * 100) / 100;
}

/** Build a normalized profitability block from the raw sales/purchase sums. */
export interface ProfitabilityBlock {
	/** Total taxable revenue (all lines, matched or not). */
	netSales: number;
	/** Taxable revenue on cost-matched lines only (margin is computed on this). */
	matchedNetSales: number;
	/** purchase_fact net purchase — informational/audit only; NOT the COGS source. */
	netPurchase: number;
	/** Tax-adjusted COGS from product_master (matched lines only). */
	estimatedCogs: number;
	grossProfit: number;
	marginPercent: number | null;
	/** True when product_master cost is available for the scope. */
	hasPurchase: boolean;
	/** Sales lines with no product_master cost match. */
	unmatchedLines: number;
	totalLines: number;
	/** Cost-match coverage: matched lines / total lines × 100. */
	coveragePct: number;
}

export interface ProfitabilityInputs {
	/** Taxable revenue on cost-matched lines (defaults to netSales when omitted). */
	matchedNetSales?: unknown;
	unmatchedLines?: unknown;
	totalLines?: unknown;
}

/**
 * COGS authority is product_master (tax-adjusted). Margin is computed on the
 * cost-matched revenue only — unmatched lines are reported, never silently
 * treated as zero-cost (which would inflate margin). `netPurchase` (purchase_fact)
 * is carried for display/audit but never used to compute profit.
 */
export function buildProfitability(
	netSales: unknown,
	cogs: unknown,
	netPurchase: unknown,
	hasPurchase = true,
	inputs: ProfitabilityInputs = {},
): ProfitabilityBlock {
	const sales = toNumber(netSales);
	const cost = toNumber(cogs);
	const purchase = toNumber(netPurchase);
	const matched =
		inputs.matchedNetSales === undefined
			? sales
			: toNumber(inputs.matchedNetSales);
	const unmatchedLines = toNumber(inputs.unmatchedLines);
	const totalLines = toNumber(inputs.totalLines);
	const has = hasPurchase || cost > 0;
	return {
		netSales: sales,
		matchedNetSales: matched,
		netPurchase: purchase,
		estimatedCogs: cost,
		grossProfit: grossProfit(matched, cost),
		marginPercent: marginPercent(matched, cost, has),
		hasPurchase: has,
		unmatchedLines,
		totalLines,
		coveragePct:
			totalLines > 0
				? Math.round(((totalLines - unmatchedLines) / totalLines) * 1000) / 10
				: 0,
	};
}
