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
		<Card>
			<CardHeader>
				<CardTitle>Customer Health</CardTitle>
				<p className="text-muted-foreground text-sm">Revenue Quality Score</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex items-end justify-between">
					<div className="flex flex-col">
						<span className="text-4xl font-bold leading-none">
							{quality.score}
							<span className="text-muted-foreground text-lg font-medium">
								/100
							</span>
						</span>
						<span className={`mt-1 text-sm font-semibold ${bandClass}`}>
							{quality.band}
						</span>
					</div>
					<div className="flex gap-0.5">
						{[1, 2, 3, 4, 5].map((i) => (
							<Star
								key={i}
								className={`size-5 ${
									i <= quality.stars
										? "fill-amber-400 text-amber-400"
										: "text-muted-foreground/30"
								}`}
							/>
						))}
					</div>
				</div>

				<p className="text-muted-foreground text-sm">{quality.headline}</p>

				{quality.reasons.length > 0 && (
					<div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 p-3">
						<span className="text-muted-foreground text-xs font-medium">
							Why?
						</span>
						{quality.reasons.map((r) => (
							<div key={r.text} className="flex items-start gap-2 text-xs">
								<span
									className={`font-bold ${
										r.sign === "+"
											? "text-emerald-600 dark:text-emerald-400"
											: "text-rose-600 dark:text-rose-400"
									}`}
								>
									{r.sign}
								</span>
								<span>{r.text}</span>
							</div>
						))}
					</div>
				)}

				<div className="flex flex-col gap-2">
					{quality.factors.map((f) => (
						<div key={f.key} className="flex flex-col gap-1">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">{f.label}</span>
								<span className="font-medium tabular-nums">
									{Math.round(f.score)}
									<span className="text-muted-foreground">
										{" "}
										× {Math.round(f.weight * 100)}%
									</span>
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-foreground/70"
									style={{ width: `${Math.max(0, Math.min(100, f.score))}%` }}
								/>
							</div>
						</div>
					))}
				</div>

				<dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
					<dt className="text-muted-foreground">Repeat revenue</dt>
					<dd className="text-right font-medium">
						{pct(quality.metrics.repeatRevenuePct)}
					</dd>
					<dt className="text-muted-foreground">Month-1 retention</dt>
					<dd className="text-right font-medium">
						{pct(quality.metrics.month1RetentionPct)}
					</dd>
					<dt className="text-muted-foreground">Anonymous revenue</dt>
					<dd className="text-right font-medium">
						{pct(quality.metrics.anonymousRevenuePct)}
					</dd>
					<dt className="text-muted-foreground">Avg LTV</dt>
					<dd className="text-right font-medium">
						{money(quality.metrics.ltv)}
					</dd>
					<dt className="text-muted-foreground">AOV</dt>
					<dd className="text-right font-medium">
						{money(quality.metrics.aov)}
					</dd>
				</dl>
			</CardContent>
		</Card>
	);
}
