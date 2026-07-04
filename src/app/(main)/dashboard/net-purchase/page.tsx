"use client";

import {
	AlertCircle,
	ArrowUpRight,
	BarChart3,
	CheckCircle2,
	DollarSign,
	FileSpreadsheet,
	IndianRupee,
	Loader2,
	Package,
	Receipt,
	Store,
	TrendingDown,
	TrendingUp,
	Upload,
	UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveNetPurchaseColumnMappings } from "@/lib/parser/net-purchase-parser";
import { formatCurrency } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

interface SummaryData {
	summary: {
		netPurchase: number;
		grossPurchase: number;
		tax: number;
		rowCount: number;
		earliestDate: string | null;
		latestDate: string | null;
	};
	byStore: Array<{ store: string; net_purchase: number; row_count: number }>;
	byCategory: Array<{
		category: string;
		net_purchase: number;
		row_count: number;
	}>;
}

interface TrendPoint {
	period: string;
	netPurchase: number;
	grossPurchase: number;
	tax: number;
}

interface ComparisonData {
	netPurchase: number;
	revenue: number;
	estimatedCogs: number;
	purchaseToRevenueRatio: number | null;
	purchaseToCOGSRatio: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const CHART_COLORS = {
	primary: "hsl(221, 83%, 53%)",
	secondary: "hsl(262, 83%, 58%)",
	accent: "hsl(173, 80%, 40%)",
	muted: "hsl(215, 20%, 65%)",
	warning: "hsl(38, 92%, 50%)",
	danger: "hsl(0, 84%, 60%)",
};

const STORE_COLORS = [
	"hsl(221, 83%, 53%)",
	"hsl(262, 83%, 58%)",
	"hsl(173, 80%, 40%)",
	"hsl(38, 92%, 50%)",
	"hsl(339, 90%, 51%)",
	"hsl(142, 71%, 45%)",
];

function CustomTooltip({ active, payload, label }: any) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur-sm">
			<p className="mb-1 font-medium text-xs text-foreground">{label}</p>
			{payload.map((item: any) => (
				<p
					key={item.dataKey || item.name}
					className="text-xs"
					style={{ color: item.color }}
				>
					{item.name}: {formatCurrency(item.value, { noDecimals: true })}
				</p>
			))}
		</div>
	);
}

// ── Upload Dialog Component ──────────────────────────────────────────────

function NetPurchaseUploadDialog({
	onUploadComplete,
}: {
	onUploadComplete: () => void;
}) {
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [result, setResult] = useState<{
		success: boolean;
		message: string;
		details?: string;
	} | null>(null);

	const handleUpload = async () => {
		if (!file) return;
		setIsProcessing(true);
		setProgress(10);
		setResult(null);

		try {
			// Parse in browser first
			const XLSX = await import("xlsx");
			const reader = new FileReader();

			const rawRows = await new Promise<Record<string, unknown>[]>(
				(resolve, reject) => {
					reader.onload = (e) => {
						try {
							const data = new Uint8Array(e.target?.result as ArrayBuffer);
							const workbook = XLSX.read(data, { type: "array" });
							const sheetName = workbook.SheetNames.includes("main")
								? "main"
								: workbook.SheetNames[0];
							const worksheet = sheetName
								? workbook.Sheets[sheetName]
								: undefined;
							if (!worksheet) {
								reject(new Error("No worksheet found"));
								return;
							}
							const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
								worksheet,
								{ raw: true, defval: null },
							);
							resolve(rows);
						} catch (err) {
							reject(err);
						}
					};
					reader.onerror = reject;
					reader.readAsArrayBuffer(file);
				},
			);

			setProgress(30);

			// Validate column mappings
			if (rawRows.length === 0) {
				setResult({
					success: false,
					message: "No rows found in the spreadsheet.",
				});
				setIsProcessing(false);
				return;
			}

			const mappingResult = resolveNetPurchaseColumnMappings(rawRows[0] ?? {});
			if (!mappingResult.isValid) {
				setResult({
					success: false,
					message: "Column mapping failed.",
					details: mappingResult.errors.join("\n"),
				});
				setIsProcessing(false);
				return;
			}

			setProgress(50);

			// Start batch
			const startRes = await fetch(
				"/api/net-purchase/upload?mode=start_batch",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ filename: file.name }),
				},
			);
			const startData = await startRes.json();
			if (!startData.success) throw new Error("Failed to start batch");
			const batchId = startData.data.batchId;

			setProgress(60);

			// Upload chunks
			const CHUNK_SIZE = 500;
			for (let i = 0; i < rawRows.length; i += CHUNK_SIZE) {
				const chunk = rawRows.slice(i, i + CHUNK_SIZE);
				await fetch("/api/net-purchase/upload?mode=upload_chunk", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						batchId,
						chunkIndex: Math.floor(i / CHUNK_SIZE),
						rows: chunk,
					}),
				});
				setProgress(60 + Math.round((i / rawRows.length) * 20));
			}

			setProgress(85);

			// Commit
			const commitRes = await fetch("/api/net-purchase/upload?mode=commit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ batchId, uploadType: "full_replace" }),
			});
			const commitData = await commitRes.json();

			setProgress(100);

			if (commitData.success) {
				const inserted = commitData.data?.rowsInserted ?? 0;
				const quarantined = commitData.data?.validation?.quarantined ?? 0;
				setResult({
					success: true,
					message: `Successfully uploaded ${inserted} rows.`,
					details:
						quarantined > 0 ? `${quarantined} rows quarantined.` : undefined,
				});
				onUploadComplete();
			} else {
				setResult({
					success: false,
					message: commitData.error || "Upload failed.",
				});
			}
		} catch (err) {
			setResult({
				success: false,
				message: err instanceof Error ? err.message : "Upload failed.",
			});
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					className="gap-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10"
				>
					<Upload className="size-4" />
					Upload Net Purchase
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileSpreadsheet className="size-5 text-primary" />
						Upload Net Purchase Excel
					</DialogTitle>
					<DialogDescription>
						Upload the finance team&apos;s Net Purchase ledger spreadsheet. This
						is completely independent from Sales and Inventory uploads.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* File input */}
					<div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-8 transition-colors hover:border-primary/40 hover:bg-primary/5">
						<UploadCloud className="size-10 text-muted-foreground/50" />
						<label className="cursor-pointer text-center">
							<span className="font-medium text-primary text-sm underline-offset-4 hover:underline">
								Choose file
							</span>
							<span className="text-muted-foreground text-sm">
								{" "}
								or drag and drop
							</span>
							<input
								type="file"
								accept=".xlsx,.xls,.csv"
								className="hidden"
								onChange={(e) => {
									if (e.target.files?.[0]) {
										setFile(e.target.files[0]);
										setResult(null);
									}
								}}
							/>
						</label>
						{file && (
							<Badge variant="secondary" className="gap-1">
								<FileSpreadsheet className="size-3" />
								{file.name}
							</Badge>
						)}
					</div>

					{/* Progress */}
					{isProcessing && (
						<div className="space-y-2">
							<Progress value={progress} className="h-2" />
							<p className="text-center text-muted-foreground text-xs">
								Processing... {progress}%
							</p>
						</div>
					)}

					{/* Result */}
					{result && (
						<div
							className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
								result.success
									? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
									: "bg-destructive/10 text-destructive"
							}`}
						>
							{result.success ? (
								<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
							) : (
								<AlertCircle className="mt-0.5 size-4 shrink-0" />
							)}
							<div>
								<p className="font-medium">{result.message}</p>
								{result.details && (
									<p className="mt-1 text-xs opacity-80">{result.details}</p>
								)}
							</div>
						</div>
					)}

					{/* Upload button */}
					<Button
						onClick={handleUpload}
						disabled={!file || isProcessing}
						className="w-full gap-2"
					>
						{isProcessing ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Upload className="size-4" />
						)}
						{isProcessing ? "Processing..." : "Upload & Process"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── Main Dashboard Page ──────────────────────────────────────────────────

export default function NetPurchaseDashboardPage() {
	const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
	const [trendData, setTrendData] = useState<TrendPoint[]>([]);
	const [comparisonData, setComparisonData] = useState<ComparisonData | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const [summaryRes, trendRes, comparisonRes] = await Promise.all([
				fetch("/api/net-purchase/summary"),
				fetch("/api/net-purchase/trends"),
				fetch("/api/net-purchase/comparison"),
			]);

			const [summaryJson, trendJson, comparisonJson] = await Promise.all([
				summaryRes.json(),
				trendRes.json(),
				comparisonRes.json(),
			]);

			if (summaryJson.success) setSummaryData(summaryJson.data);
			if (trendJson.success) setTrendData(trendJson.data);
			if (comparisonJson.success) setComparisonData(comparisonJson.data);
		} catch (err) {
			console.error("Failed to fetch net purchase data:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const hasData = (summaryData?.summary.rowCount ?? 0) > 0;

	// ── Loading State ──────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-4 pt-4 md:p-8">
				<div className="flex items-center justify-between">
					<div className="flex flex-col gap-1">
						<Skeleton className="h-8 w-64" />
						<Skeleton className="h-4 w-40" />
					</div>
					<Skeleton className="h-10 w-48" />
				</div>
				<div className="grid gap-4 md:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-32 rounded-xl" />
					))}
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<Skeleton className="h-72 rounded-xl" />
					<Skeleton className="h-72 rounded-xl" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-4 pt-4 md:p-8">
			{/* ── Header ──────────────────────────────────────────────── */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<h1 className="font-bold text-3xl leading-none tracking-tight">
						Net Purchase
					</h1>
					<p className="text-muted-foreground text-sm">
						Finance-owned purchase ledger — independent module
					</p>
				</div>
				<div className="flex items-center gap-3">
					{hasData && (
						<Badge
							variant="outline"
							className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
						>
							<CheckCircle2 className="size-3" />
							{summaryData?.summary.rowCount.toLocaleString()} records
						</Badge>
					)}
					<NetPurchaseUploadDialog onUploadComplete={fetchData} />
				</div>
			</div>

			{/* ── Empty State ──────────────────────────────────────────── */}
			{!hasData && (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-16">
						<div className="mb-4 rounded-full bg-primary/10 p-4">
							<Receipt className="size-8 text-primary" />
						</div>
						<h3 className="mb-2 font-semibold text-lg">
							No Net Purchase Data Yet
						</h3>
						<p className="mb-6 max-w-md text-center text-muted-foreground text-sm">
							Upload the finance team&apos;s Net Purchase Excel to see purchase
							analytics, store breakdowns, and comparison charts.
						</p>
						<NetPurchaseUploadDialog onUploadComplete={fetchData} />
					</CardContent>
				</Card>
			)}

			{/* ── KPI Cards ───────────────────────────────────────────── */}
			{hasData && summaryData && (
				<>
					<div className="grid gap-4 md:grid-cols-3">
						{/* Net Purchase Total */}
						<Card className="relative overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/10" />
							<CardHeader className="relative flex flex-row items-center justify-between pb-2">
								<CardTitle className="font-medium text-sm">
									Total Net Purchase
								</CardTitle>
								<div className="rounded-lg bg-blue-500/10 p-2">
									<IndianRupee className="size-4 text-blue-600" />
								</div>
							</CardHeader>
							<CardContent className="relative">
								<div className="font-bold text-2xl tracking-tight">
									{formatCurrency(summaryData.summary.netPurchase, {
										noDecimals: true,
									})}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									Gross:{" "}
									{formatCurrency(summaryData.summary.grossPurchase, {
										noDecimals: true,
									})}
								</p>
							</CardContent>
						</Card>

						{/* Tax */}
						<Card className="relative overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/10" />
							<CardHeader className="relative flex flex-row items-center justify-between pb-2">
								<CardTitle className="font-medium text-sm">
									Tax Component
								</CardTitle>
								<div className="rounded-lg bg-amber-500/10 p-2">
									<Receipt className="size-4 text-amber-600" />
								</div>
							</CardHeader>
							<CardContent className="relative">
								<div className="font-bold text-2xl tracking-tight">
									{formatCurrency(summaryData.summary.tax, {
										noDecimals: true,
									})}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									{summaryData.summary.grossPurchase > 0
										? (
												(summaryData.summary.tax /
													summaryData.summary.grossPurchase) *
												100
											).toFixed(1)
										: "0.0"}
									% of gross purchase
								</p>
							</CardContent>
						</Card>

						{/* Purchase vs Revenue */}
						<Card className="relative overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/10" />
							<CardHeader className="relative flex flex-row items-center justify-between pb-2">
								<CardTitle className="font-medium text-sm">
									Purchase vs Revenue
								</CardTitle>
								<div className="rounded-lg bg-emerald-500/10 p-2">
									<ArrowUpRight className="size-4 text-emerald-600" />
								</div>
							</CardHeader>
							<CardContent className="relative">
								<div className="font-bold text-2xl tracking-tight">
									{comparisonData?.purchaseToRevenueRatio != null
										? `${comparisonData.purchaseToRevenueRatio}%`
										: "—"}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									{comparisonData?.revenue
										? `Revenue: ${formatCurrency(comparisonData.revenue, { noDecimals: true })}`
										: "No revenue data available"}
								</p>
							</CardContent>
						</Card>
					</div>

					{/* ── Charts Row ────────────────────────────────────────── */}
					<div className="grid gap-4 lg:grid-cols-2">
						{/* Trend Chart */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<TrendingUp className="size-4 text-primary" />
									Net Purchase Trend
								</CardTitle>
								<CardDescription>Monthly purchase amounts</CardDescription>
							</CardHeader>
							<CardContent>
								{trendData.length > 0 ? (
									<ResponsiveContainer width="100%" height={260}>
										<AreaChart data={trendData}>
											<defs>
												<linearGradient
													id="npGradient"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor={CHART_COLORS.primary}
														stopOpacity={0.3}
													/>
													<stop
														offset="95%"
														stopColor={CHART_COLORS.primary}
														stopOpacity={0}
													/>
												</linearGradient>
											</defs>
											<CartesianGrid
												strokeDasharray="3 3"
												className="stroke-muted/30"
											/>
											<XAxis
												dataKey="period"
												className="text-xs"
												tick={{ fill: "hsl(var(--muted-foreground))" }}
											/>
											<YAxis
												className="text-xs"
												tick={{ fill: "hsl(var(--muted-foreground))" }}
												tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
											/>
											<Tooltip content={<CustomTooltip />} />
											<Area
												type="monotone"
												dataKey="netPurchase"
												name="Net Purchase"
												stroke={CHART_COLORS.primary}
												fill="url(#npGradient)"
												strokeWidth={2}
											/>
										</AreaChart>
									</ResponsiveContainer>
								) : (
									<div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
										No trend data available
									</div>
								)}
							</CardContent>
						</Card>

						{/* Store Breakdown */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<Store className="size-4 text-primary" />
									Net Purchase by Store
								</CardTitle>
								<CardDescription>Breakdown by store location</CardDescription>
							</CardHeader>
							<CardContent>
								{summaryData.byStore.length > 0 ? (
									<ResponsiveContainer width="100%" height={260}>
										<BarChart
											data={summaryData.byStore.map((s) => ({
												name:
													s.store?.length > 16
														? `${s.store.slice(0, 14)}…`
														: s.store,
												value: Number(s.net_purchase),
											}))}
											layout="vertical"
										>
											<CartesianGrid
												strokeDasharray="3 3"
												className="stroke-muted/30"
												horizontal={false}
											/>
											<XAxis
												type="number"
												className="text-xs"
												tick={{ fill: "hsl(var(--muted-foreground))" }}
												tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
											/>
											<YAxis
												dataKey="name"
												type="category"
												className="text-xs"
												tick={{ fill: "hsl(var(--muted-foreground))" }}
												width={120}
											/>
											<Tooltip content={<CustomTooltip />} />
											<Bar
												dataKey="value"
												name="Net Purchase"
												radius={[0, 6, 6, 0]}
											>
												{summaryData.byStore.map((s, idx) => (
													<Cell
														key={s.store || `store-${idx}`}
														fill={STORE_COLORS[idx % STORE_COLORS.length]}
													/>
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								) : (
									<div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
										No store data available
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* ── Category + Comparison Row ─────────────────────────── */}
					<div className="grid gap-4 lg:grid-cols-2">
						{/* Category Breakdown */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<Package className="size-4 text-primary" />
									Net Purchase by Category
								</CardTitle>
								<CardDescription>
									Category-wise purchase distribution
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{summaryData.byCategory.slice(0, 8).map((cat, idx) => {
										const maxVal = Math.max(
											...summaryData.byCategory.map((c) =>
												Number(c.net_purchase),
											),
										);
										const pct =
											maxVal > 0
												? (Number(cat.net_purchase) / maxVal) * 100
												: 0;
										return (
											<div key={cat.category} className="space-y-1.5">
												<div className="flex items-center justify-between">
													<span className="font-medium text-sm">
														{cat.category}
													</span>
													<span className="tabular-nums text-muted-foreground text-sm">
														{formatCurrency(Number(cat.net_purchase), {
															noDecimals: true,
														})}
													</span>
												</div>
												<div className="h-2 overflow-hidden rounded-full bg-muted/30">
													<div
														className="h-full rounded-full transition-all duration-500"
														style={{
															width: `${pct}%`,
															background:
																STORE_COLORS[idx % STORE_COLORS.length],
														}}
													/>
												</div>
											</div>
										);
									})}
									{summaryData.byCategory.length === 0 && (
										<p className="py-8 text-center text-muted-foreground text-sm">
											No category data available
										</p>
									)}
								</div>
							</CardContent>
						</Card>

						{/* Purchase vs Revenue vs COGS */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<BarChart3 className="size-4 text-primary" />
									Purchase vs Revenue vs COGS
								</CardTitle>
								<CardDescription>
									Finance cross-reference comparison
								</CardDescription>
							</CardHeader>
							<CardContent>
								{comparisonData ? (
									<div className="space-y-6 py-2">
										{[
											{
												label: "Net Purchase",
												value: comparisonData.netPurchase,
												color: CHART_COLORS.primary,
												icon: DollarSign,
											},
											{
												label: "Sales Revenue",
												value: comparisonData.revenue,
												color: CHART_COLORS.accent,
												icon: TrendingUp,
											},
											{
												label: "Estimated COGS",
												value: comparisonData.estimatedCogs,
												color: CHART_COLORS.warning,
												icon: TrendingDown,
											},
										].map((item) => {
											const maxVal = Math.max(
												comparisonData.netPurchase,
												comparisonData.revenue,
												comparisonData.estimatedCogs,
											);
											const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
											return (
												<div key={item.label} className="space-y-2">
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<item.icon
																className="size-4"
																style={{ color: item.color }}
															/>
															<span className="font-medium text-sm">
																{item.label}
															</span>
														</div>
														<span className="font-semibold tabular-nums text-sm">
															{formatCurrency(item.value, {
																noDecimals: true,
															})}
														</span>
													</div>
													<div className="h-3 overflow-hidden rounded-full bg-muted/20">
														<div
															className="h-full rounded-full transition-all duration-700"
															style={{
																width: `${pct}%`,
																background: `linear-gradient(90deg, ${item.color}, ${item.color}dd)`,
															}}
														/>
													</div>
												</div>
											);
										})}
										<div className="mt-4 grid grid-cols-2 gap-3">
											<div className="rounded-lg border bg-muted/10 p-3">
												<p className="text-muted-foreground text-xs">
													Purchase/Revenue
												</p>
												<p className="mt-1 font-bold text-lg tabular-nums">
													{comparisonData.purchaseToRevenueRatio != null
														? `${comparisonData.purchaseToRevenueRatio}%`
														: "—"}
												</p>
											</div>
											<div className="rounded-lg border bg-muted/10 p-3">
												<p className="text-muted-foreground text-xs">
													Purchase/COGS
												</p>
												<p className="mt-1 font-bold text-lg tabular-nums">
													{comparisonData.purchaseToCOGSRatio != null
														? `${comparisonData.purchaseToCOGSRatio}%`
														: "—"}
												</p>
											</div>
										</div>
									</div>
								) : (
									<div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
										No comparison data available
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</>
			)}
		</div>
	);
}
