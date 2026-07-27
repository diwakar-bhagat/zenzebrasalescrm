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
			"border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400",
	},
	warning: {
		icon: TriangleAlert,
		className:
			"border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400",
	},
	positive: {
		icon: CheckCircle2,
		className:
			"border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
	},
	neutral: {
		icon: Info,
		className: "border-border/80 bg-muted/20 text-foreground",
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
		<Card className="transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]">
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-lg">What This Means</CardTitle>
				<p className="text-muted-foreground text-xs">
					Automated diagnosis across retention, revenue mix, and concentration.
				</p>
			</CardHeader>
			<CardContent className="pt-0">
				{insights.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No notable customer signals in this range — metrics are within
						normal bounds.
					</p>
				) : (
					<div className="flex flex-col gap-2.5">
						{insights.map((insight) => {
							const tone = TONE[insight.tone];
							const Icon = tone.icon;
							return (
								<div
									key={insight.id}
									className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 hover:shadow-sm ${tone.className}`}
								>
									<Icon className="mt-0.5 size-4 shrink-0" />
									<div className="flex flex-col gap-1">
										<span className="text-sm font-semibold leading-none">
											{insight.title}
										</span>
										<span className="text-foreground/80 text-xs leading-relaxed">
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
