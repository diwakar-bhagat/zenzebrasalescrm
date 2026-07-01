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

export function grossProfit(netSales: number, netPurchase: number): number {
	return toNumber(netSales) - toNumber(netPurchase);
}

/**
 * Margin percent. Returns null when it cannot be meaningfully computed:
 *  - net sales is zero (division by zero)
 *  - there is no purchase data at all (netPurchase === 0 && !hasPurchase)
 */
export function marginPercent(
	netSales: number,
	netPurchase: number,
	hasPurchase = true,
): number | null {
	const sales = toNumber(netSales);
	if (sales <= 0) return null;
	if (!hasPurchase) return null;
	const profit = grossProfit(sales, netPurchase);
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
	netSales: number;
	netPurchase: number;
	grossProfit: number;
	marginPercent: number | null;
	hasPurchase: boolean;
}

export function buildProfitability(
	netSales: unknown,
	netPurchase: unknown,
	hasPurchase = true,
): ProfitabilityBlock {
	const sales = toNumber(netSales);
	const purchase = toNumber(netPurchase);
	const has = hasPurchase && purchase > 0;
	return {
		netSales: sales,
		netPurchase: purchase,
		grossProfit: grossProfit(sales, purchase),
		marginPercent: marginPercent(sales, purchase, has),
		hasPurchase: has,
	};
}
