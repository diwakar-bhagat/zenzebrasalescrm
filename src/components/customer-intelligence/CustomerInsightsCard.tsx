import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	CustomerInsight,
	InsightTone,
} from "@/types/customer-intelligence";

const TONE: Record<InsightTone, { icon: LucideIcon; className: string }> = {
	critical: {
		icon: XCircle,
		className:
			"border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
	},
	warning: {
		icon: TriangleAlert,
		className:
			"border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
	},
	positive: {
		icon: CheckCircle2,
		className:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	},
	neutral: {
		icon: Info,
		className: "border-border bg-muted/20 text-foreground",
	},
};

/**
 * Dynamic insight feed — founder-facing diagnoses generated in the business
 * layer. Presentation only.
 */
export function CustomerInsightsCard({
	insights,
}: {
	insights: CustomerInsight[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>What This Means</CardTitle>
				<p className="text-muted-foreground text-sm">
					Automated diagnosis across retention, revenue mix, and concentration.
				</p>
			</CardHeader>
			<CardContent>
				{insights.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No notable customer signals in this range — metrics are within
						normal bounds.
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{insights.map((insight) => {
							const tone = TONE[insight.tone];
							const Icon = tone.icon;
							return (
								<div
									key={insight.id}
									className={`flex items-start gap-3 rounded-lg border p-3 ${tone.className}`}
								>
									<Icon className="mt-0.5 size-4 shrink-0" />
									<div className="flex flex-col gap-0.5">
										<span className="text-sm font-semibold">
											{insight.title}
										</span>
										<span className="text-foreground/80 text-xs">
											{insight.detail}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
