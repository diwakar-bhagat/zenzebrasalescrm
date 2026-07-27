import { Star } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	QualityBand,
	RevenueQualityScore,
} from "@/types/customer-intelligence";

import { money, pct } from "./format";

const BAND_CLASS: Record<QualityBand, string> = {
	Excellent: "text-emerald-600 dark:text-emerald-400",
	Healthy: "text-emerald-600 dark:text-emerald-400",
	Watch: "text-amber-600 dark:text-amber-400",
	Weak: "text-rose-600 dark:text-rose-400",
};

/**
 * Customer Health card — one-glance Revenue Quality Score (0–100) with a star
 * rating, band, factor breakdown, and the metrics that drive it.
 */
export function CustomerHealthCard({
	quality,
}: {
	quality: RevenueQualityScore;
}) {
	const bandClass = BAND_CLASS[quality.band];

	return (
		<Card className="transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]">
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-lg">Customer Health</CardTitle>
				<p className="text-muted-foreground text-xs">Revenue Quality Score</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 pt-0">
				<div className="flex items-end justify-between">
					<div className="flex flex-col">
						<span className="text-4xl font-bold leading-none tracking-tight">
							{quality.score}
							<span className="text-muted-foreground text-lg font-medium">
								/100
							</span>
						</span>
						<span
							className={`mt-1.5 text-xs font-semibold tracking-wide uppercase ${bandClass}`}
						>
							{quality.band}
						</span>
					</div>
					<div className="flex gap-0.5">
						{[1, 2, 3, 4, 5].map((i) => (
							<Star
								key={i}
								className={`size-4.5 transition-transform duration-300 hover:scale-110 ${
									i <= quality.stars
										? "fill-amber-400 text-amber-400"
										: "text-muted-foreground/30"
								}`}
							/>
						))}
					</div>
				</div>

				<p className="text-muted-foreground text-sm leading-relaxed">
					{quality.headline}
				</p>

				<div className="flex flex-col gap-3 py-1">
					{quality.factors.map((f) => (
						<div key={f.key} className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground font-medium">
									{f.label}
								</span>
								<span className="font-semibold tabular-nums">
									{Math.round(f.score)}
									<span className="text-muted-foreground font-normal">
										{" "}
										× {Math.round(f.weight * 100)}%
									</span>
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
								<div
									className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500 ease-out"
									style={{ width: `${Math.max(0, Math.min(100, f.score))}%` }}
								/>
							</div>
						</div>
					))}
				</div>

				<dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/80 pt-3.5 text-xs leading-5">
					<dt className="text-muted-foreground">Repeat revenue</dt>
					<dd className="text-right font-semibold tabular-nums">
						{pct(quality.metrics.repeatRevenuePct)}
					</dd>
					<dt className="text-muted-foreground">Month-1 retention</dt>
					<dd className="text-right font-semibold tabular-nums">
						{pct(quality.metrics.month1RetentionPct)}
					</dd>
					<dt className="text-muted-foreground">Anonymous revenue</dt>
					<dd className="text-right font-semibold tabular-nums">
						{pct(quality.metrics.anonymousRevenuePct)}
					</dd>
					<dt className="text-muted-foreground">Avg LTV</dt>
					<dd className="text-right font-semibold tabular-nums">
						{money(quality.metrics.ltv)}
					</dd>
					<dt className="text-muted-foreground">AOV</dt>
					<dd className="text-right font-semibold tabular-nums">
						{money(quality.metrics.aov)}
					</dd>
				</dl>
			</CardContent>
		</Card>
	);
}
