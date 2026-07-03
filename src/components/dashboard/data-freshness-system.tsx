"use client";

import { format } from "date-fns";
import { AlertCircle, Calendar, Clock, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TEXT_CLASS = {
	green: "text-green-600 dark:text-green-400",
	yellow: "text-yellow-600 dark:text-yellow-400",
	red: "text-destructive",
	neutral: "text-foreground",
} as const;

interface FreshnessData {
	latestSaleDate: string | null;
	lastUploadedAt: string | null;
	dataAgeDays: number | null;
}

export function DataFreshnessSystem() {
	const [data, setData] = useState<FreshnessData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const res = await fetch("/api/data-freshness");
				const json = await res.json();

				if (json.success) {
					setData(json.data);
					setError(null);
				} else {
					setError("Failed to load freshness data");
				}
			} catch (err) {
				console.error("Failed to fetch data freshness:", err);
				setError("Network error");
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();

		// Lightweight polling every 5 minutes (300,000 ms)
		const interval = setInterval(fetchData, 300000);
		return () => clearInterval(interval);
	}, []);

	if (isLoading && !data) {
		return <Skeleton className="h-9 w-28 rounded-full" />;
	}

	// Determine number tone and copy based on age.
	// 0-1 days: green, 2-5 days: yellow, 6+ days (1-2 weeks or more): red.
	// The pill itself always stays neutral grey — only the number changes color.
	let tone: keyof typeof TEXT_CLASS = "neutral";
	let primaryText = "Loading";
	let secondaryText: string | null = null;

	if (error) {
		tone = "red";
		primaryText = "Data error";
	} else if (!data?.latestSaleDate) {
		tone = "neutral";
		primaryText = "No data";
	} else if (data.dataAgeDays === 0) {
		tone = "green";
		primaryText = "Fresh";
	} else if (data.dataAgeDays !== null) {
		const days = data.dataAgeDays;
		tone = days <= 1 ? "green" : days <= 5 ? "yellow" : "red";
		primaryText = String(days);
		secondaryText = days === 1 ? "day old" : "days old";
	}

	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					className="flex h-9 items-center justify-center gap-1.5 rounded-full border bg-muted/20 px-3.5 text-sm leading-none outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					<span className={cn("font-semibold tabular-nums", TEXT_CLASS[tone])}>
						{primaryText}
					</span>
					{secondaryText && (
						<span className="text-muted-foreground">{secondaryText}</span>
					)}
				</button>
			</SheetTrigger>

			<SheetContent className="w-[400px] sm:w-[540px]">
				<SheetHeader className="mb-6">
					<SheetTitle className="flex items-center">
						<Database className="mr-2 size-5 text-muted-foreground" />
						Data Source Status
					</SheetTitle>
					<SheetDescription>
						This dashboard is powered by daily Excel uploads. It is not a
						realtime system.
					</SheetDescription>
				</SheetHeader>

				<div className="space-y-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Latest Sale Date
							</CardTitle>
							<Calendar className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{data?.latestSaleDate
									? format(new Date(data.latestSaleDate), "dd MMM yyyy")
									: "N/A"}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								{data?.dataAgeDays !== null && data?.dataAgeDays !== undefined
									? data.dataAgeDays === 0
										? "Data is up to date"
										: `${data.dataAgeDays} day${data.dataAgeDays === 1 ? "" : "s"} behind current date`
									: "No data available"}
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Last Uploaded At
							</CardTitle>
							<Clock className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-lg font-semibold">
								{data?.lastUploadedAt
									? format(new Date(data.lastUploadedAt), "dd MMM yyyy, HH:mm")
									: "N/A"}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								The timestamp when the last spreadsheet was processed.
							</p>
						</CardContent>
					</Card>

					{data?.dataAgeDays !== null &&
						data?.dataAgeDays !== undefined &&
						data.dataAgeDays > 1 && (
							<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 flex items-start mt-4">
								<AlertCircle className="size-5 mr-2 mt-0.5 shrink-0" />
								<div className="text-sm">
									<p className="font-semibold">Stale Data Warning</p>
									<p className="opacity-90">
										The dashboard data is {data.dataAgeDays} days old. Please
										upload the latest sales sheet to update the metrics.
									</p>
								</div>
							</div>
						)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
