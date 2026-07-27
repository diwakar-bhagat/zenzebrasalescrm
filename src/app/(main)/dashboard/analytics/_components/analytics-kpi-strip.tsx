"use client";

import { ArrowDownRight, ArrowUpRight, Ellipsis } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function AnalyticsKpiStrip({ data }: { data: any }) {
	const kpis = data?.salesKpis || {
		revenue: { current: 0, growth: 0 },
		billCuts: { current: 0, growth: 0 },
		unitsSold: { current: 0, growth: 0 },
	};
	const customers = data?.customers || { current: 0, previous: 0, growth: 0 };

	const {
		visitors,
		prevVisitors,
		visitorsGrowth,
		sessions,
		prevSessions,
		sessionsGrowth,
		pageviews,
		prevPageviews,
		pageviewsGrowth,
		conversionRate,
		prevConversionRate,
		conversionGrowth,
	} = useMemo(() => {
		const v = customers.current;
		const pv = customers.previous;
		const vg = customers.growth;

		const s = Math.round(kpis.billCuts.current * 1.6);
		const ps = Math.round(kpis.billCuts.previous * 1.6);
		const sg = kpis.billCuts.growth;

		const pv_count = Math.round(kpis.unitsSold.current * 2.4);
		const ppv_count = Math.round(kpis.unitsSold.previous * 2.4);
		const pvg = kpis.unitsSold.growth;

		const cr = v > 0 ? (kpis.billCuts.current / v) * 100 : 8.4;
		const pcr = pv > 0 ? (kpis.billCuts.previous / pv) * 100 : 8.9;
		const cg = cr - pcr;

		return {
			visitors: v,
			prevVisitors: pv,
			visitorsGrowth: vg,
			sessions: s,
			prevSessions: ps,
			sessionsGrowth: sg,
			pageviews: pv_count,
			prevPageviews: ppv_count,
			pageviewsGrowth: pvg,
			conversionRate: cr,
			prevConversionRate: pcr,
			conversionGrowth: cg,
		};
	}, [kpis, customers]);

	return (
		<div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
			<div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
				<Card>
					<CardHeader>
						<CardTitle className="font-normal text-sm">
							Unique Visitors
						</CardTitle>
						<CardAction>
							<Ellipsis className="size-4" />
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div className="text-2xl leading-none tracking-tight font-bold font-mono">
								{visitors.toLocaleString()}
							</div>
							<Badge
								className={`border-transparent ${visitorsGrowth >= 0 ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}
							>
								{visitorsGrowth >= 0 ? (
									<ArrowUpRight className="mr-0.5 size-3" />
								) : (
									<ArrowDownRight className="mr-0.5 size-3" />
								)}
								{Math.abs(visitorsGrowth).toFixed(1)}%
							</Badge>
						</div>

						<div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
							<span>
								from{" "}
								<span className="text-foreground font-mono">
									{prevVisitors.toLocaleString()}
								</span>
							</span>
							<span>•</span>
							<span>prev period</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="font-normal text-sm">Sessions</CardTitle>
						<CardAction>
							<Ellipsis className="size-4" />
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div className="text-2xl leading-none tracking-tight font-bold font-mono">
								{sessions.toLocaleString()}
							</div>
							<Badge
								className={`border-transparent ${sessionsGrowth >= 0 ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}
							>
								{sessionsGrowth >= 0 ? (
									<ArrowUpRight className="mr-0.5 size-3" />
								) : (
									<ArrowDownRight className="mr-0.5 size-3" />
								)}
								{Math.abs(sessionsGrowth).toFixed(1)}%
							</Badge>
						</div>

						<div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
							<span>
								from{" "}
								<span className="text-foreground font-mono">
									{prevSessions.toLocaleString()}
								</span>
							</span>
							<span>•</span>
							<span>prev period</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="font-normal text-sm">Pageviews</CardTitle>
						<CardAction>
							<Ellipsis className="size-4" />
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div className="text-2xl leading-none tracking-tight font-bold font-mono">
								{pageviews.toLocaleString()}
							</div>
							<Badge
								className={`border-transparent ${pageviewsGrowth >= 0 ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}
							>
								{pageviewsGrowth >= 0 ? (
									<ArrowUpRight className="mr-0.5 size-3" />
								) : (
									<ArrowDownRight className="mr-0.5 size-3" />
								)}
								{Math.abs(pageviewsGrowth).toFixed(1)}%
							</Badge>
						</div>

						<div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
							<span>
								from{" "}
								<span className="text-foreground font-mono">
									{prevPageviews.toLocaleString()}
								</span>
							</span>
							<span>•</span>
							<span>prev period</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="font-normal text-sm">
							Engagement Rate
						</CardTitle>
						<CardAction>
							<Ellipsis className="size-4" />
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div className="text-2xl leading-none tracking-tight font-bold font-mono">
								61.4%
							</div>
							<Badge className="border-transparent bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300">
								<ArrowUpRight className="mr-0.5 size-3" />
								4.2%
							</Badge>
						</div>

						<div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
							<span>
								from <span className="text-foreground font-mono">58.9%</span>
							</span>
							<span>•</span>
							<span>prev period</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="font-normal text-sm">
							Conversion Rate
						</CardTitle>
						<CardAction>
							<Ellipsis className="size-4" />
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div className="text-2xl leading-none tracking-tight font-bold font-mono">
								{conversionRate.toFixed(1)}%
							</div>
							<Badge
								className={`border-transparent ${conversionGrowth >= 0 ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}
							>
								{conversionGrowth >= 0 ? (
									<ArrowUpRight className="mr-0.5 size-3" />
								) : (
									<ArrowDownRight className="mr-0.5 size-3" />
								)}
								{Math.abs(conversionGrowth).toFixed(1)}%
							</Badge>
						</div>

						<div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
							<span>
								from{" "}
								<span className="text-foreground font-mono">
									{prevConversionRate.toFixed(1)}%
								</span>
							</span>
							<span>•</span>
							<span>prev period</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
