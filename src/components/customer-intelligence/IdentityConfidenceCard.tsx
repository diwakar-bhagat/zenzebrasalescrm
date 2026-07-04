import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	IdentityConfidenceResult,
	IdentitySource,
} from "@/types/customer-intelligence";

import { pct } from "./format";

const BAR_CLASS: Record<IdentitySource, string> = {
	mobile: "bg-emerald-500/70",
	name: "bg-amber-500/70",
	anonymous: "bg-rose-500/60",
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
		<Card>
			<CardHeader>
				<CardTitle>Identity Confidence</CardTitle>
				<p className="text-muted-foreground text-sm">
					How well do we know our customers?
				</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-3">
					{identity.rows.map((row) => (
						<div key={row.source} className="flex flex-col gap-1">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">{row.label}</span>
								<span className="font-medium tabular-nums">
									{pct(row.customerPct)} cust · {pct(row.revenuePct)} rev
								</span>
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
								<div
									className={`h-full rounded-full ${BAR_CLASS[row.source]}`}
									style={{
										width: `${Math.max(0, Math.min(100, row.customerPct))}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				{identity.insight && (
					<div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
						<Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
						<span>{identity.insight}</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
