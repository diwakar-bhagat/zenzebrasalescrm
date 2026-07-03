"use client";

import { HelpCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCohorts } from "@/hooks/useCohorts";
import { formatCurrency } from "@/lib/utils";

type CohortMetricType = "retention" | "revenue" | "aov" | "billCuts";

export function CohortsTab({ hasData }: { hasData: boolean }) {
	const [selectedMetric, setSelectedMetric] =
		useState<CohortMetricType>("retention");
	const { data, isLoading } = useCohorts(hasData);

	const limits = useMemo(() => {
		if (!data || data.length === 0)
			return { maxRevenue: 1, maxAov: 1, maxBillCuts: 1 };

		let maxRevenue = 1;
		let maxAov = 1;
		let maxBillCuts = 1;

		for (const cohort of data) {
			for (const m of cohort.months) {
				if (m.revenue > maxRevenue) maxRevenue = m.revenue;
				if (m.aov > maxAov) maxAov = m.aov;
				if (m.billCuts > maxBillCuts) maxBillCuts = m.billCuts;
			}
		}

		return { maxRevenue, maxAov, maxBillCuts };
	}, [data]);

	if (isLoading || !data) {
		return (
			<div className="flex flex-col gap-6 mt-2">
				<Skeleton className="h-[40px] w-[350px] rounded-lg" />
				<Skeleton className="h-[350px] w-full rounded-2xl" />
			</div>
		);
	}

	const renderCell = (cohortCustomers: number, m: any) => {
		if (!m || m.activeCustomers === 0) {
			return (
				<TableCell
					key={m?.monthIndex ?? Math.random()}
					className="text-center text-muted-foreground/30 font-mono text-[11px] p-2 md:p-3 border-r border-border bg-muted/10"
				>
					-
				</TableCell>
			);
		}

		let valueText = "";
		let textStyle = {};

		if (selectedMetric === "retention") {
			const pct = m.retentionPct;
			valueText = `${pct}%`;
			const opacity = Math.min(1, Math.max(0.02, pct / 100));
			textStyle = {
				backgroundColor: `rgba(59, 130, 246, ${opacity * 0.45})`,
				color: opacity > 0.6 ? "var(--foreground)" : "var(--muted-foreground)",
				fontWeight: opacity > 0.5 ? "600" : "500",
			};
		} else if (selectedMetric === "revenue") {
			valueText = formatCurrency(m.revenue, { noDecimals: true });
			const opacity = Math.min(
				1,
				Math.max(0.02, m.revenue / limits.maxRevenue),
			);
			textStyle = {
				backgroundColor: `rgba(16, 185, 129, ${opacity * 0.45})`,
				color: opacity > 0.6 ? "var(--foreground)" : "var(--muted-foreground)",
				fontWeight: opacity > 0.5 ? "600" : "500",
			};
		} else if (selectedMetric === "aov") {
			valueText = formatCurrency(m.aov, { noDecimals: true });
			const opacity = Math.min(1, Math.max(0.02, m.aov / limits.maxAov));
			textStyle = {
				backgroundColor: `rgba(99, 102, 241, ${opacity * 0.45})`,
				color: opacity > 0.6 ? "var(--foreground)" : "var(--muted-foreground)",
				fontWeight: opacity > 0.5 ? "600" : "500",
			};
		} else if (selectedMetric === "billCuts") {
			valueText = `${m.billCuts}x`;
			const opacity = Math.min(
				1,
				Math.max(0.02, m.billCuts / limits.maxBillCuts),
			);
			textStyle = {
				backgroundColor: `rgba(245, 158, 11, ${opacity * 0.45})`,
				color: opacity > 0.6 ? "var(--foreground)" : "var(--muted-foreground)",
				fontWeight: opacity > 0.5 ? "600" : "500",
			};
		}

		return (
			<TableCell
				key={m.monthIndex}
				className="text-center font-mono text-[11px] p-2 md:p-3 border-r border-border transition-all duration-150 hover:brightness-110"
				style={textStyle}
			>
				<span className="block leading-none">{valueText}</span>
				{selectedMetric !== "retention" && (
					<span className="block text-[9px] text-muted-foreground/60 mt-0.5 font-sans">
						({m.activeCustomers} active)
					</span>
				)}
			</TableCell>
		);
	};

	return (
		<div className="flex flex-col gap-6">
			<Card className="overflow-hidden">
				<CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4">
					<div className="flex flex-col gap-1">
						<CardTitle className="text-lg flex items-center gap-2">
							Cohort Heatmap
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<HelpCircle className="size-4 text-muted-foreground cursor-pointer" />
									</TooltipTrigger>
									<TooltipContent className="max-w-xs p-3 space-y-1.5 text-xs">
										<p>
											<strong>Month 0</strong> is the month the customer made
											their first purchase.
										</p>
										<p>
											<strong>Month 1-5</strong> represents subsequent active
											spending in the months following initial acquisition.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</CardTitle>
						<CardDescription>
							Detailed retail cohort grid tracking loyalty behavior over time.
						</CardDescription>
					</div>

					<Tabs
						value={selectedMetric}
						onValueChange={(val) => setSelectedMetric(val as CohortMetricType)}
						className="w-full md:w-auto"
					>
						<TabsList className="grid grid-cols-4 w-full md:w-auto">
							<TabsTrigger value="retention" className="text-xs">
								Retention %
							</TabsTrigger>
							<TabsTrigger value="revenue" className="text-xs">
								Revenue
							</TabsTrigger>
							<TabsTrigger value="aov" className="text-xs">
								AOV
							</TabsTrigger>
							<TabsTrigger value="billCuts" className="text-xs">
								Bill Cuts
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardHeader>
				<CardContent className="p-0">
					<div className="overflow-x-auto w-full">
						<Table className="min-w-[800px] border-collapse">
							<TableHeader>
								<TableRow className="border-b">
									<TableHead className="font-semibold text-xs py-3 pl-4 border-r border-border">
										Cohort Start Month
									</TableHead>
									<TableHead className="font-semibold text-xs py-3 pl-4 text-right border-r border-border">
										Cohort Size
									</TableHead>
									{[
										"Month 0",
										"Month 1",
										"Month 2",
										"Month 3",
										"Month 4",
										"Month 5",
									].map((label) => (
										<TableHead
											key={label}
											className="font-semibold text-xs py-3 text-center border-r border-border"
										>
											{label}
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="h-32 text-center text-muted-foreground"
										>
											No cohort data matches filters in selected period.
										</TableCell>
									</TableRow>
								) : (
									data.map((cohort: any) => (
										<TableRow key={cohort.cohortMonth} className="border-b">
											<TableCell className="font-semibold py-3 pl-4 text-xs whitespace-nowrap border-r border-border">
												{cohort.cohortLabel}
											</TableCell>
											<TableCell className="font-mono text-xs py-3 pl-4 text-right tabular-nums pr-6 border-r border-border">
												{cohort.cohortCustomers.toLocaleString()} customers
											</TableCell>
											{Array.from({ length: 6 }).map((_, idx) => {
												const m = cohort.months.find(
													(month: any) => month.monthIndex === idx,
												);
												return renderCell(
													cohort.cohortCustomers,
													m || { monthIndex: idx, activeCustomers: 0 },
												);
											})}
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-6 grid-cols-1 md:grid-cols-2">
				<Card className="p-5">
					<h3 className="text-sm font-semibold mb-2">
						Understanding the Cohort Grid
					</h3>
					<ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
						<li>
							Each row represents a group of unique customers who placed their
							first order in that month.
						</li>
						<li>
							Columns track their activity at subsequent intervals, e.g.{" "}
							<strong>Month 1</strong> is exactly 1 calendar month later.
						</li>
						<li>
							Higher color intensities indicate stronger repeat purchases and
							retention densities.
						</li>
					</ul>
				</Card>

				<Card className="p-5 flex flex-col justify-between">
					<div>
						<h3 className="text-sm font-semibold mb-2 text-primary">
							Cohort Strategy Tip
						</h3>
						<p className="text-xs text-muted-foreground leading-relaxed">
							If your <strong>AOV Cohort</strong> numbers are increasing over
							time (Month 1 &gt; Month 0), it confirms customers build trust and
							expand their checkouts. If AOV or Bill Cuts are falling, consider
							deploying re-engagement offers.
						</p>
					</div>
				</Card>
			</div>
		</div>
	);
}
