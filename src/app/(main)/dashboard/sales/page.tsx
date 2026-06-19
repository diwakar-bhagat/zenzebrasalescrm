"use client";

import {
	BarChart3,
	DollarSign,
	ShoppingCart,
	Store,
	TrendingDown,
	TrendingUp,
	Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DataFreshnessSystem } from "@/components/dashboard/data-freshness-system";
import { GlobalFilterBar } from "@/components/founder/global-filter-bar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useFilterStore } from "@/stores/founder/filter-store";

/** Safely format a number to fixed decimal places; returns "0.0" on null/undefined/NaN. */
function safeFixed(value: number | null | undefined, digits = 1): string {
	const n = Number(value ?? 0);
	return Number.isFinite(n) ? n.toFixed(digits) : "0.0";
}

export default function SalesDashboardPage() {
	const router = useRouter();
	const [data, setData] = useState<any>(null);
	const [status, setStatus] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [hasInitializedDateRange, setHasInitializedDateRange] = useState(false);

	const { startDate, endDate, store, category, brand, sku, setDateRange } =
		useFilterStore();

	useEffect(() => {
		const fetchStatus = async () => {
			try {
				const res = await fetch("/api/sales/status");
				const json = await res.json();
				if (json.success) {
					setStatus(json.data);
				}
			} catch (err) {
				console.error("Failed to fetch status", err);
			}
		};

		fetchStatus();
	}, []);

	useEffect(() => {
		const fetchDashboardData = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({ startDate, endDate });
				if (store !== "All Stores") params.set("store", store);
				if (category !== "All Categories") params.set("category", category);
				if (brand !== "All Brands") params.set("brand", brand);
				if (sku) params.set("sku", sku);

				const res = await fetch(`/api/sales/dashboard?${params.toString()}`);
				const json = await res.json();
				if (json.success) {
					setData(json.data);
				}
			} catch (err) {
				console.error("Failed to fetch dashboard data", err);
			} finally {
				setIsLoading(false);
			}
		};

		if (status?.hasData && status.maxDate && !hasInitializedDateRange) {
			const end = new Date(`${status.maxDate}T00:00:00.000Z`);
			const start = new Date(end);
			start.setUTCDate(start.getUTCDate() - 29);

			if (status.minDate) {
				const min = new Date(`${status.minDate}T00:00:00.000Z`);
				if (start < min) start.setTime(min.getTime());
			}

			setDateRange(
				start.toISOString().slice(0, 10),
				end.toISOString().slice(0, 10),
			);
			setHasInitializedDateRange(true);
			return;
		}

		if (status?.hasData && hasInitializedDateRange) {
			fetchDashboardData();
		}
	}, [
		status,
		hasInitializedDateRange,
		startDate,
		endDate,
		store,
		category,
		brand,
		sku,
		setDateRange,
	]);

	if (!status) {
		return (
			<div className="p-8">
				<Skeleton className="h-[400px] w-full" />
			</div>
		);
	}

	if (!status.hasData) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center space-y-6">
				<div className="bg-muted/30 p-8 rounded-full">
					<BarChart3 className="size-20 text-muted-foreground" />
				</div>
				<div className="max-w-md space-y-2">
					<h2 className="text-2xl font-bold">Welcome to ZenZebra</h2>
					<p className="text-muted-foreground">
						No data has been uploaded yet. Upload your first daily sales sheet
						to unlock insights.
					</p>
				</div>
				<Button
					size="lg"
					onClick={() => router.push("/dashboard/sales/upload")}
				>
					<Upload className="mr-2 size-5" />
					Upload Sales Data
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-2 p-4 md:p-8 pt-4">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Sales Dashboard</h2>
					<p className="text-muted-foreground mt-1">System of Attention</p>
				</div>
				<div className="flex items-center gap-3">
					<DataFreshnessSystem />
					<Button
						variant="outline"
						onClick={() => router.push("/dashboard/sales/upload")}
					>
						<Upload className="mr-2 size-4" />
						Upload Data
					</Button>
				</div>
			</div>

			<GlobalFilterBar
				availableStores={status.availableStores || []}
				availableCategories={status.availableCategories || []}
				availableBrands={status.availableBrands || []}
				maxDate={status.maxDate}
			/>

			{isLoading || !data ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{["revenue", "bill-cuts", "units", "aov"].map((key) => (
						<Skeleton key={key} className="h-32 rounded-xl" />
					))}
				</div>
			) : (
				<>
					{/* Revenue Driver Section */}
					{data.revenueDriver && (
						<div
							className={`p-4 rounded-xl border flex items-center gap-4 ${
								data.revenueDriver.revenueStatus === "Up"
									? "bg-status-on-track-bg border-status-on-track/20"
									: data.revenueDriver.revenueStatus === "Down"
										? "bg-status-delayed-bg border-status-delayed/20"
										: "bg-muted/50 border-border"
							}`}
						>
							<div className="p-3 bg-background rounded-full shrink-0 shadow-sm">
								{data.revenueDriver.revenueStatus === "Up" ? (
									<TrendingUp className="size-6 text-status-on-track" />
								) : data.revenueDriver.revenueStatus === "Down" ? (
									<TrendingDown className="size-6 text-status-delayed" />
								) : (
									<BarChart3 className="size-6 text-muted-foreground" />
								)}
							</div>
							<div>
								<h3 className="font-semibold text-lg flex items-center gap-2">
									Revenue is {data.revenueDriver.revenueStatus}
									<span className="text-sm font-normal opacity-80">
										({data.revenueDriver.revenueGrowth > 0 ? "+" : ""}
										{safeFixed(data.revenueDriver.revenueGrowth)}%)
									</span>
								</h3>
								<p className="text-sm opacity-90 font-medium mt-1">
									{data.revenueDriver.primaryDriver}
								</p>
							</div>
						</div>
					)}

					{/* 1. Daily Business Health (KPIs) */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Revenue
								</CardTitle>
								<DollarSign className="size-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatCurrency(data.salesKpis.revenue.current)}
								</div>
								<p
									className={`text-xs mt-1 flex items-center ${data.salesKpis.revenue.growth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
								>
									{data.salesKpis.revenue.growth >= 0 ? (
										<TrendingUp className="mr-1 size-3" />
									) : (
										<TrendingDown className="mr-1 size-3" />
									)}
									{data.salesKpis.revenue.growth > 0 ? "+" : ""}
									{safeFixed(data.salesKpis.revenue.growth)}% vs prev
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Bill Cuts</CardTitle>
								<ShoppingCart className="size-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{data.salesKpis.billCuts.current.toLocaleString()}
								</div>
								<p
									className={`text-xs mt-1 flex items-center ${data.salesKpis.billCuts.growth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
								>
									{data.salesKpis.billCuts.growth >= 0 ? (
										<TrendingUp className="mr-1 size-3" />
									) : (
										<TrendingDown className="mr-1 size-3" />
									)}
									{data.salesKpis.billCuts.growth > 0 ? "+" : ""}
									{safeFixed(data.salesKpis.billCuts.growth)}% vs prev
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Units Sold
								</CardTitle>
								<BarChart3 className="size-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{data.salesKpis.unitsSold.current.toLocaleString()}
								</div>
								<p
									className={`text-xs mt-1 flex items-center ${data.salesKpis.unitsSold.growth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
								>
									{data.salesKpis.unitsSold.growth >= 0 ? (
										<TrendingUp className="mr-1 size-3" />
									) : (
										<TrendingDown className="mr-1 size-3" />
									)}
									{data.salesKpis.unitsSold.growth > 0 ? "+" : ""}
									{safeFixed(data.salesKpis.unitsSold.growth)}% vs prev
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Average Order Value
								</CardTitle>
								<TrendingUp className="size-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatCurrency(data.aovKpi.current)}
								</div>
								<p
									className={`text-xs mt-1 flex items-center ${data.aovKpi.growth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
								>
									{data.aovKpi.growth >= 0 ? (
										<TrendingUp className="mr-1 size-3" />
									) : (
										<TrendingDown className="mr-1 size-3" />
									)}
									{data.aovKpi.growth > 0 ? "+" : ""}
									{safeFixed(data.aovKpi.growth)}% vs prev
								</p>
							</CardContent>
						</Card>
					</div>

					{/* Store KPI Split cards */}
					{data.storePerformance && data.storePerformance.length > 0 && (() => {
						const kljStore = data.storePerformance.find((s: any) => s.store.toLowerCase().includes("klj")) || {
							revenue: 0,
							revenueGrowth: 0,
							billCuts: 0,
							billCutsGrowth: 0,
							units: 0,
							aov: 0,
						};
						const smartStore = data.storePerformance.find((s: any) => s.store.toLowerCase().includes("smart") || s.store.toLowerCase().includes("noida")) || {
							revenue: 0,
							revenueGrowth: 0,
							billCuts: 0,
							billCutsGrowth: 0,
							units: 0,
							aov: 0,
						};

						return (
							<div className="grid gap-4 md:grid-cols-2 mt-4">
								{/* KLJ Store KPIs */}
								<Card className="border-border bg-card/40">
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-semibold flex items-center justify-between">
											<span>KLJ Store KPIs</span>
											<span className="text-xs font-normal text-muted-foreground">Store Performance</span>
										</CardTitle>
									</CardHeader>
									<CardContent className="grid grid-cols-2 gap-3">
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">Revenue</p>
											<p className="text-lg font-bold mt-1">{formatCurrency(kljStore.revenue)}</p>
											<p className={`text-xs mt-0.5 flex items-center ${kljStore.revenueGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}>
												{kljStore.revenueGrowth >= 0 ? (
													<TrendingUp className="mr-1 size-3" />
												) : (
													<TrendingDown className="mr-1 size-3" />
												)}
												{kljStore.revenueGrowth > 0 ? "+" : ""}{safeFixed(kljStore.revenueGrowth)}% vs prev
											</p>
										</div>
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">Bill Cuts</p>
											<p className="text-lg font-bold mt-1">{kljStore.billCuts.toLocaleString()}</p>
											<p className={`text-xs mt-0.5 flex items-center ${kljStore.billCutsGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}>
												{kljStore.billCutsGrowth >= 0 ? (
													<TrendingUp className="mr-1 size-3" />
												) : (
													<TrendingDown className="mr-1 size-3" />
												)}
												{kljStore.billCutsGrowth > 0 ? "+" : ""}{safeFixed(kljStore.billCutsGrowth)}% vs prev
											</p>
										</div>
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">AOV</p>
											<p className="text-lg font-bold mt-1">{formatCurrency(kljStore.aov)}</p>
										</div>
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">Units Sold</p>
											<p className="text-lg font-bold mt-1">{kljStore.units.toLocaleString()}</p>
										</div>
									</CardContent>
								</Card>

								{/* Smart Works Noida KPIs */}
								<Card className="border-border bg-card/40">
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-semibold flex items-center justify-between">
											<span>Smart Works Noida KPIs</span>
											<span className="text-xs font-normal text-muted-foreground">Store Performance</span>
										</CardTitle>
									</CardHeader>
									<CardContent className="grid grid-cols-2 gap-3">
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">Revenue</p>
											<p className="text-lg font-bold mt-1">{formatCurrency(smartStore.revenue)}</p>
											<p className={`text-xs mt-0.5 flex items-center ${smartStore.revenueGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}>
												{smartStore.revenueGrowth >= 0 ? (
													<TrendingUp className="mr-1 size-3" />
												) : (
													<TrendingDown className="mr-1 size-3" />
												)}
												{smartStore.revenueGrowth > 0 ? "+" : ""}{safeFixed(smartStore.revenueGrowth)}% vs prev
											</p>
										</div>
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">Bill Cuts</p>
											<p className="text-lg font-bold mt-1">{smartStore.billCuts.toLocaleString()}</p>
											<p className={`text-xs mt-0.5 flex items-center ${smartStore.billCutsGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}>
												{smartStore.billCutsGrowth >= 0 ? (
													<TrendingUp className="mr-1 size-3" />
												) : (
													<TrendingDown className="mr-1 size-3" />
												)}
												{smartStore.billCutsGrowth > 0 ? "+" : ""}{safeFixed(smartStore.billCutsGrowth)}% vs prev
											</p>
										</div>
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">AOV</p>
											<p className="text-lg font-bold mt-1">{formatCurrency(smartStore.aov)}</p>
										</div>
										<div className="bg-muted/30 p-3 rounded-lg border">
											<p className="text-xs text-muted-foreground">Units Sold</p>
											<p className="text-lg font-bold mt-1">{smartStore.units.toLocaleString()}</p>
										</div>
									</CardContent>
								</Card>
							</div>
						);
					})()}

					{/* Store Comparison */}
					{data.storePerformance && data.storePerformance.length > 0 && (
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<div>
									<CardTitle>Store Comparison</CardTitle>
									<CardDescription>
										Which store is carrying the business?
									</CardDescription>
								</div>
								<Store className="size-5 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="overflow-x-auto">
									<table className="w-full text-sm text-left">
										<thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
											<tr>
												<th className="px-4 py-3 font-medium">Store</th>
												<th className="px-4 py-3 font-medium text-right">
													Revenue
												</th>
												<th className="px-4 py-3 font-medium text-right">
													Growth
												</th>
												<th className="px-4 py-3 font-medium text-right">
													Contribution
												</th>
												<th className="px-4 py-3 font-medium text-right">
													Bill Cuts
												</th>
												<th className="px-4 py-3 font-medium text-right">
													AOV
												</th>
											</tr>
										</thead>
										<tbody>
											{data.storePerformance.map((store: any) => (
												<tr
													key={store.store}
													className="border-b last:border-0 hover:bg-muted/20 transition-colors"
												>
													<td className="px-4 py-3 font-medium">
														{store.store}
													</td>
													<td className="px-4 py-3 text-right font-semibold">
														{formatCurrency(store.revenue)}
													</td>
													<td
														className={`px-4 py-3 text-right ${store.revenueGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
													>
														{store.revenueGrowth > 0 ? "+" : ""}
														{safeFixed(store.revenueGrowth)}%
													</td>
													<td className="px-4 py-3 text-right">
														<div className="flex items-center justify-end gap-2">
															<span>
																{safeFixed(store.contributionPercent)}%
															</span>
															<div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
																<div
																	className="h-full bg-primary"
																	style={{
																		width: `${store.contributionPercent}%`,
																	}}
																/>
															</div>
														</div>
													</td>
													<td className="px-4 py-3 text-right">
														{store.billCuts.toLocaleString()}
													</td>
													<td className="px-4 py-3 text-right">
														{formatCurrency(store.aov)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</CardContent>
						</Card>
					)}

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{/* Sales Coverage Calendar */}
						<Card className="lg:col-span-1">
							<CardHeader>
								<CardTitle>Sales Coverage Calendar</CardTitle>
								<CardDescription>
									Data coverage between min and max sale dates
								</CardDescription>
							</CardHeader>
							<CardContent className="flex justify-center pb-6">
								<Calendar
									mode="range"
									selected={{
										from: status?.minDate
											? new Date(status.minDate)
											: undefined,
										to: status?.maxDate ? new Date(status.maxDate) : undefined,
									}}
									defaultMonth={
										status?.maxDate ? new Date(status.maxDate) : new Date()
									}
									className="rounded-md border shadow-sm pointer-events-none"
								/>
							</CardContent>
						</Card>
					</div>
				</>
			)}
		</div>
	);
}
