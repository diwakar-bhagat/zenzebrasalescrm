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
		<Card className="transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]">
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-lg">
					Revenue Concentration
				</CardTitle>
				<p className="text-muted-foreground text-xs">
					How dependent is revenue on a few customers?
				</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 pt-0">
				<div className="flex flex-col gap-3 py-1">
					{concentration.pareto.map((band) => (
						<div key={band.topPct} className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground font-medium">
									{band.label} of customers (
									{band.customers.toLocaleString("en-IN")})
								</span>
								<span className="font-semibold tabular-nums">
									{pct(band.revenueSharePct)} of revenue
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
								<div
									className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500 ease-out"
									style={{
										width: `${Math.max(0, Math.min(100, band.revenueSharePct))}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				<div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all duration-200 hover:shadow-sm">
					<ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
					<div className="flex flex-col gap-1">
						<span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
							Revenue at Risk
						</span>
						<span className="text-2xl font-bold leading-none tracking-tight tabular-nums">
							{money(risk.revenue)}{" "}
							<span className="text-sm font-medium text-muted-foreground font-normal">
								({pct(risk.revenueSharePct)})
							</span>
						</span>
						<span className="text-xs text-muted-foreground leading-normal mt-1">
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
