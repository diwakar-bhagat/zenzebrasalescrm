"use client";

export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { BarChart3, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GlobalFilterBar } from "@/components/founder/global-filter-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilterStore } from "@/stores/founder/filter-store";

import { KpiCards } from "./_components/kpi-cards";
import { OpportunitiesSection } from "./_components/opportunities-section";
import { PipelineActivity } from "./_components/pipeline-activity";
import { TaskReminders } from "./_components/task-reminders";

export default function Page() {
	const router = useRouter();
	const [data, setData] = useState<any>(null);
	const [status, setStatus] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);

	const { startDate, endDate, store, category, brand, sku, categoryScope } =
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

				const res = await fetch(
					`/api/sales/dashboard-extended?${params.toString()}`,
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
	}, [status, startDate, endDate, store, category, brand, sku, categoryScope]);

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

	return (
		<div className="flex flex-col gap-4 p-4 md:p-8 pt-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="flex flex-col gap-1">
					<h1 className="text-3xl leading-none tracking-tight font-bold">
						CRM Dashboard
					</h1>
					<p className="text-muted-foreground text-sm">{formattedDate}</p>
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

			{isLoading || !data ? (
				<div className="grid gap-6 grid-cols-1 mt-2">
					<Skeleton className="h-[120px] rounded-xl" />
					<Skeleton className="h-[300px] rounded-xl" />
					<Skeleton className="h-[200px] rounded-xl" />
				</div>
			) : (
				<div className="flex flex-col gap-4 md:gap-6">
					<KpiCards data={data} />
					<PipelineActivity data={data} />
					<TaskReminders data={data} />
					<OpportunitiesSection data={data} />
				</div>
			)}
		</div>
	);
}
