import { ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerConcentrationResult } from "@/types/customer-intelligence";

import { money, pct } from "./format";

/**
 * Revenue concentration — Pareto bands (do the top 10/20/30% drive revenue?)
 * and Revenue at Risk (dependence on the top-N highest-value customers).
 */
export function CustomerConcentrationCard({
	concentration,
}: {
	concentration: CustomerConcentrationResult;
}) {
	const risk = concentration.revenueAtRisk;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Revenue Concentration</CardTitle>
				<p className="text-muted-foreground text-sm">
					How dependent is revenue on a few customers?
				</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					{concentration.pareto.map((band) => (
						<div key={band.topPct} className="flex flex-col gap-1">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">
									{band.label} of customers (
									{band.customers.toLocaleString("en-IN")})
								</span>
								<span className="font-semibold tabular-nums">
									{pct(band.revenueSharePct)} of revenue
								</span>
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-foreground/70"
									style={{
										width: `${Math.max(0, Math.min(100, band.revenueSharePct))}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
					<ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
					<div className="flex flex-col">
						<span className="text-xs font-medium text-muted-foreground">
							Revenue at Risk
						</span>
						<span className="text-xl font-bold leading-tight">
							{money(risk.revenue)}{" "}
							<span className="text-sm font-medium text-muted-foreground">
								({pct(risk.revenueSharePct)})
							</span>
						</span>
						<span className="text-xs text-muted-foreground">
							Depends on your top {risk.topCustomerCount} customers
							{risk.topCustomerCount > 0 &&
								` · ${risk.identifiedCount} identified (mobile/name)`}
							.
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
