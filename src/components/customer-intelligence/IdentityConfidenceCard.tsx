import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	IdentityConfidenceResult,
	IdentitySource,
} from "@/types/customer-intelligence";

import { pct } from "./format";

const BAR_CLASS: Record<IdentitySource, string> = {
	mobile: "bg-gradient-to-r from-emerald-500/70 to-emerald-500",
	name: "bg-gradient-to-r from-amber-500/70 to-amber-500",
	anonymous: "bg-gradient-to-r from-rose-500/60 to-rose-500",
};

/**
 * Identity Confidence — split of customers/revenue by identity source
 * (Mobile / Name fallback / Anonymous). An operational KPI for data capture.
 */
export function IdentityConfidenceCard({
	identity,
}: {
	identity: IdentityConfidenceResult;
}) {
	return (
		<Card className="transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]">
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-lg">
					Identity Confidence
				</CardTitle>
				<p className="text-muted-foreground text-xs">
					How well do we know our customers?
				</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 pt-0">
				<div className="flex flex-col gap-3">
					{identity.rows.map((row) => (
						<div key={row.source} className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground font-medium">
									{row.label}
								</span>
								<span className="font-semibold tabular-nums">
									{pct(row.customerPct)} cust · {pct(row.revenuePct)} rev
								</span>
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
								<div
									className={`h-full rounded-full transition-all duration-500 ease-out ${BAR_CLASS[row.source]}`}
									style={{
										width: `${Math.max(0, Math.min(100, row.customerPct))}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				{identity.insight && (
					<div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/30 p-3 text-xs leading-relaxed">
						<Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
						<span className="text-muted-foreground">{identity.insight}</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
