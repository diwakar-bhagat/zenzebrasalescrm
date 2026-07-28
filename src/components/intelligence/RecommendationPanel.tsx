const TIER_STYLE: Record<string, string> = {
	High: "border-status-on-track/20 bg-status-on-track-bg",
	Moderate: "border-border bg-muted/30",
	Watch: "border-status-delayed/20 bg-status-delayed-bg",
};

/**
 * Renders the deterministic recommendation from
 * src/lib/intelligence/recommendation-rules.ts. Tier is a qualitative signal
 * (High/Moderate/Watch), not a fabricated numeric "expected impact %".
 */
export function RecommendationPanel({
	action,
	reason,
	tier,
}: {
	action: string;
	reason: string;
	tier: string;
}) {
	return (
		<div
			className={`rounded-lg border p-2.5 ${TIER_STYLE[tier] ?? "bg-muted/30"}`}
		>
			<div className="flex items-center justify-between gap-2">
				<p className="text-[11px] font-medium text-muted-foreground">
					Recommended Action
				</p>
				<span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
					{tier}
				</span>
			</div>
			<p className="mt-1 text-sm font-semibold">{action}</p>
			<p className="mt-0.5 text-xs text-muted-foreground">{reason}</p>
		</div>
	);
}
