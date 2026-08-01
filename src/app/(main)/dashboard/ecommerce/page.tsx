"use client";

export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { AlertTriangle, BarChart3, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GlobalFilterBar } from "@/components/founder/global-filter-bar";
import { AovBillCutsAnalysis } from "@/components/store-overview/AovBillCutsAnalysis";
import { DiagnosisCard } from "@/components/store-overview/DiagnosisCard";
import { ForecastCard } from "@/components/store-overview/ForecastCard";
import { StorePerformanceTable } from "@/components/store-overview/StorePerformanceTable";
import { TrendChart } from "@/components/store-overview/TrendChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilterStore } from "@/stores/founder/filter-store";

export default function Page() {
	const router = useRouter();
	const [data, setData] = useState<any>(null);
	const [status, setStatus] = useState<any>(null);
	const [health, setHealth] = useState<any>(null);
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

		const fetchHealth = async () => {
			try {
				const res = await fetch("/api/data-health");
				const json = await res.json();
				if (json.success) {
					setHealth(json.data);
				}
			} catch (err) {
				console.error("Failed to fetch data health", err);
			}
		};

		fetchStatus();
		fetchHealth();
	}, []);

	useEffect(() => {
		if (!status?.hasData) return;

		const fetchDashboardData = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({ startDate, endDate });
				params.set("compareMode", compareMode);
				if (compareMode === "custom") {
					params.set("compareStartDate", compareStartDate);
					params.set("compareEndDate", compareEndDate);
				}
				if (store !== "ALL") params.set("store", store);
				if (category !== "All Categories") params.set("category", category);
				if (brand !== "All Brands") params.set("brand", brand);
				if (sku) params.set("sku", sku);
				if (categoryScope !== "all") params.set("categoryScope", categoryScope);

				const res = await fetch(
					`/api/sales/store-overview?${params.toString()}`,
				);
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
				<Skeleton className="h-[400px] w-full animate-pulse" />
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
						No sales data yet. Once Odoo is connected, transactions appear here
						automatically.
					</p>
				</div>
				<Button
					size="lg"
					variant="outline"
					onClick={() => router.push("/dashboard/sales/upload")}
				>
					<Upload className="mr-2 size-5" />
					Import historical data
				</Button>
			</div>
		);
	}

	const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

	if (isLoading || !data) {
		return (
			<div className="flex flex-col gap-4 p-4 md:p-8 pt-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="flex flex-col gap-2">
						<div className="flex flex-col gap-1">
							<h1 className="text-3xl leading-none tracking-tight font-bold">
								Store Command Center
							</h1>
							<p className="text-muted-foreground text-sm">{formattedDate}</p>
						</div>
						<Skeleton className="h-6 w-[280px] rounded-md" />
					</div>
					<div className="flex items-center gap-3">
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
					availableCategories={status.availableCategories || []}
					availableBrands={status.availableBrands || []}
				/>

				<div className="grid gap-4 grid-cols-12 mt-2">
					<Skeleton className="h-[380px] col-span-12 xl:col-span-8 rounded-xl" />
					<Skeleton className="h-[380px] col-span-12 xl:col-span-4 rounded-xl" />
					<Skeleton className="h-[320px] col-span-12 xl:col-span-8 rounded-xl" />
					<Skeleton className="h-[320px] col-span-12 xl:col-span-4 rounded-xl" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 p-4 md:p-8 pt-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="flex flex-col gap-2">
					<div className="flex flex-col gap-1">
						<h1 className="text-3xl leading-none tracking-tight font-bold">
							Store Command Center
						</h1>
						<p className="text-muted-foreground text-sm">{formattedDate}</p>
					</div>
					{data?.context && (
						<div className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md border border-border bg-muted/30 text-muted-foreground w-fit">
							<span className="font-bold text-foreground">
								{data.context.title.split(" vs ")[0]}
							</span>
							<span className="text-muted-foreground font-normal">
								({data.context.current})
							</span>
							<span className="text-muted-foreground/60 font-normal px-0.5">
								Compared with
							</span>
							<span className="font-semibold text-foreground">
								{data.context.title.split(" vs ")[1]}
							</span>
							<span className="text-muted-foreground font-normal">
								({data.context.previous})
							</span>
						</div>
					)}
				</div>

				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						onClick={() => router.push("/dashboard/sales/upload")}
					>
						<Upload className="mr-2 size-4" />
						Upload Data
					</Button>
				</div>
			</div>

			{health && !health.isHealthy && (
				<div className="flex flex-col gap-2 p-4 mb-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
					<div className="flex items-center gap-2 font-bold">
						<AlertTriangle className="size-4 shrink-0" />
						Database Integrity Warnings Detected
					</div>
					<ul className="list-disc list-inside pl-1 space-y-1 text-xs">
						{health.invalidStoresCount > 0 && (
							<li>
								<strong>Invalid Stores:</strong> Detected{" "}
								{health.invalidStoresCount} rows from unauthorized stores (
								{health.invalidStores.map((s: any) => s.name).join(", ")}).
							</li>
						)}
						{health.duplicateBillsCount > 0 && (
							<li>
								<strong>Duplicate Bills:</strong> Detected{" "}
								{health.duplicateBillsCount} duplicate invoice conflicts (same
								bill number across different stores on the same date).
							</li>
						)}
						{health.missingDatesCount > 0 && (
							<li>
								<strong>Data Gaps:</strong> Missing sales data for{" "}
								{health.missingDatesCount} dates in active range (
								{health.missingDates.slice(0, 5).join(", ")}...).
							</li>
						)}
					</ul>
				</div>
			)}

			<GlobalFilterBar
				availableCategories={status.availableCategories || []}
				availableBrands={status.availableBrands || []}
			/>

			<div className="grid grid-cols-12 gap-4 mt-2">
				{/* Section 1 — Store Performance Overview (8 cols) */}
				<div className="col-span-12 xl:col-span-8">
					<StorePerformanceTable
						stores={data.stores}
						comparisonLabel={data.comparisonLabel}
						hasPurchaseData={data.hasPurchaseData}
					/>
				</div>

				{/* Section 2 — Expected Month End Closing Forecast (4 cols) */}
				<div className="col-span-12 xl:col-span-4">
					<ForecastCard stores={data.stores} />
				</div>

				{/* Section 3 — AOV & Bill Cuts Intelligence Console (12 cols) */}
				<div className="col-span-12">
					<AovBillCutsAnalysis stores={data.stores} />
				</div>

				{/* Section 4 — Revenue Momentum Trend (8 cols) */}
				<div className="col-span-12 xl:col-span-8">
					<TrendChart trends={data.trends} />
				</div>

				{/* Section 5 — Store Diagnosis Engine (4 cols) */}
				<div className="col-span-12 xl:col-span-4">
					<DiagnosisCard stores={data.stores} />
				</div>
			</div>
		</div>
	);
}
