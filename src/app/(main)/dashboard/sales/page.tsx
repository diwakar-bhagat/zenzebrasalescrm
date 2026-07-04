"use client";

import {
	BarChart3,
	Download,
	IndianRupee,
	Percent,
	ShoppingCart,
	Store,
	TrendingDown,
	TrendingUp,
	Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { DataFreshnessSystem } from "@/components/dashboard/data-freshness-system";
import {
	formatStoreName,
	GlobalFilterBar,
} from "@/components/founder/global-filter-bar";
import {
	AovAnalysisTable,
	BillCutAnalysisTable,
	BrandProfitabilityTable,
	CategoryProfitabilityTable,
	CustomerIntelligenceCard,
	DailyHealthTable,
	PaymentAnalysisCard,
	SkuProfitabilityTable,
} from "@/components/founder/sales-dashboard-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToExcel } from "@/lib/export-excel";
import { formatSignedPercent, growthTextClass } from "@/lib/growth-ui";
import { formatCurrency } from "@/lib/utils";
import { useFilterStore } from "@/stores/founder/filter-store";

/** Safely format a number to fixed decimal places; returns "0.0" on null/undefined/NaN. */
function safeFixed(value: number | null | undefined, digits = 1): string {
	const n = Number(value ?? 0);
	return Number.isFinite(n) ? n.toFixed(digits) : "0.0";
}

const CustomTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<div className="bg-popover border border-border p-2 rounded-md shadow-sm text-xs">
				<p className="font-semibold text-foreground">{data.name}</p>
				<p className="text-muted-foreground mt-0.5">Value: {data.display}</p>
			</div>
		);
	}
	return null;
};

const STORE_DISPLAY_NAMES: Record<string, string> = {
	"Klj store": "KLJ Store KPIs",
	"SmartworksNoida Noida": "Smart Works Noida KPIs",
	"Head office": "Head office",
};

const waterfallChartConfig = {
	mrpValue: {
		color: "var(--chart-1)",
		label: "MRP Value",
	},
	discount: {
		color: "var(--chart-5)",
		label: "Discount",
	},
	collection: {
		color: "var(--chart-3)",
		label: "Collection",
	},
	gst: {
		color: "var(--chart-2)",
		label: "GST Liability",
	},
	revenue: {
		color: "var(--chart-4)",
		label: "Net Revenue",
	},
} satisfies ChartConfig;

const EMPTY_STORE_KPI = {
	revenue: 0,
	revenueGrowth: 0,
	billCuts: 0,
	billCutsGrowth: 0,
	units: 0,
	aov: 0,
};

function getStoreKpi(
	storePerformance: Array<{
		billedBy: string;
		revenue: number;
		revenueGrowth: number;
		billCuts: number;
		billCutsGrowth: number;
		units: number;
		aov: number;
	}>,
	billedBy: string,
) {
	return (
		storePerformance.find((s) => s.billedBy === billedBy) ?? EMPTY_STORE_KPI
	);
}

function getMetricGrowth(
	metrics: Array<{ metric: string; growth: number | null }>,
	metric: string,
) {
	return metrics.find((row) => row.metric === metric)?.growth ?? null;
}

function getBusinessImpact({
	aovGrowth,
	billCutsGrowth,
	customerGrowth,
}: {
	aovGrowth: number | null;
	billCutsGrowth: number | null;
	customerGrowth: number | null;
}) {
	const customerDrop = Math.abs(Math.min(customerGrowth ?? 0, 0));
	const billDrop = Math.abs(Math.min(billCutsGrowth ?? 0, 0));
	const aovDrop = Math.abs(Math.min(aovGrowth ?? 0, 0));

	if (customerDrop >= billDrop && customerDrop >= aovDrop && customerDrop > 0) {
		return "Customer visits dropped more than basket size.";
	}

	if (billDrop >= aovDrop && billDrop > 0) {
		return "Bill cuts dropped, so fewer transactions drove the movement.";
	}

	if (aovDrop > 0) {
		return "Basket size dropped more than transaction volume.";
	}

	return "Revenue is stable across volume and basket size.";
}

function getMainCause({
	aovGrowth,
	billCutsGrowth,
	customerGrowth,
}: {
	aovGrowth: number | null;
	billCutsGrowth: number | null;
	customerGrowth: number | null;
}) {
	const causes = [
		{ label: "Customer traffic", value: customerGrowth },
		{ label: "Bill cuts", value: billCutsGrowth },
		{ label: "AOV", value: aovGrowth },
	]
		.filter((item) => item.value != null)
		.sort(
			(a, b) =>
				Math.abs(Math.min(Number(b.value), 0)) -
				Math.abs(Math.min(Number(a.value), 0)),
		);

	const cause = causes[0];
	if (!cause || Number(cause.value) >= 0) return "No single negative driver";
	return `${cause.label} ${formatSignedPercent(cause.value).replace("+", "")}`;
}

function BusinessHealthInvestigation({ data }: { data: any }) {
	const dailyHealth = data.dailyHealth ?? [];
	const revenueGrowth = data.salesKpis?.revenue?.growth ?? null;
	const billCutsGrowth = data.salesKpis?.billCuts?.growth ?? null;
	const unitsGrowth = data.salesKpis?.unitsSold?.growth ?? null;
	const aovGrowth = data.aovKpi?.growth ?? null;
	const customerGrowth = getMetricGrowth(dailyHealth, "Customers");
	const worstStore = [...(data.storePerformance ?? [])].sort(
		(a, b) => Number(a.revenueGrowth ?? 0) - Number(b.revenueGrowth ?? 0),
	)[0];
	const impact = getBusinessImpact({
		aovGrowth,
		billCutsGrowth,
		customerGrowth,
	});
	const mainCause = getMainCause({
		aovGrowth,
		billCutsGrowth,
		customerGrowth,
	});
	const revenueDown = Number(revenueGrowth ?? 0) < 0;

	const drivers = [
		{ label: "Revenue", value: revenueGrowth },
		{ label: "Customers", value: customerGrowth },
		{ label: "Bill Cuts", value: billCutsGrowth },
		{ label: "Units", value: unitsGrowth },
		{ label: "AOV", value: aovGrowth },
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div>
						<CardTitle>Business Health</CardTitle>
						<CardDescription>
							Morning verdict from the current filter context
						</CardDescription>
					</div>
					<Badge
						className={
							revenueDown
								? "border-transparent bg-destructive/10 text-destructive"
								: "border-transparent bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
						}
					>
						Revenue {formatSignedPercent(revenueGrowth)}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
				<div className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-3">
						<div className="rounded-lg border bg-muted/20 p-3">
							<p className="text-muted-foreground text-xs">Reason</p>
							<p className="mt-1 font-semibold">{mainCause}</p>
						</div>
						<div className="rounded-lg border bg-muted/20 p-3">
							<p className="text-muted-foreground text-xs">Impact</p>
							<p className="mt-1 font-semibold">{impact}</p>
						</div>
						<div className="rounded-lg border bg-muted/20 p-3">
							<p className="text-muted-foreground text-xs">Affected</p>
							<p className="mt-1 font-semibold">
								{worstStore
									? `${worstStore.storeDisplayName} (${formatSignedPercent(worstStore.revenueGrowth)})`
									: "No store pressure detected"}
							</p>
						</div>
					</div>

					<div className="rounded-lg border p-4">
						<p className="font-medium text-sm">Why revenue changed</p>
						<div className="mt-4 grid gap-3 md:grid-cols-5">
							{drivers.map((driver, index) => (
								<div className="flex items-center gap-3" key={driver.label}>
									<div className="min-w-0 flex-1 rounded-lg bg-muted/30 p-3">
										<p className="text-muted-foreground text-xs">
											{driver.label}
										</p>
										<p
											className={`mt-1 font-semibold ${growthTextClass(driver.value)}`}
										>
											{formatSignedPercent(driver.value)}
										</p>
									</div>
									{index < drivers.length - 1 && (
										<div className="hidden text-muted-foreground md:block">
											{">"}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="rounded-lg border bg-muted/20 p-4">
					<p className="font-medium text-sm">Action lens</p>
					<p className="mt-2 text-muted-foreground text-sm">
						{revenueDown
							? "Start with the weakest store, then inspect category and SKU movers below. The current signal points to volume before product mix."
							: "Revenue is not under pressure in the selected period. Use the mover tables below to protect the current gains."}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

export default function SalesDashboardPage() {
	const router = useRouter();
	const [data, setData] = useState<any>(null);
	const [status, setStatus] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);

	const {
		startDate,
		endDate,
		store,
		category,
		brand,
		sku,
		categoryScope,
		compareMode,
		compareStartDate,
		compareEndDate,
	} = useFilterStore();

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
		if (!status?.hasData) return;

		const fetchDashboardData = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({ startDate, endDate });
				if (store !== "ALL") params.set("store", store);
				if (category !== "All Categories") params.set("category", category);
				if (brand !== "All Brands") params.set("brand", brand);
				if (sku) params.set("sku", sku);
				if (categoryScope !== "all") params.set("categoryScope", categoryScope);
				params.set("compareMode", compareMode);
				if (compareMode === "custom") {
					params.set("compareStartDate", compareStartDate);
					params.set("compareEndDate", compareEndDate);
				}

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

		fetchDashboardData();
	}, [
		status,
		startDate,
		endDate,
		store,
		category,
		brand,
		sku,
		categoryScope,
		compareMode,
		compareStartDate,
		compareEndDate,
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
					<p className="text-muted-foreground mt-1">
						Sales, inventory cost, and the profit you actually made
					</p>
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
				categoryBrandMap={status.categoryBrandMap || {}}
				skuName={data?.skuName}
			/>

			{isLoading || !data ? (
				<div className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
						{["revenue", "bill-cuts", "units", "aov", "discount"].map((key) => (
							<Skeleton key={key} className="h-32 rounded-xl" />
						))}
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{[1, 2, 3].map((key) => (
							<Skeleton key={key} className="h-44 rounded-xl" />
						))}
					</div>
				</div>
			) : (
				<>
					{/* 1. Daily Business Health (KPIs) */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Revenue
								</CardTitle>
								<IndianRupee className="size-4 text-muted-foreground" />
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
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Discount Given
								</CardTitle>
								<Percent className="size-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatCurrency(data.salesKpis.discount.current)}
								</div>
								<p
									className={`text-xs mt-1 flex items-center ${data.salesKpis.discount.growth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
								>
									{data.salesKpis.discount.growth >= 0 ? (
										<TrendingUp className="mr-1 size-3" />
									) : (
										<TrendingDown className="mr-1 size-3" />
									)}
									{data.salesKpis.discount.growth > 0 ? "+" : ""}
									{safeFixed(data.salesKpis.discount.growth)}% vs prev
								</p>
							</CardContent>
						</Card>
					</div>

					{/* 1.2 Profit Intelligence — the core question: what did we actually make? */}
					{data.profitability && (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Net Sales
									</CardTitle>
									<IndianRupee className="size-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{formatCurrency(data.profitability.netSales)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Taxable revenue (GST removed)
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Net Purchase
									</CardTitle>
									<ShoppingCart className="size-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{data.hasPurchaseData
											? formatCurrency(data.profitability.estimatedCogs)
											: "N/A"}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										{data.hasPurchaseData
											? `Inventory COGS · ${safeFixed(data.profitability.coveragePct)}% cost-matched`
											: "Upload Inventory Pricing & Stock to enable COGS"}
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Gross Profit
									</CardTitle>
									<TrendingUp className="size-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div
										className={`text-2xl font-bold ${data.hasPurchaseData && data.profitability.grossProfit < 0 ? "text-status-delayed" : ""}`}
									>
										{data.hasPurchaseData
											? formatCurrency(data.profitability.grossProfit)
											: "N/A"}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Matched Net Sales − COGS
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Margin %
									</CardTitle>
									<Percent className="size-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{data.profitability.marginPercent == null
											? "N/A"
											: `${safeFixed(data.profitability.marginPercent)}%`}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										{data.profitability.profitPerBill == null
											? "Gross Profit / Net Sales"
											: `${formatCurrency(data.profitability.profitPerBill)} profit / bill`}
									</p>
								</CardContent>
							</Card>
						</div>
					)}

					{/* 1.5 Financial Operations Analysis & Waterfall Chart */}
					<div className="grid gap-4 md:grid-cols-3 mt-4">
						{/* Collection vs Revenue Card */}
						<Card className="flex flex-col">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-semibold text-muted-foreground">
									Collection vs Revenue
								</CardTitle>
							</CardHeader>
							<CardContent className="flex-1 flex flex-col justify-between">
								<div>
									<div className="text-3xl font-bold">
										{formatCurrency(data.salesKpis.collection.current)}
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">
										Gross Collection (GST Inclusive)
									</p>
								</div>
								<div className="mt-4 pt-4 border-t space-y-2 text-sm">
									<div className="flex justify-between items-center">
										<span className="text-muted-foreground text-xs">
											Net Revenue (Taxable)
										</span>
										<span className="font-semibold">
											{formatCurrency(data.salesKpis.revenue.current)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-muted-foreground text-xs">
											GST Liability
										</span>
										<span className="font-medium text-muted-foreground">
											{formatCurrency(data.salesKpis.gst.current)}
										</span>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Discount Impact Card */}
						<Card className="flex flex-col">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-semibold text-muted-foreground">
									Discount Impact
								</CardTitle>
							</CardHeader>
							<CardContent className="flex-1 flex flex-col justify-between">
								<div>
									<div className="text-3xl font-bold">
										{safeFixed(
											data.salesKpis.mrp.current > 0
												? (data.salesKpis.discount.current /
														data.salesKpis.mrp.current) *
														100
												: 0,
											1,
										)}
										%
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">
										Effective Discount Rate on MRP
									</p>
								</div>
								<div className="mt-4 pt-4 border-t space-y-2 text-sm">
									<div className="flex justify-between items-center">
										<span className="text-muted-foreground text-xs">
											Discount Value
										</span>
										<span className="font-semibold">
											{formatCurrency(data.salesKpis.discount.current)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-muted-foreground text-xs">
											Total MRP Value
										</span>
										<span className="font-medium text-muted-foreground">
											{formatCurrency(data.salesKpis.mrp.current)}
										</span>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Deduction Waterfall Card */}
						<Card className="flex flex-col">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-semibold text-muted-foreground">
									Deduction Waterfall
								</CardTitle>
							</CardHeader>
							<CardContent className="flex-1 min-h-[140px] pt-0">
								<ChartContainer
									config={waterfallChartConfig}
									className="h-full w-full"
								>
									<BarChart
										data={[
											{
												name: "MRP Value",
												val: [0, data.salesKpis.mrp.current],
												display: formatCurrency(data.salesKpis.mrp.current),
												fill: "var(--color-mrpValue)",
											},
											{
												name: "Discount",
												val: [
													data.salesKpis.mrp.current -
														data.salesKpis.discount.current,
													data.salesKpis.mrp.current,
												],
												display: `-${formatCurrency(data.salesKpis.discount.current)}`,
												fill: "var(--color-discount)",
											},
											{
												name: "Collection",
												val: [0, data.salesKpis.collection.current],
												display: formatCurrency(
													data.salesKpis.collection.current,
												),
												fill: "var(--color-collection)",
											},
											{
												name: "GST Liability",
												val: [
													data.salesKpis.collection.current -
														data.salesKpis.gst.current,
													data.salesKpis.collection.current,
												],
												display: `-${formatCurrency(data.salesKpis.gst.current)}`,
												fill: "var(--color-gst)",
											},
											{
												name: "Net Revenue",
												val: [0, data.salesKpis.revenue.current],
												display: formatCurrency(data.salesKpis.revenue.current),
												fill: "var(--color-revenue)",
											},
										]}
										margin={{ top: 15, right: 5, left: 5, bottom: 5 }}
									>
										<CartesianGrid
											strokeDasharray="3 3"
											vertical={false}
											opacity={0.15}
										/>
										<XAxis
											dataKey="name"
											tick={{ fontSize: 9 }}
											tickLine={false}
											axisLine={false}
										/>
										<ChartTooltip content={<CustomTooltip />} />
										<Bar dataKey="val">
											{[
												"var(--color-mrpValue)",
												"var(--color-discount)",
												"var(--color-collection)",
												"var(--color-gst)",
												"var(--color-revenue)",
											].map((color) => (
												<Cell key={color} fill={color} />
											))}
										</Bar>
									</BarChart>
								</ChartContainer>
							</CardContent>
						</Card>
					</div>

					{/* Revenue Driver Section */}
					{data.revenueDriver && (
						<div
							className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
								data.revenueDriver.revenueStatus === "Up"
									? "bg-status-on-track-bg border-status-on-track/20"
									: data.revenueDriver.revenueStatus === "Down"
										? "bg-status-delayed-bg border-status-delayed/20"
										: "bg-muted/50 border-border"
							}`}
						>
							<div className="flex items-center gap-4 flex-1 min-w-0">
								<div className="p-3 bg-background rounded-full shrink-0 shadow-sm">
									{data.revenueDriver.revenueStatus === "Up" ? (
										<TrendingUp className="size-6 text-status-on-track" />
									) : data.revenueDriver.revenueStatus === "Down" ? (
										<TrendingDown className="size-6 text-status-delayed" />
									) : (
										<BarChart3 className="size-6 text-muted-foreground" />
									)}
								</div>
								<div className="flex-1 min-w-0">
									<h3 className="font-semibold text-lg flex items-center gap-2">
										Revenue is {data.revenueDriver.revenueStatus}
										<span className="text-sm font-normal opacity-80">
											({data.revenueDriver.revenueGrowth > 0 ? "+" : ""}
											{safeFixed(data.revenueDriver.revenueGrowth)}%)
										</span>
									</h3>
									<p className="text-sm opacity-90 font-medium mt-1">
										{data.revenueDriver.explanation ??
											data.revenueDriver.primaryDriver}
									</p>
								</div>
							</div>
							{data.skuName && (
								<div className="shrink-0 border-l pl-4 border-border flex flex-col justify-center min-h-[44px]">
									<p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
										Filtered SKU
									</p>
									<p className="font-bold text-sm text-foreground mt-0.5 max-w-[200px] truncate">
										{data.skuName}
									</p>
									<p className="font-mono text-xs text-muted-foreground">
										{sku}
									</p>
								</div>
							)}
						</div>
					)}

					{/* Store KPI Split cards */}
					{data.storePerformance && (
						<div className="grid gap-4 md:grid-cols-2 mt-4">
							{data.storePerformance.map((storeKpi: any) => {
								const storeName = storeKpi.billedBy;
								const displayName =
									STORE_DISPLAY_NAMES[storeName] ??
									`${formatStoreName(storeName)} KPIs`;

								return (
									<Card key={storeName} className="border-border bg-card/40">
										<CardHeader className="pb-3">
											<CardTitle className="text-sm font-semibold flex items-center justify-between">
												<span>{displayName}</span>
												<span className="text-xs font-normal text-muted-foreground">
													Store Performance
												</span>
											</CardTitle>
										</CardHeader>
										<CardContent className="grid grid-cols-2 gap-3">
											<div className="bg-muted/30 p-3 rounded-lg border">
												<p className="text-xs text-muted-foreground">Revenue</p>
												<p className="text-lg font-bold mt-1">
													{formatCurrency(storeKpi.revenue)}
												</p>
												<p
													className={`text-xs mt-0.5 flex items-center ${storeKpi.revenueGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
												>
													{storeKpi.revenueGrowth >= 0 ? (
														<TrendingUp className="mr-1 size-3" />
													) : (
														<TrendingDown className="mr-1 size-3" />
													)}
													{storeKpi.revenueGrowth > 0 ? "+" : ""}
													{safeFixed(storeKpi.revenueGrowth)}% vs prev
												</p>
											</div>
											<div className="bg-muted/30 p-3 rounded-lg border">
												<p className="text-xs text-muted-foreground">
													Bill Cuts
												</p>
												<p className="text-lg font-bold mt-1">
													{storeKpi.billCuts.toLocaleString()}
												</p>
												<p
													className={`text-xs mt-0.5 flex items-center ${storeKpi.billCutsGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
												>
													{storeKpi.billCutsGrowth >= 0 ? (
														<TrendingUp className="mr-1 size-3" />
													) : (
														<TrendingDown className="mr-1 size-3" />
													)}
													{storeKpi.billCutsGrowth > 0 ? "+" : ""}
													{safeFixed(storeKpi.billCutsGrowth)}% vs prev
												</p>
											</div>
											<div className="bg-muted/30 p-3 rounded-lg border">
												<p className="text-xs text-muted-foreground">AOV</p>
												<p className="text-lg font-bold mt-1">
													{formatCurrency(storeKpi.aov)}
												</p>
											</div>
											<div className="bg-muted/30 p-3 rounded-lg border">
												<p className="text-xs text-muted-foreground">
													Units Sold
												</p>
												<p className="text-lg font-bold mt-1">
													{storeKpi.units.toLocaleString()}
												</p>
											</div>
											<div className="bg-muted/30 p-3 rounded-lg border">
												<p className="text-xs text-muted-foreground">
													Net Purchase
												</p>
												<p className="text-lg font-bold mt-1">
													{storeKpi.hasPurchase
														? formatCurrency(storeKpi.netPurchase)
														: "N/A"}
												</p>
											</div>
											<div className="bg-muted/30 p-3 rounded-lg border">
												<p className="text-xs text-muted-foreground">
													Gross Profit
												</p>
												<p
													className={`text-lg font-bold mt-1 ${storeKpi.hasPurchase && storeKpi.grossProfit < 0 ? "text-status-delayed" : ""}`}
												>
													{storeKpi.hasPurchase
														? formatCurrency(storeKpi.grossProfit)
														: "N/A"}
												</p>
											</div>
											<div className="bg-muted/30 p-3 rounded-lg border">
												<p className="text-xs text-muted-foreground">Margin</p>
												<p className="text-lg font-bold mt-1">
													{storeKpi.marginPercent == null
														? "N/A"
														: `${safeFixed(storeKpi.marginPercent)}%`}
												</p>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}

					{/* Store Comparison */}
					{data.storePerformance && data.storePerformance.length > 0 && (
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
								<div>
									<CardTitle>Store Comparison</CardTitle>
									<CardDescription>
										<span>Which store is carrying the business?</span>
										{data.periods?.label && (
											<span className="block text-xs text-muted-foreground/80 mt-0.5">
												Compared: {data.periods.label}
											</span>
										)}
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										className="h-8 gap-1.5 text-xs shadow-sm hover:bg-accent"
										onClick={() => {
											const exportData = data.storePerformance.map(
												(row: any) => ({
													Store: row.storeDisplayName,
													"Net Sales": row.netSales ?? row.revenue,
													"Net Purchase": row.netPurchase,
													"Gross Profit": row.grossProfit,
													"Margin (%)": row.marginPercent,
													"Growth (%)": row.revenueGrowth,
													"Contribution (%)": row.contributionPercent,
													"Bill Cuts": row.billCuts,
													AOV: row.aov,
												}),
											);
											exportToExcel(exportData, "Store_Comparison", "Stores");
										}}
									>
										<Download className="h-3.5 w-3.5" />
										Export Excel
									</Button>
									<Store className="size-5 text-muted-foreground" />
								</div>
							</CardHeader>
							<CardContent>
								<div className="overflow-x-auto">
									<table className="w-full text-sm text-left">
										<thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
											<tr>
												<th className="px-4 py-3 font-medium">Store</th>
												<th className="px-4 py-3 font-medium text-right">
													Net Sales
												</th>
												<th className="px-4 py-3 font-medium text-right">
													Net Purchase
												</th>
												<th className="px-4 py-3 font-medium text-right">
													Gross Profit
												</th>
												<th className="px-4 py-3 font-medium text-right">
													Margin
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
											{data.storePerformance.map(
												(storeRow: {
													billedBy: string;
													storeDisplayName: string;
													revenue: number;
													netSales: number;
													netPurchase: number;
													grossProfit: number;
													marginPercent: number | null;
													hasPurchase: boolean;
													revenueGrowth: number;
													contributionPercent: number;
													billCuts: number;
													aov: number;
												}) => (
													<tr
														key={storeRow.billedBy}
														className="border-b last:border-0 hover:bg-muted/20 transition-colors"
													>
														<td className="px-4 py-3 font-medium">
															{storeRow.storeDisplayName}
														</td>
														<td className="px-4 py-3 text-right font-semibold">
															{formatCurrency(
																storeRow.netSales ?? storeRow.revenue,
															)}
														</td>
														<td className="px-4 py-3 text-right">
															{storeRow.hasPurchase
																? formatCurrency(storeRow.netPurchase)
																: "N/A"}
														</td>
														<td
															className={`px-4 py-3 text-right font-semibold ${storeRow.hasPurchase && storeRow.grossProfit < 0 ? "text-status-delayed" : ""}`}
														>
															{storeRow.hasPurchase
																? formatCurrency(storeRow.grossProfit)
																: "N/A"}
														</td>
														<td className="px-4 py-3 text-right">
															{storeRow.marginPercent == null
																? "N/A"
																: `${safeFixed(storeRow.marginPercent)}%`}
														</td>
														<td
															className={`px-4 py-3 text-right ${storeRow.revenueGrowth >= 0 ? "text-status-on-track" : "text-status-delayed"}`}
														>
															{storeRow.revenueGrowth > 0 ? "+" : ""}
															{safeFixed(storeRow.revenueGrowth)}%
														</td>
														<td className="px-4 py-3 text-right">
															<div className="flex items-center justify-end gap-2">
																<span>
																	{safeFixed(storeRow.contributionPercent)}%
																</span>
																<div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
																	<div
																		className="h-full bg-primary"
																		style={{
																			width: `${storeRow.contributionPercent}%`,
																		}}
																	/>
																</div>
															</div>
														</td>
														<td className="px-4 py-3 text-right">
															{storeRow.billCuts.toLocaleString()}
														</td>
														<td className="px-4 py-3 text-right">
															{formatCurrency(storeRow.aov)}
														</td>
													</tr>
												),
											)}
										</tbody>
									</table>
								</div>
							</CardContent>
						</Card>
					)}

					{data.categoryProfitability && (
						<CategoryProfitabilityTable
							data={data.categoryProfitability}
							comparisonLabel={data.comparisonLabel}
							hasPurchaseData={data.hasPurchaseData}
						/>
					)}

					<div className="grid gap-4 md:grid-cols-2">
						{data.brandProfitability && (
							<BrandProfitabilityTable
								data={data.brandProfitability}
								comparisonLabel={data.comparisonLabel}
								hasPurchaseData={data.hasPurchaseData}
							/>
						)}
						{data.skuProfitability && (
							<SkuProfitabilityTable
								data={data.skuProfitability}
								comparisonLabel={data.comparisonLabel}
								hasPurchaseData={data.hasPurchaseData}
							/>
						)}
						{data.billCutAnalysis && (
							<BillCutAnalysisTable
								data={data.billCutAnalysis}
								comparisonLabel={data.comparisonLabel}
							/>
						)}
						{data.aovAnalysis && (
							<AovAnalysisTable
								data={data.aovAnalysis}
								comparisonLabel={data.comparisonLabel}
							/>
						)}
						{data.customerIntelligence && (
							<CustomerIntelligenceCard
								data={data.customerIntelligence}
								comparisonLabel={data.comparisonLabel}
							/>
						)}
						{data.paymentAnalysis && (
							<PaymentAnalysisCard
								data={data.paymentAnalysis}
								comparisonLabel={data.comparisonLabel}
							/>
						)}
					</div>

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

					<BusinessHealthInvestigation data={data} />

					{data.dailyHealth && (
						<DailyHealthTable
							metrics={data.dailyHealth}
							comparisonLabel={data.comparisonLabel}
						/>
					)}
				</>
			)}
		</div>
	);
}
