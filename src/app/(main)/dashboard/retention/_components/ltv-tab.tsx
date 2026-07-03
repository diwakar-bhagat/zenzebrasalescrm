"use client";

import { Percent, Search, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Tooltip as ChartTooltip,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useLTV } from "@/hooks/useLTV";
import { formatCurrency } from "@/lib/utils";

export function LtvTab({ hasData }: { hasData: boolean }) {
	const [searchQuery, setSearchQuery] = useState("");
	const { data, isLoading } = useLTV(hasData);

	const distribution = data?.distribution || [];
	const topCustomers = data?.topCustomers || [];

	const filteredCustomers = useMemo(() => {
		if (!searchQuery) return topCustomers;
		const query = searchQuery.toLowerCase();
		return topCustomers.filter(
			(c: any) =>
				c.customerName?.toLowerCase().includes(query) ||
				c.customerMobile?.includes(query),
		);
	}, [searchQuery, topCustomers]);

	const summaryStats = useMemo(() => {
		if (topCustomers.length === 0)
			return { avgTopLtv: 0, maxLtv: 0, highValueShare: 0 };
		const avgTopLtv = Math.round(
			topCustomers.reduce((sum: number, c: any) => sum + c.ltv, 0) /
				topCustomers.length,
		);
		const maxLtv = topCustomers[0]?.ltv || 0;
		const loyalCount = topCustomers.filter(
			(c: any) => c.retentionScore >= 75,
		).length;
		const highValueShare = Math.round((loyalCount / topCustomers.length) * 100);

		return { avgTopLtv, maxLtv, highValueShare };
	}, [topCustomers]);

	if (isLoading || !data) {
		return (
			<div className="grid gap-6 grid-cols-1 md:grid-cols-3 mt-2">
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[300px] md:col-span-3 rounded-2xl" />
			</div>
		);
	}

	const getRetentionBadge = (score: number) => {
		if (score >= 75) {
			return (
				<Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-none font-semibold font-mono text-[10px] rounded-sm">
					{score} (VIP)
				</Badge>
			);
		}
		if (score >= 40) {
			return (
				<Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-none font-semibold font-mono text-[10px] rounded-sm">
					{score} (Stable)
				</Badge>
			);
		}
		return (
			<Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-none font-semibold font-mono text-[10px] rounded-sm">
				{score} (At Risk)
			</Badge>
		);
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Top Metrics Row */}
			<div className="grid gap-4 grid-cols-3">
				<MetricCard
					title="Top Customers Average LTV"
					value={formatCurrency(summaryStats.avgTopLtv, { noDecimals: true })}
					comparisonLabel="Cohort size = 50"
					icon={Trophy}
				/>
				<MetricCard
					title="Highest Customer LTV"
					value={formatCurrency(summaryStats.maxLtv, { noDecimals: true })}
					comparisonLabel="Peak account size"
					icon={Users}
				/>
				<MetricCard
					title="Loyal VIP Ratio"
					value={`${summaryStats.highValueShare}%`}
					comparisonLabel="VIP retention scores >= 75"
					icon={Percent}
				/>
			</div>

			<div className="grid gap-6 grid-cols-1 lg:grid-cols-3 items-stretch">
				{/* LTV Distribution Histogram Chart */}
				<Card className="lg:col-span-3">
					<CardHeader>
						<CardTitle className="text-lg">
							Customer Value Distribution
						</CardTitle>
						<CardDescription>
							Histogram representing customer count distribution by LTV tiers
						</CardDescription>
					</CardHeader>
					<CardContent className="h-[260px] pb-4">
						{distribution.length === 0 ? (
							<div className="h-full flex items-center justify-center text-xs text-muted-foreground">
								No customer revenue distribution available.
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={distribution}
									margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
								>
									<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
									<XAxis
										dataKey="range"
										tickLine={false}
										style={{ fontSize: 11 }}
									/>
									<YAxis tickLine={false} style={{ fontSize: 11 }} />
									<ChartTooltip
										formatter={(val) => [`${val} customers`, "Count"]}
									/>
									<Bar
										dataKey="count"
										fill="#3b82f6"
										radius={[4, 4, 0, 0]}
										maxBarSize={60}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</CardContent>
				</Card>

				{/* Top LTV Customers DataTable */}
				<Card className="lg:col-span-3 overflow-hidden">
					<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
						<div className="flex flex-col gap-1">
							<CardTitle className="text-lg">
								Top 50 Lifetime Value Customers
							</CardTitle>
							<CardDescription>
								Enterprise accounts and high-value repeat retail buyers ranking.
							</CardDescription>
						</div>

						{/* Customer Search Bar */}
						<div className="relative w-full sm:w-[250px]">
							<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
							<Input
								placeholder="Search name or mobile..."
								className="pl-9 h-9 text-xs w-full"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto w-full">
							<Table className="min-w-[700px] border-collapse">
								<TableHeader>
									<TableRow className="border-b">
										<TableHead className="font-semibold text-xs py-3 pl-4">
											Rank
										</TableHead>
										<TableHead className="font-semibold text-xs py-3">
											Customer Mobile
										</TableHead>
										<TableHead className="font-semibold text-xs py-3">
											Customer Name
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-right">
											Orders
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-right">
											AOV
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-right">
											Total Spent
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-center">
											Retention Score
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredCustomers.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="h-32 text-center text-muted-foreground text-xs"
											>
												No matching high LTV customers found.
											</TableCell>
										</TableRow>
									) : (
										filteredCustomers.map((cust: any, index: number) => (
											<TableRow key={cust.customerMobile} className="border-b">
												<TableCell className="font-mono text-xs py-3 pl-4 text-muted-foreground">
													#{index + 1}
												</TableCell>
												<TableCell className="font-mono text-xs py-3">
													{cust.customerMobile}
												</TableCell>
												<TableCell className="font-semibold text-xs py-3">
													{cust.customerName}
												</TableCell>
												<TableCell className="font-mono text-xs py-3 text-right tabular-nums">
													{cust.orders.toLocaleString()}
												</TableCell>
												<TableCell className="font-mono text-xs py-3 text-right tabular-nums text-foreground/80">
													{formatCurrency(cust.aov, { noDecimals: true })}
												</TableCell>
												<TableCell className="font-bold font-mono text-xs py-3 text-right tabular-nums text-foreground">
													{formatCurrency(cust.ltv, { noDecimals: true })}
												</TableCell>
												<TableCell className="py-3 text-center">
													{getRetentionBadge(cust.retentionScore)}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

import { MetricCard } from "@/components/ui/metric-card";
