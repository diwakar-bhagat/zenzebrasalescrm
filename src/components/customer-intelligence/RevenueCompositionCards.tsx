import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueCompositionResult } from "@/types/customer-intelligence";

import { money, pct, signedPct } from "./format";

interface Props {
	composition: RevenueCompositionResult;
	comparisonLabel: string;
}

/**
 * Revenue Composition cards — Total / Repeat / New / Identified / Anonymous.
 * Presentation only; every value is precomputed in the business layer.
 */
export function RevenueCompositionCards({
	composition,
	comparisonLabel,
}: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Revenue Composition</CardTitle>
				<p className="text-muted-foreground text-sm">
					Where revenue came from · {comparisonLabel}
				</p>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
					{composition.cards.map((card) => {
						const growth = card.revenueGrowthPct;
						const up = growth !== null && growth >= 0;
						return (
							<div
								key={card.key}
								className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3"
							>
								<span className="text-muted-foreground text-xs font-medium">
									{card.label}
								</span>
								<span className="text-xl font-bold leading-none">
									{money(card.revenue)}
								</span>
								<span
									className={`flex items-center text-xs ${
										growth === null
											? "text-muted-foreground"
											: up
												? "text-status-on-track"
												: "text-status-delayed"
									}`}
								>
									{growth !== null &&
										(up ? (
											<TrendingUp className="mr-1 size-3" />
										) : (
											<TrendingDown className="mr-1 size-3" />
										))}
									{signedPct(growth)} vs prev
								</span>
								<dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
									<dt className="text-muted-foreground">Rev %</dt>
									<dd className="text-right font-medium">
										{pct(card.revenuePct)}
									</dd>
									<dt className="text-muted-foreground">Cust %</dt>
									<dd className="text-right font-medium">
										{pct(card.customerPct)}
									</dd>
									<dt className="text-muted-foreground">Bills %</dt>
									<dd className="text-right font-medium">
										{pct(card.billsPct)}
									</dd>
									<dt className="text-muted-foreground">AOV</dt>
									<dd className="text-right font-medium">{money(card.aov)}</dd>
								</dl>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
