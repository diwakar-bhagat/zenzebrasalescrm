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
		<Card className="transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]">
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-lg">
					Revenue Composition
				</CardTitle>
				<p className="text-muted-foreground text-xs">
					Where revenue came from · {comparisonLabel}
				</p>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
					{composition.cards.map((card) => {
						const growth = card.revenueGrowthPct;
						const up = growth !== null && growth >= 0;
						return (
							<div
								key={card.key}
								className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/20 p-4 transition-all duration-200 hover:bg-muted/40 hover:shadow-sm"
							>
								<span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
									{card.label}
								</span>
								<span className="text-2xl font-bold leading-none tracking-tight tabular-nums">
									{money(card.revenue)}
								</span>
								<span
									className={`flex items-center text-xs font-medium w-fit px-1.5 py-0.5 rounded ${
										growth === null
											? "text-muted-foreground bg-muted"
											: up
												? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
												: "text-rose-600 dark:text-rose-400 bg-rose-500/10"
									}`}
								>
									{growth !== null &&
										(up ? (
											<TrendingUp className="mr-1 size-3 shrink-0" />
										) : (
											<TrendingDown className="mr-1 size-3 shrink-0" />
										))}
									{growth === null ? "—" : `${signedPct(growth)} vs prev`}
								</span>
								<dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-border/40 pt-2 text-xs leading-4">
									<dt className="text-muted-foreground">Rev %</dt>
									<dd className="text-right font-semibold tabular-nums">
										{pct(card.revenuePct)}
									</dd>
									<dt className="text-muted-foreground">Cust %</dt>
									<dd className="text-right font-semibold tabular-nums">
										{pct(card.customerPct)}
									</dd>
									<dt className="text-muted-foreground">Bills %</dt>
									<dd className="text-right font-semibold tabular-nums">
										{pct(card.billsPct)}
									</dd>
									<dt className="text-muted-foreground">AOV</dt>
									<dd className="text-right font-semibold tabular-nums">
										{money(card.aov)}
									</dd>
								</dl>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
