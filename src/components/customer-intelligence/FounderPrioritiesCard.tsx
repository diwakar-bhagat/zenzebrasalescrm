import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	FounderPriority,
	PriorityLevel,
} from "@/types/customer-intelligence";

const DOT: Record<PriorityLevel, string> = {
	high: "bg-rose-500",
	medium: "bg-amber-500",
	good: "bg-emerald-500",
};

/**
 * Daily Founder Priorities — the Act layer. Ranked, owned, quantified actions so
 * a founder knows what deserves attention this morning. Presentation only.
 */
export function FounderPrioritiesCard({
	priorities,
}: {
	priorities: FounderPriority[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Today's Priorities</CardTitle>
				<p className="text-muted-foreground text-sm">
					What deserves your attention — ranked by urgency.
				</p>
			</CardHeader>
			<CardContent>
				{priorities.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No pressing customer actions — metrics are within healthy bounds.
					</p>
				) : (
					<ol className="flex flex-col divide-y divide-border">
						{priorities.map((p) => (
							<li
								key={p.id}
								className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
							>
								<span
									className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT[p.level]}`}
								/>
								<div className="flex flex-col gap-0.5">
									<div className="flex flex-wrap items-center gap-x-2">
										<span className="text-sm font-semibold">{p.title}</span>
										{p.metric && (
											<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
												{p.metric}
											</span>
										)}
									</div>
									<span className="text-muted-foreground text-xs">
										{p.detail}
									</span>
									<span className="text-muted-foreground/70 text-xs">
										Owner: {p.owner}
									</span>
								</div>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
