"use client";

import {
	DollarSign,
	Layers,
	Repeat,
	ShoppingBag,
	Sparkles,
	TrendingUp,
	Users,
} from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Tooltip as ChartTooltip,
	Legend,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRetention } from "@/hooks/useRetention";

export function OverviewTab({ hasData }: { hasData: boolean }) {
	const { data, isLoading } = useRetention(hasData);

	if (isLoading || !data) {
		return (
			<div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-2">
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[300px] col-span-full rounded-2xl" />
			</div>
		);
	}

	const overview = data?.overview;
	const trend = data?.trend || [];
	const aiInsights = data?.aiInsights || [];

	return (
		<div className="flex flex-col gap-6">
			{/* KPI Card Grid */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
				<MetricCard
					title="Retention Rate"
					value={`${overview?.retentionRate?.current}%`}
					growth={overview?.retentionRate?.growth}
					comparisonLabel="vs last period"
					icon={Repeat}
				/>
				<MetricCard
					title="Repeat Purchase Rate"
					value={`${overview?.repeatPurchaseRate?.current}%`}
					growth={overview?.repeatPurchaseRate?.growth}
					comparisonLabel="vs last period"
					icon={TrendingUp}
				/>
				<MetricCard
					title="Customer Lifetime Value"
					value={`₹${overview?.ltv?.current}`}
					growth={overview?.ltv?.growth}
					comparisonLabel="vs last period"
					icon={DollarSign}
				/>
				<MetricCard
					title="Customer Acquisition Cost"
					value={`₹${overview?.cac?.current}`}
					growth={overview?.cac?.growth}
					comparisonLabel="vs last period"
					icon={Users}
				/>
				<MetricCard
					title="LTV:CAC Ratio"
					value={`${overview?.ltvCacRatio?.current}x`}
					growth={overview?.ltvCacRatio?.growth}
					comparisonLabel="vs last period"
					icon={Layers}
				/>
				<MetricCard
					title="Average Orders / Customer"
					value={overview?.avgOrdersPerCustomer?.current}
					growth={overview?.avgOrdersPerCustomer?.growth}
					comparisonLabel="vs last period"
					icon={ShoppingBag}
				/>
			</div>

			{/* AI Insights & Trends */}
			<div className="grid gap-6 grid-cols-1 lg:grid-cols-3 items-stretch">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="text-lg">Customer Activity Trends</CardTitle>
						<CardDescription>
							Decomposition of revenue and active customer additions
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs defaultValue="revenue" className="flex flex-col gap-4">
							<TabsList className="w-fit">
								<TabsTrigger value="revenue">Revenue Mix</TabsTrigger>
								<TabsTrigger value="customers">Customer Mix</TabsTrigger>
							</TabsList>
							<TabsContent value="revenue" className="h-[280px]">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart
										data={trend}
										margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
									>
										<defs>
											<linearGradient id="newRev" x1="0" y1="0" x2="0" y2="1">
												<stop
													offset="5%"
													stopColor="#3b82f6"
													stopOpacity={0.4}
												/>
												<stop
													offset="95%"
													stopColor="#3b82f6"
													stopOpacity={0}
												/>
											</linearGradient>
											<linearGradient id="retRev" x1="0" y1="0" x2="0" y2="1">
												<stop
													offset="5%"
													stopColor="#10b981"
													stopOpacity={0.4}
												/>
												<stop
													offset="95%"
													stopColor="#10b981"
													stopOpacity={0}
												/>
											</linearGradient>
										</defs>
										<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
										<XAxis
											dataKey="date"
											tickLine={false}
											style={{ fontSize: 11 }}
										/>
										<YAxis tickLine={false} style={{ fontSize: 11 }} />
										<ChartTooltip />
										<Legend
											verticalAlign="top"
											height={36}
											style={{ fontSize: 12 }}
										/>
										<Area
											type="monotone"
											name="New Customer Revenue"
											dataKey="newRevenue"
											stroke="#3b82f6"
											fillOpacity={1}
											fill="url(#newRev)"
											strokeWidth={2}
										/>
										<Area
											type="monotone"
											name="Returning Customer Revenue"
											dataKey="returningRevenue"
											stroke="#10b981"
											fillOpacity={1}
											fill="url(#retRev)"
											strokeWidth={2}
										/>
									</AreaChart>
								</ResponsiveContainer>
							</TabsContent>
							<TabsContent value="customers" className="h-[280px]">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart
										data={trend}
										margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
									>
										<defs>
											<linearGradient id="newCust" x1="0" y1="0" x2="0" y2="1">
												<stop
													offset="5%"
													stopColor="#3b82f6"
													stopOpacity={0.4}
												/>
												<stop
													offset="95%"
													stopColor="#3b82f6"
													stopOpacity={0}
												/>
											</linearGradient>
											<linearGradient id="retCust" x1="0" y1="0" x2="0" y2="1">
												<stop
													offset="5%"
													stopColor="#10b981"
													stopOpacity={0.4}
												/>
												<stop
													offset="95%"
													stopColor="#10b981"
													stopOpacity={0}
												/>
											</linearGradient>
										</defs>
										<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
										<XAxis
											dataKey="date"
											tickLine={false}
											style={{ fontSize: 11 }}
										/>
										<YAxis tickLine={false} style={{ fontSize: 11 }} />
										<ChartTooltip />
										<Legend
											verticalAlign="top"
											height={36}
											style={{ fontSize: 12 }}
										/>
										<Area
											type="monotone"
											name="New Customers"
											dataKey="newCustomers"
											stroke="#3b82f6"
											fillOpacity={1}
											fill="url(#newCust)"
											strokeWidth={2}
										/>
										<Area
											type="monotone"
											name="Returning Customers"
											dataKey="returningCustomers"
											stroke="#10b981"
											fillOpacity={1}
											fill="url(#retCust)"
											strokeWidth={2}
										/>
									</AreaChart>
								</ResponsiveContainer>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>

				<Card className="flex flex-col justify-between">
					<CardHeader>
						<CardTitle className="text-lg flex items-center gap-2">
							<Sparkles className="size-4 text-amber-500" />
							AI Insights Panel
						</CardTitle>
						<CardDescription>
							Retention patterns and intelligence summaries
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 flex flex-col justify-between gap-4">
						<ul className="space-y-4">
							{aiInsights.map((insight: string) => (
								<li
									key={insight}
									className="flex gap-2 text-sm leading-relaxed"
								>
									<span className="text-blue-500 font-bold">•</span>
									<span className="text-foreground/90">{insight}</span>
								</li>
							))}
						</ul>
						<div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 mt-4 text-xs text-amber-600 dark:text-amber-400">
							<strong>Recommendation:</strong> Consider launching targeted
							retention offers for cohorts where repeat purchase behaviors are
							slipping below standard thresholds.
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
