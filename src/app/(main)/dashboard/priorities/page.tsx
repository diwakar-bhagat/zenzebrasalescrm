"use client";

import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { DataFreshnessBadge } from "@/components/dashboard/data-freshness-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
	DecisionGraphResult,
	RootCauseCluster,
} from "@/types/business-signal";

interface PrioritiesData {
	comparisonLabel: string;
	domainsWired: string[];
	graph: DecisionGraphResult;
}

function inr(n: number): string {
	if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
	if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
	if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
	return `₹${Math.round(n)}`;
}

/** Severity → accent colour. */
function sevClass(severity: number): string {
	if (severity >= 75) return "border-rose-500/40 bg-rose-500/5";
	if (severity >= 50) return "border-amber-500/40 bg-amber-500/5";
	return "border-emerald-500/40 bg-emerald-500/5";
}
function sevDot(severity: number): string {
	if (severity >= 75) return "bg-rose-500";
	if (severity >= 50) return "bg-amber-500";
	return "bg-emerald-500";
}

function ClusterCard({
	cluster,
	rank,
}: {
	cluster: RootCauseCluster;
	rank: number;
}) {
	return (
		<div
			className={`flex flex-col gap-3 rounded-xl border p-4 ${sevClass(cluster.severity)}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<span className="text-muted-foreground text-sm font-bold tabular-nums">
						#{rank}
					</span>
					<div className="flex flex-col gap-1">
						<span className="text-base font-semibold leading-tight">
							{cluster.title}
						</span>
						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<span className="rounded bg-muted px-1.5 py-0.5 font-medium">
								Root cause: {cluster.rootCauseLabel}
							</span>
							<span>Owners: {cluster.owners.join(", ")}</span>
						</div>
					</div>
				</div>
				<div className="flex flex-col items-end">
					{cluster.totalImpact > 0 && (
						<span className="text-lg font-bold leading-none">
							{inr(cluster.totalImpact)}
						</span>
					)}
					<span className="text-muted-foreground text-xs">
						sev {cluster.severity} · conf {cluster.confidence}% · urg{" "}
						{cluster.urgency}
					</span>
				</div>
			</div>

			{/* Causal chain — the linked signals behind this root cause */}
			<div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
				{cluster.signals.map((s) => (
					<div key={s.id} className="flex items-start gap-2 text-sm">
						<span
							className={`mt-1.5 size-2 shrink-0 rounded-full ${sevDot(s.severity)}`}
						/>
						<div className="flex flex-col">
							<span className="font-medium">
								<span className="text-muted-foreground text-xs uppercase">
									{s.domain}
								</span>{" "}
								{s.title}
								{s.impactAmount > 0 && (
									<span className="text-muted-foreground">
										{" "}
										· {inr(s.impactAmount)}
									</span>
								)}
							</span>
							{s.suggestedActions[0] && (
								<span className="flex items-center gap-1 text-muted-foreground text-xs">
									<ChevronRight className="size-3" />
									{s.suggestedActions[0].label} — {s.owner}
								</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default function Page() {
	const [data, setData] = useState<PrioritiesData | null>(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		fetch("/api/founder-priorities")
			.then((r) => r.json())
			.then((j) => {
				if (j.success) setData(j.data);
			})
			.catch(() => {})
			.finally(() => setLoaded(true));
	}, []);

	const clusters = data?.graph.clusters ?? [];

	return (
		<div className="flex flex-col gap-4 p-4 pt-4 md:p-8">
			<div className="flex flex-col gap-2">
				<div className="flex flex-col gap-1">
					<h1 className="text-3xl font-bold leading-none tracking-tight">
						Today's Priorities
					</h1>
					<p className="text-muted-foreground text-sm">
						The top problems across the business, merged to root cause and
						ranked by impact.
					</p>
				</div>
				<DataFreshnessBadge />
			</div>

			{!loaded ? (
				<div className="flex flex-col gap-3">
					<Skeleton className="h-[120px] rounded-xl" />
					<Skeleton className="h-[120px] rounded-xl" />
				</div>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>
							Root Causes{" "}
							<span className="text-muted-foreground text-sm font-normal">
								({clusters.length} from {data?.graph.signalCount ?? 0} signals ·{" "}
								{data?.domainsWired.join(", ")})
							</span>
						</CardTitle>
						<p className="text-muted-foreground text-sm">
							{data?.comparisonLabel}
						</p>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						{clusters.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No pressing problems detected across wired domains — the
								business is on track.
							</p>
						) : (
							clusters.map((c, i) => (
								<ClusterCard key={c.id} cluster={c} rank={i + 1} />
							))
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
