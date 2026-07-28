"use client";

import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Confidence score + the reasons behind it — never just a bare number.
 * Shared by RootCauseCard and every KPI's explanation popover so there's one
 * confidence renderer, not one per card.
 */
export function ConfidenceBadge({
	confidence,
	factors,
}: {
	confidence: number;
	factors: string[];
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button type="button">
					<Badge variant="outline" className="cursor-help">
						Confidence {confidence}%
					</Badge>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-72 text-xs">
				<p className="mb-1.5 font-medium text-foreground">Why {confidence}%?</p>
				{factors.length === 0 ? (
					<div className="space-y-1 text-muted-foreground">
						<p>✓ Adequate sample size</p>
						<p>✓ All stores comparable</p>
						<p>✓ No conflicting signals</p>
					</div>
				) : (
					<div className="space-y-1 text-muted-foreground">
						{factors.map((factor) => (
							<p key={factor}>⚠ {factor}</p>
						))}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
