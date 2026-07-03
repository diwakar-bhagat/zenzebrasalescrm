"use client";

import {
	Activity,
	AlertCircle,
	Award,
	CheckCircle,
	Heart,
	HelpCircle,
	Search,
	ShieldAlert,
	Sparkles,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHealth } from "@/hooks/useHealth";

export function SegmentsHealthTab({ hasData }: { hasData: boolean }) {
	const { data: healthData, isLoading } = useHealth(hasData);

	const vipCount = healthData?.vip ?? 0;
	const loyalCount = healthData?.loyal ?? 0;
	const newCount = healthData?.newCustomers ?? 0;
	const atRiskCount = healthData?.atRisk ?? 0;
	const lostCount = healthData?.lost ?? 0;
	const healthyCount = healthData?.healthy ?? 0;
	const total = healthData?.total ?? 1;
	const score = healthData?.healthScore ?? 100;
	const healthStatus = healthData?.status ?? "Healthy";
	const customerList = healthData?.customerList || [];

	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSegment, setSelectedSegment] = useState<string>("all");

	// Blended statistics
	const filteredCustomers = useMemo(() => {
		return customerList.filter((c: any) => {
			const query = searchQuery.toLowerCase();
			const matchesSearch =
				!searchQuery ||
				c.customerName?.toLowerCase().includes(query) ||
				c.customerMobile?.includes(query);

			const matchesSegment =
				selectedSegment === "all" ||
				c.segment.toLowerCase() === selectedSegment.toLowerCase();

			return matchesSearch && matchesSegment;
		});
	}, [searchQuery, selectedSegment, customerList]);

	const shares = useMemo(() => {
		return {
			vip: Math.round((vipCount / total) * 100),
			healthy: Math.round((healthyCount / total) * 100),
			atRisk: Math.round((atRiskCount / total) * 100),
			lost: Math.round((lostCount / total) * 100),
		};
	}, [vipCount, healthyCount, atRiskCount, lostCount, total]);

	const gaugeColors = useMemo(() => {
		if (score >= 75)
			return { text: "text-emerald-500", border: "border-emerald-500/20" };
		if (score >= 50)
			return { text: "text-amber-500", border: "border-amber-500/20" };
		return { text: "text-rose-500", border: "border-rose-500/20" };
	}, [score]);

	if (isLoading || !healthData) {
		return (
			<div className="grid gap-6 grid-cols-1 md:grid-cols-4 mt-2">
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[120px] rounded-2xl" />
				<Skeleton className="h-[400px] md:col-span-4 rounded-2xl" />
			</div>
		);
	}

	const getHealthBadge = (health: number) => {
		if (health >= 75) {
			return (
				<Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-none font-semibold font-mono text-[10px] rounded-sm">
					{health} (Good)
				</Badge>
			);
		}
		if (health >= 40) {
			return (
				<Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-none font-semibold font-mono text-[10px] rounded-sm">
					{health} (Average)
				</Badge>
			);
		}
		return (
			<Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-none font-semibold font-mono text-[10px] rounded-sm">
				{health} (Critical)
			</Badge>
		);
	};

	const getSegmentBadge = (segment: string) => {
		switch (segment) {
			case "VIP":
				return (
					<Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/20 border-amber-500/30 text-[10px] rounded-full">
						VIP
					</Badge>
				);
			case "Loyal":
				return (
					<Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/20 border-blue-500/30 text-[10px] rounded-full">
						Loyal
					</Badge>
				);
			case "New":
				return (
					<Badge className="bg-purple-500/20 text-purple-500 hover:bg-purple-500/20 border-purple-500/30 text-[10px] rounded-full">
						New
					</Badge>
				);
			case "At Risk":
				return (
					<Badge className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/20 border-orange-500/30 text-[10px] rounded-full">
						At Risk
					</Badge>
				);
			case "Lost":
				return (
					<Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/20 border-red-500/30 text-[10px] rounded-full">
						Lost
					</Badge>
				);
			default:
				return (
					<Badge className="bg-gray-500/20 text-gray-500 hover:bg-gray-500/20 border-gray-500/30 text-[10px] rounded-full">
						Regular
					</Badge>
				);
		}
	};

	const handleAction = (action: string, mobile: string) => {
		toast.info(`${action} queued for ${mobile}`, {
			description: "This action isn't wired to a live provider yet.",
		});
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Top Segment Health Cards */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
				<MetricCard
					title="Healthy Customers"
					value={`${healthyCount.toLocaleString()}`}
					comparisonLabel={`${shares.healthy}% of customer base`}
					icon={Heart}
				/>
				<MetricCard
					title="VIP Spenders"
					value={`${vipCount.toLocaleString()}`}
					comparisonLabel={`${shares.vip}% of customer base`}
					icon={Award}
				/>
				<MetricCard
					title="At Risk Customers"
					value={`${atRiskCount.toLocaleString()}`}
					comparisonLabel={`${shares.atRisk}% of customer base`}
					icon={AlertCircle}
				/>
				<MetricCard
					title="Lost Accounts"
					value={`${lostCount.toLocaleString()}`}
					comparisonLabel={`${shares.lost}% of customer base`}
					icon={ShieldAlert}
				/>
			</div>

			<div className="grid gap-6 grid-cols-1 xl:grid-cols-3 items-stretch">
				{/* Battery Base Health Card */}
				<div className="flex flex-col gap-6 xl:col-span-1">
					<Card className="border-white/10 bg-white/5 dark:bg-black/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex flex-col justify-between p-6 h-full">
						<div className="space-y-4">
							<h2 className="text-lg font-bold flex items-center gap-2">
								Customer Health Score
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="size-4 text-muted-foreground cursor-pointer" />
										</TooltipTrigger>
										<TooltipContent className="max-w-xs p-3 text-xs">
											<p>
												An overall index score calculated based on the
												composition of Champions and Loyal buyers versus at-risk
												accounts.
											</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</h2>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Calculated from Recency (40 pts), Frequency (30 pts), and
								Monetary (30 pts).
							</p>
						</div>

						<div className="flex flex-col items-center justify-center my-6">
							<div
								className={`relative size-36 rounded-full border-8 ${gaugeColors.border} flex flex-col items-center justify-center shadow-inner`}
							>
								<span
									className={`text-4xl font-extrabold font-mono ${gaugeColors.text}`}
								>
									{score}%
								</span>
								<span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider mt-1">
									{healthStatus}
								</span>
							</div>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>Customer Base Rating</span>
								<span className="font-semibold">{score}/100</span>
							</div>
							<Progress value={score} className="h-2" />
						</div>
					</Card>
				</div>

				{/* Detailed Customer Health Table */}
				<Card className="xl:col-span-2 overflow-hidden flex flex-col justify-between">
					<div>
						<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border/40">
							<div className="flex flex-col gap-1">
								<CardTitle className="text-lg">
									Customer Health Analysis
								</CardTitle>
								<CardDescription>
									Real-time customer segments, purchase health scores, and
									messaging actions.
								</CardDescription>
							</div>

							<div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
								{/* Segment filter */}
								<Select
									value={selectedSegment}
									onValueChange={setSelectedSegment}
								>
									<SelectTrigger className="w-[140px] h-9 text-xs">
										<SelectValue placeholder="All Segments" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Segments</SelectItem>
										<SelectItem value="vip">VIP</SelectItem>
										<SelectItem value="loyal">Loyal</SelectItem>
										<SelectItem value="new">New</SelectItem>
										<SelectItem value="at risk">At Risk</SelectItem>
										<SelectItem value="lost">Lost</SelectItem>
									</SelectContent>
								</Select>

								{/* Search */}
								<div className="relative w-full sm:w-[180px]">
									<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
									<Input
										placeholder="Search..."
										className="pl-9 h-9 text-xs w-full"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
									/>
								</div>
							</div>
						</CardHeader>
						<div className="overflow-x-auto w-full">
							<Table className="min-w-[650px] border-collapse">
								<TableHeader>
									<TableRow className="border-b bg-muted/20">
										<TableHead className="font-semibold text-xs py-3 pl-4">
											Customer Name/Mobile
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-center">
											Health Score
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-center">
											Segment
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-right">
											Last Purchase
										</TableHead>
										<TableHead className="font-semibold text-xs py-3 text-center pr-4">
											UX Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredCustomers.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={5}
												className="h-32 text-center text-muted-foreground text-xs"
											>
												No customer records found.
											</TableCell>
										</TableRow>
									) : (
										filteredCustomers.map((cust: any) => (
											<TableRow
												key={cust.customerMobile}
												className="border-b hover:bg-muted/5"
											>
												<TableCell className="py-3 pl-4">
													<div className="font-semibold text-xs text-foreground">
														{cust.customerName}
													</div>
													<div className="text-[10px] text-muted-foreground font-mono">
														{cust.customerMobile}
													</div>
												</TableCell>
												<TableCell className="py-3 text-center">
													{getHealthBadge(cust.healthScore)}
												</TableCell>
												<TableCell className="py-3 text-center">
													{getSegmentBadge(cust.segment)}
												</TableCell>
												<TableCell className="font-mono text-xs py-3 text-right tabular-nums text-muted-foreground">
													{cust.lastPurchaseDays === 0
														? "Today"
														: cust.lastPurchaseDays === 1
															? "Yesterday"
															: `${cust.lastPurchaseDays} Days`}
												</TableCell>
												<TableCell className="py-3 pr-4 text-center">
													<div className="flex items-center justify-center gap-1.5">
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<button
																		type="button"
																		onClick={() =>
																			handleAction("View", cust.customerMobile)
																		}
																		className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
																	>
																		<CheckCircle className="size-3.5" />
																	</button>
																</TooltipTrigger>
																<TooltipContent className="text-[10px] p-2">
																	View Details
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>

														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<button
																		type="button"
																		onClick={() =>
																			handleAction(
																				"WhatsApp",
																				cust.customerMobile,
																			)
																		}
																		className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-400 transition"
																	>
																		<Sparkles className="size-3.5" />
																	</button>
																</TooltipTrigger>
																<TooltipContent className="text-[10px] p-2">
																	WhatsApp Client
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>

														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<button
																		type="button"
																		onClick={() =>
																			handleAction("Email", cust.customerMobile)
																		}
																		className="p-1 rounded hover:bg-blue-500/10 text-blue-500 hover:text-blue-400 transition"
																	>
																		<HelpCircle className="size-3.5" />
																	</button>
																</TooltipTrigger>
																<TooltipContent className="text-[10px] p-2">
																	Email Client
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>

														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<button
																		type="button"
																		onClick={() =>
																			handleAction(
																				"Campaign",
																				cust.customerMobile,
																			)
																		}
																		className="p-1 rounded hover:bg-amber-500/10 text-amber-500 hover:text-amber-400 transition"
																	>
																		<Zap className="size-3.5" />
																	</button>
																</TooltipTrigger>
																<TooltipContent className="text-[10px] p-2">
																	Launch Campaign
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>

														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<button
																		type="button"
																		onClick={() =>
																			handleAction(
																				"Export",
																				cust.customerMobile,
																			)
																		}
																		className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
																	>
																		<Activity className="size-3.5" />
																	</button>
																</TooltipTrigger>
																<TooltipContent className="text-[10px] p-2">
																	Export Record
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
