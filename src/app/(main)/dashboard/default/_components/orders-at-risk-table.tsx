"use client";

import { ExternalLink, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import { ExportButton } from "@/components/dashboard/export-button";
import { VendorPerformanceModal } from "@/components/dashboard/vendor-performance-modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const _now = new Date();

type OrderStatus = "on-track" | "at-risk" | "delayed" | "completed";

interface OrderRow {
	id: string;
	buyer: string;
	product: string;
	stage: string;
	daysLeft: number;
	progress: number;
	status: OrderStatus;
	vendor: string;
	quantity: number;
}

const orders: OrderRow[] = [];

const statusStyles: Record<OrderStatus, { dot: string; text: string }> = {
	"on-track": {
		dot: "bg-status-on-track",
		text: "text-muted-foreground",
	},
	"at-risk": {
		dot: "bg-status-at-risk",
		text: "text-status-at-risk",
	},
	delayed: {
		dot: "bg-status-delayed",
		text: "text-status-delayed",
	},
	completed: {
		dot: "bg-status-completed",
		text: "text-muted-foreground",
	},
};

function DaysLeftChip({ days }: { days: number }) {
	const isOverdue = days < 0;
	const isUrgent = days >= 0 && days <= 2;
	const style = isOverdue
		? statusStyles.delayed
		: isUrgent
			? statusStyles["at-risk"]
			: statusStyles["on-track"];

	return (
		<span
			className={`inline-flex w-full items-center justify-end gap-1.5 font-medium text-xs ${style.text}`}
		>
			{isOverdue || isUrgent ? (
				<span className="relative flex size-1.5 shrink-0">
					<span
						className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.dot}`}
					/>
					<span
						className={`relative inline-flex size-1.5 rounded-full ${style.dot}`}
					/>
				</span>
			) : (
				<span
					className={`relative inline-flex size-1.5 shrink-0 rounded-full ${style.dot}`}
				/>
			)}
			<span>{isOverdue ? `${Math.abs(days)}d overdue` : `${days}d left`}</span>
		</span>
	);
}

function getInitials(name: string) {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function OrdersAtRiskTable() {
	const router = useRouter();
	const exportData = orders.map(
		({
			id,
			buyer,
			product,
			stage,
			daysLeft,
			progress,
			status,
			vendor,
			quantity,
		}) => ({
			"Order ID": id,
			Buyer: buyer,
			Product: product,
			Stage: stage,
			"Days Left": daysLeft,
			"Progress %": progress,
			Status: status,
			Vendor: vendor,
			Qty: quantity,
		}),
	);

	return (
		<Card className="border-border bg-card">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
				<CardTitle className="font-medium text-base">
					Active Production Orders
				</CardTitle>
				<ExportButton data={exportData} filename="orders-report" />
			</CardHeader>
			<CardContent className="p-0">
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow className="border-b bg-muted/50 hover:bg-muted/50">
								<TableHead className="w-[90px] font-semibold text-[11px] text-muted-foreground">
									ORDER
								</TableHead>
								<TableHead className="w-[140px] font-semibold text-[11px] text-muted-foreground">
									BUYER
								</TableHead>
								<TableHead className="w-[180px] font-semibold text-[11px] text-muted-foreground">
									PRODUCT
								</TableHead>
								<TableHead className="w-[90px] font-semibold text-[11px] text-muted-foreground">
									STAGE
								</TableHead>
								<TableHead className="w-[110px] font-semibold text-[11px] text-muted-foreground">
									PROGRESS
								</TableHead>
								<TableHead className="w-[70px] text-right font-semibold text-[11px] text-muted-foreground">
									DAYS
								</TableHead>
								<TableHead className="w-[90px] font-semibold text-[11px] text-muted-foreground">
									STATUS
								</TableHead>
								<TableHead className="w-[40px] font-semibold text-[11px] text-muted-foreground" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{orders.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="h-24 text-center text-muted-foreground text-sm"
									>
										No production orders configured.
									</TableCell>
								</TableRow>
							) : (
								orders.map((order) => {
									const style = statusStyles[order.status];
									return (
										<TableRow
											key={order.id}
											className="h-12 cursor-pointer border-b transition-colors duration-150 hover:bg-muted/30"
										>
											<TableCell className="font-mono text-xs">
												{order.id}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<Avatar className="size-6">
														<AvatarFallback className="bg-muted font-medium text-[9px]">
															{getInitials(order.buyer)}
														</AvatarFallback>
													</Avatar>
													<span className="truncate font-medium text-xs">
														{order.buyer}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<div className="flex flex-col">
													<span className="truncate font-medium text-xs">
														{order.product}
													</span>
													<VendorPerformanceModal vendorName={order.vendor}>
														<span className="w-fit cursor-pointer text-[10px] text-muted-foreground transition-colors hover:text-primary hover:underline">
															{order.vendor}
														</span>
													</VendorPerformanceModal>
												</div>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1.5">
													<span className="size-1.5 rounded-full bg-muted-foreground/30" />
													<span className="font-medium text-[11px] text-muted-foreground">
														{order.stage}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<Progress
														value={order.progress}
														className="h-1.5 w-16 bg-muted"
														indicatorClassName={style.dot}
													/>
													<span className="w-7 text-right text-[11px] text-muted-foreground tabular-nums">
														{order.progress}%
													</span>
												</div>
											</TableCell>
											<TableCell className="text-right">
												<DaysLeftChip days={order.daysLeft} />
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1.5">
													<span
														className={`size-1.5 rounded-full ${style.dot}`}
													/>
													<span
														className={`font-medium text-[11px] capitalize ${style.text}`}
													>
														{order.status}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="size-7"
														>
															<MoreHorizontal className="size-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="w-44">
														<DropdownMenuItem
															className="cursor-pointer"
															onClick={() =>
																router.push(
																	`/dashboard/tna-tracker?order=${order.id}`,
																)
															}
														>
															<ExternalLink className="mr-2 size-3.5" />
															View TNA
														</DropdownMenuItem>
														<DropdownMenuItem>Edit Order</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem>Mark Complete</DropdownMenuItem>
														<DropdownMenuItem className="text-status-delayed">
															Flag Order
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
