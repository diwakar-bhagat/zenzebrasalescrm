"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface SystemSnapshot {
	freshness: {
		latestSaleDate: string | null;
		lastUploadedAt: string | null;
		dataAgeDays: number | null;
		totalRows: number;
		totalBills: number;
		totalRevenue: number;
	};
	infra: {
		materializedViews: string[];
		mvCustomerIdentityRows: number;
		salesFactIndexes: number;
	};
	latencyMs: { sales: number; store: number; customer: number };
}

function Metric({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: string;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 p-3">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className={`text-lg font-bold ${tone ?? ""}`}>{value}</span>
		</div>
	);
}

/** Latency tone: green < 700ms, amber < 1000ms, red otherwise. */
function latTone(ms: number): string {
	if (ms < 0) return "text-rose-600 dark:text-rose-400";
	if (ms > 1000) return "text-rose-600 dark:text-rose-400";
	if (ms > 700) return "text-amber-600 dark:text-amber-400";
	return "text-emerald-600 dark:text-emerald-400";
}

export default function Page() {
	const [data, setData] = useState<SystemSnapshot | null>(null);

	useEffect(() => {
		fetch("/api/admin/system")
			.then((r) => r.json())
			.then((j) => j.success && setData(j.data))
			.catch(() => {});
	}, []);

	return (
		<div className="flex flex-col gap-4 p-4 pt-4 md:p-8">
			<div className="flex flex-col gap-1">
				<h1 className="text-3xl font-bold leading-none tracking-tight">
					System
				</h1>
				<p className="text-muted-foreground text-sm">
					Data freshness, platform health, and live query latency.
				</p>
			</div>

			{!data ? (
				<div className="grid grid-cols-12 gap-4">
					<Skeleton className="col-span-12 h-[160px] rounded-xl xl:col-span-4" />
					<Skeleton className="col-span-12 h-[160px] rounded-xl xl:col-span-4" />
					<Skeleton className="col-span-12 h-[160px] rounded-xl xl:col-span-4" />
				</div>
			) : (
				<div className="grid grid-cols-12 gap-4">
					<Card className="col-span-12 xl:col-span-4">
						<CardHeader>
							<CardTitle>Data Freshness</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-3">
							<Metric
								label="Last upload"
								value={
									data.freshness.lastUploadedAt
										? format(
												new Date(data.freshness.lastUploadedAt),
												"dd MMM, h:mm a",
											)
										: "—"
								}
							/>
							<Metric
								label="Status"
								value={
									data.freshness.dataAgeDays && data.freshness.dataAgeDays >= 1
										? `${data.freshness.dataAgeDays}d old`
										: "Fresh"
								}
								tone={
									data.freshness.dataAgeDays && data.freshness.dataAgeDays >= 1
										? "text-amber-600 dark:text-amber-400"
										: "text-emerald-600 dark:text-emerald-400"
								}
							/>
							<Metric
								label="Rows"
								value={data.freshness.totalRows.toLocaleString("en-IN")}
							/>
							<Metric
								label="Bills"
								value={data.freshness.totalBills.toLocaleString("en-IN")}
							/>
							<Metric
								label="Net revenue"
								value={formatCurrency(data.freshness.totalRevenue, {
									noDecimals: true,
								})}
							/>
							<Metric
								label="Latest sale"
								value={
									data.freshness.latestSaleDate
										? format(
												new Date(data.freshness.latestSaleDate),
												"dd MMM yyyy",
											)
										: "—"
								}
							/>
						</CardContent>
					</Card>

					<Card className="col-span-12 xl:col-span-4">
						<CardHeader>
							<CardTitle>Platform Health</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-3">
							<Metric
								label="Materialized views"
								value={String(data.infra.materializedViews.length)}
							/>
							<Metric
								label="sales_fact indexes"
								value={String(data.infra.salesFactIndexes)}
							/>
							<Metric
								label="mv_customer_identity"
								value={`${data.infra.mvCustomerIdentityRows.toLocaleString("en-IN")} rows`}
							/>
						</CardContent>
					</Card>

					<Card className="col-span-12 xl:col-span-4">
						<CardHeader>
							<CardTitle>Query Latency (live)</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-3">
							<Metric
								label="Sales KPIs"
								value={
									data.latencyMs.sales < 0
										? "err"
										: `${data.latencyMs.sales} ms`
								}
								tone={latTone(data.latencyMs.sales)}
							/>
							<Metric
								label="Store overview"
								value={
									data.latencyMs.store < 0
										? "err"
										: `${data.latencyMs.store} ms`
								}
								tone={latTone(data.latencyMs.store)}
							/>
							<Metric
								label="Customer (MV)"
								value={
									data.latencyMs.customer < 0
										? "err"
										: `${data.latencyMs.customer} ms`
								}
								tone={latTone(data.latencyMs.customer)}
							/>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
