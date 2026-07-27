"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function OverviewKpis({ data }: { data: any }) {
	const currentRevenue = data?.salesKpis?.revenue?.current || 0;
	const prevRevenue = data?.salesKpis?.revenue?.previous || 0;
	const growth = data?.salesKpis?.revenue?.growth || 0;

	const { netWorth, prevNetWorth, cash, prevCash, spend, prevSpend } =
		useMemo(() => {
			return {
				netWorth: currentRevenue * 1.3,
				prevNetWorth: prevRevenue * 1.3,
				cash: currentRevenue * 0.45,
				prevCash: prevRevenue * 0.45,
				spend: currentRevenue * 0.35,
				prevSpend: prevRevenue * 0.35,
			};
		}, [currentRevenue, prevRevenue]);

	return (
		<div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
			<div className="grid grid-cols-1 xl:grid-cols-8">
				<Card className="gap-5 overflow-hidden rounded-none border-0 border-foreground/10 border-b ring-0 xl:col-span-4 xl:border-r">
					<CardHeader>
						<CardTitle className="font-normal">Total Net Worth</CardTitle>
					</CardHeader>
					<CardContent className="flex items-end justify-between">
						<div className="space-y-1">
							<div className="text-3xl leading-none tracking-tight font-bold font-mono">
								{formatCurrency(netWorth)}
							</div>
							<p className="text-muted-foreground text-xs">
								{formatCurrency(Math.abs(netWorth - prevNetWorth))} vs last
								period
							</p>
						</div>
						<Badge
							className={`border-transparent ${growth >= 0 ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}
						>
							{growth >= 0 ? "+" : ""}
							{growth.toFixed(1)}%
						</Badge>
					</CardContent>
				</Card>

				<Card className="gap-5 overflow-hidden rounded-none border-0 border-foreground/10 border-b ring-0 xl:col-span-4">
					<CardHeader>
						<CardTitle className="font-normal">Available Cash</CardTitle>
					</CardHeader>
					<CardContent className="flex items-end justify-between">
						<div className="flex flex-col gap-1">
							<div className="text-3xl leading-none tracking-tight font-bold font-mono">
								{formatCurrency(cash)}
							</div>
							<p className="text-muted-foreground text-xs">
								Derived from 45% sales margin
							</p>
						</div>
						<Badge
							className={`border-transparent ${growth >= 0 ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}
						>
							{growth >= 0 ? "+" : ""}
							{growth.toFixed(1)}%
						</Badge>
					</CardContent>
				</Card>

				<Card className="gap-5 overflow-hidden rounded-none border-0 border-foreground/10 ring-0 xl:col-span-4 xl:border-r">
					<CardHeader>
						<CardTitle className="font-normal">Spending Pool</CardTitle>
					</CardHeader>
					<CardContent className="flex items-end justify-between">
						<div className="flex flex-col gap-1">
							<div className="text-3xl leading-none tracking-tight font-bold font-mono">
								{formatCurrency(spend)}
							</div>
							<p className="text-muted-foreground text-xs">
								Operational & inventory cost (35%)
							</p>
						</div>
						<Badge
							className={`border-transparent ${growth >= 0 ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}
						>
							{growth >= 0 ? "+" : ""}
							{growth.toFixed(1)}%
						</Badge>
					</CardContent>
				</Card>

				<Card className="gap-5 overflow-hidden rounded-none border-0 ring-0 xl:col-span-4">
					<CardHeader>
						<CardTitle className="font-normal">Net Profit Margin</CardTitle>
					</CardHeader>
					<CardContent className="flex items-end justify-between">
						<div className="flex flex-col gap-1">
							<div className="text-3xl leading-none tracking-tight font-bold">
								26%
							</div>
							<p className="text-muted-foreground text-xs">
								Standard operating margin
							</p>
						</div>
						<Badge className="border-transparent bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300">
							+2.4%
						</Badge>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
