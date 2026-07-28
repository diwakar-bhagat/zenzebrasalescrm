import { ConfidenceBadge } from "./ConfidenceBadge";
import { ContributionList, type ContributionRow } from "./ContributionList";
import { MetricBreakdown, type MetricBreakdownDriver } from "./MetricBreakdown";
import { RecommendationPanel } from "./RecommendationPanel";

export interface KPIExplanationProps {
	reason: string;
	drivers?: MetricBreakdownDriver[];
	contributionSections?: Array<{ title: string; rows: ContributionRow[] }>;
	confidence?: { confidence: number; factors: string[] };
	recommendation?: { action: string; reason: string; tier: string } | null;
}

/**
 * The body of any KPI's explanation popover — composes the shared pieces
 * (MetricBreakdown, ContributionList, ConfidenceBadge, RecommendationPanel)
 * into one consistent layout, parameterized per KPI.
 */
export function KPIExplanation({
	reason,
	drivers,
	contributionSections,
	confidence,
	recommendation,
}: KPIExplanationProps) {
	return (
		<div className="space-y-2.5">
			<p className="text-sm">{reason}</p>

			{drivers && drivers.length > 0 && <MetricBreakdown drivers={drivers} />}

			{contributionSections?.map((section) => (
				<ContributionList
					key={section.title}
					title={section.title}
					rows={section.rows}
				/>
			))}

			{recommendation && (
				<RecommendationPanel
					action={recommendation.action}
					reason={recommendation.reason}
					tier={recommendation.tier}
				/>
			)}

			{confidence && (
				<div className="pt-0.5">
					<ConfidenceBadge
						confidence={confidence.confidence}
						factors={confidence.factors}
					/>
				</div>
			)}
		</div>
	);
}
