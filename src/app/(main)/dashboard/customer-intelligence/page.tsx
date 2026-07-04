"use client";

import { format } from "date-fns";
import { Upload, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerConcentrationCard } from "@/components/customer-intelligence/CustomerConcentrationCard";
import { CustomerHealthCard } from "@/components/customer-intelligence/CustomerHealthCard";
import { CustomerInsightsCard } from "@/components/customer-intelligence/CustomerInsightsCard";
import { CustomerSnapshotCard } from "@/components/customer-intelligence/CustomerSnapshotCard";
import { CustomerValueDistributionTable } from "@/components/customer-intelligence/CustomerValueDistributionTable";
import { FounderPrioritiesCard } from "@/components/customer-intelligence/FounderPrioritiesCard";
import { IdentityConfidenceCard } from "@/components/customer-intelligence/IdentityConfidenceCard";
import { ReconciliationBanner } from "@/components/customer-intelligence/ReconciliationBanner";
import { RetentionCohortTable } from "@/components/customer-intelligence/RetentionCohortTable";
import { RevenueCompositionCards } from "@/components/customer-intelligence/RevenueCompositionCards";
import { DataFreshnessBadge } from "@/components/dashboard/data-freshness-badge";
import { GlobalFilterBar } from "@/components/founder/global-filter-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilterStore } from "@/stores/founder/filter-store";
import type {
	CustomerIntelligenceData,
	CustomerIntelligenceResponse,
} from "@/types/customer-intelligence";

interface StatusData {
	hasData: boolean;
	availableCategories?: string[];
	availableBrands?: string[];
}

export default function Page() {
	const router = useRouter();
	const [data, setData] = useState<CustomerIntelligenceData | null>(null);
	const [status, setStatus] = useState<StatusData | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const {
		startDate,
		endDate,
		isDateFiltered,
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
				if (json.success) setStatus(json.data);
			} catch (err) {
				console.error("Failed to fetch status", err);
			}
		};
		fetchStatus();
	}, []);

	useEffect(() => {
		if (!status?.hasData) return;

		const fetchData = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams();
				if (isDateFiltered) {
					params.set("startDate", startDate);
					params.set("endDate", endDate);
					params.set("compareMode", compareMode);
					if (compareMode === "custom") {
						params.set("compareStartDate", compareStartDate);
						params.set("compareEndDate", compareEndDate);
					}
				}
				if (store !== "ALL") params.set("store", store);
				if (category !== "All Categories") params.set("category", category);
				if (brand !== "All Brands") params.set("brand", brand);
				if (sku) params.set("sku", sku);
				if (categoryScope !== "all") params.set("categoryScope", categoryScope);

				const res = await fetch(
					`/api/customer-intelligence?${params.toString()}`,
				);
				const json: CustomerIntelligenceResponse = await res.json();
				if (json.success && json.data) setData(json.data);
			} catch (err) {
				console.error("Failed to fetch customer intelligence data", err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [
		status,
		startDate,
		endDate,
		isDateFiltered,
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
			<div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 p-4 text-center">
				<div className="rounded-full bg-muted/30 p-8">
					<Users className="size-20 text-muted-foreground" />
				</div>
				<div className="max-w-md space-y-2">
					<h2 className="text-2xl font-bold">Customer Intelligence</h2>
					<p className="text-muted-foreground">
						No data has been uploaded yet. Upload your sales sheets to unlock
						retention, revenue composition, and lifetime value insights.
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

	const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

	return (
		<div className="flex flex-col gap-4 p-4 pt-4 md:p-8">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="flex flex-col gap-2">
					<div className="flex flex-col gap-1">
						<h1 className="text-3xl font-bold leading-none tracking-tight">
							Customer Intelligence
						</h1>
						<p className="text-muted-foreground text-sm">{formattedDate}</p>
					</div>
					<DataFreshnessBadge />
				</div>
				<Button
					variant="outline"
					onClick={() => router.push("/dashboard/sales/upload")}
				>
					<Upload className="mr-2 size-4" />
					Upload Data
				</Button>
			</div>

			<GlobalFilterBar
				availableCategories={status.availableCategories || []}
				availableBrands={status.availableBrands || []}
			/>

			{isLoading || !data ? (
				<div className="mt-2 grid grid-cols-12 gap-4">
					<Skeleton className="col-span-12 h-[360px] rounded-xl xl:col-span-4" />
					<Skeleton className="col-span-12 h-[360px] rounded-xl xl:col-span-8" />
					<Skeleton className="col-span-12 h-[220px] rounded-xl" />
					<Skeleton className="col-span-12 h-[360px] rounded-xl xl:col-span-7" />
					<Skeleton className="col-span-12 h-[360px] rounded-xl xl:col-span-5" />
				</div>
			) : (
				<>
					<ReconciliationBanner report={data.reconciliation} />

					<div className="mt-2 grid grid-cols-12 gap-4">
						{/* Observe — 5-second identity card of the business */}
						<div className="col-span-12">
							<CustomerSnapshotCard snapshot={data.snapshot} />
						</div>

						{/* Act — today's priorities + Understand — health & diagnosis */}
						<div className="col-span-12 xl:col-span-5">
							<FounderPrioritiesCard priorities={data.priorities} />
						</div>
						<div className="col-span-12 xl:col-span-4">
							<CustomerHealthCard quality={data.qualityScore} />
						</div>
						<div className="col-span-12 xl:col-span-3">
							<CustomerInsightsCard insights={data.insights} />
						</div>

						{/* Section 2 — Revenue Composition (full width) */}
						<div className="col-span-12">
							<RevenueCompositionCards
								composition={data.revenueComposition}
								comparisonLabel={data.comparisonLabel}
							/>
						</div>

						{/* Section 1 — Retention Cohort */}
						<div className="col-span-12 xl:col-span-7">
							<RetentionCohortTable cohort={data.retentionCohort} />
						</div>

						{/* Section 3 — Customer Value Distribution */}
						<div className="col-span-12 xl:col-span-5">
							<CustomerValueDistributionTable
								distribution={data.valueDistribution}
							/>
						</div>

						{/* Concentration / Revenue at Risk + Identity confidence */}
						<div className="col-span-12 xl:col-span-6">
							<CustomerConcentrationCard concentration={data.concentration} />
						</div>
						<div className="col-span-12 xl:col-span-6">
							<IdentityConfidenceCard identity={data.identityConfidence} />
						</div>
					</div>
				</>
			)}
		</div>
	);
}
