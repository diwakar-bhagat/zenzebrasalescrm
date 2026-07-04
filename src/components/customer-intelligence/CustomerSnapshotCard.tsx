import { Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { CustomerSnapshot } from "@/types/customer-intelligence";

import { money, pct } from "./format";

/** One stat in the identity card. */
function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: string;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className={`text-lg font-bold leading-none ${tone ?? ""}`}>
				{value}
			</span>
		</div>
	);
}

/**
 * Customer Snapshot — the 5-second identity card of the business. Observe layer:
 * everything a founder needs to gauge customer health at a glance.
 */
export function CustomerSnapshotCard({
	snapshot,
}: {
	snapshot: CustomerSnapshot;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-4 pt-2">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Customers</span>
						<span className="text-3xl font-bold leading-none">
							{snapshot.customers.toLocaleString("en-IN")}
						</span>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex flex-col items-end">
							<span className="text-muted-foreground text-xs">Health</span>
							<span className="text-2xl font-bold leading-none">
								{snapshot.health.score}
								<span className="text-muted-foreground text-sm font-medium">
									/100
								</span>
							</span>
						</div>
						<div className="flex gap-0.5">
							{[1, 2, 3, 4, 5].map((i) => (
								<Star
									key={i}
									className={`size-4 ${
										i <= snapshot.health.stars
											? "fill-amber-400 text-amber-400"
											: "text-muted-foreground/30"
									}`}
								/>
							))}
						</div>
					</div>
				</div>

				<div className="grid grid-cols-3 gap-3 border-t border-border pt-3 sm:grid-cols-4 xl:grid-cols-7">
					<Stat
						label="Repeat rev"
						value={pct(snapshot.repeatRevenuePct)}
						tone="text-emerald-600 dark:text-emerald-400"
					/>
					<Stat label="New rev" value={pct(snapshot.newRevenuePct)} />
					<Stat label="Retention" value={pct(snapshot.month1RetentionPct)} />
					<Stat
						label="Anonymous"
						value={pct(snapshot.anonymousRevenuePct)}
						tone={
							snapshot.anonymousRevenuePct >= 25
								? "text-amber-600 dark:text-amber-400"
								: undefined
						}
					/>
					<Stat label="LTV" value={money(snapshot.ltv)} />
					<Stat label="AOV" value={money(snapshot.aov)} />
					<Stat
						label="Rev at risk"
						value={pct(snapshot.revenueAtRiskPct)}
						tone={
							snapshot.revenueAtRiskPct >= 25
								? "text-amber-600 dark:text-amber-400"
								: undefined
						}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
