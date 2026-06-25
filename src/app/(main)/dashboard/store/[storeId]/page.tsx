"use client";

import {
	AlertTriangle,
	ArrowLeft,
	IndianRupee,
	ShoppingCart,
	Store,
	Tag,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function Page({
	params,
}: {
	params: Promise<{ storeId: string }>;
}) {
	const { storeId } = React.use(params);
	const storeName = decodeURIComponent(storeId)
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());

	return (
		<div className="flex flex-col gap-6 p-4 md:p-8 pt-4">
			<div className="flex items-center gap-3">
				<Button variant="outline" size="icon" asChild className="h-8 w-8">
					<Link href="/dashboard/ecommerce">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="text-2xl font-bold tracking-tight">
					{storeName} Detail
				</h1>
			</div>

			<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
							Revenue
						</CardTitle>
						<IndianRupee className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-lg font-bold">--</div>
						<p className="text-[10px] text-muted-foreground">
							Odoo synchronization pending
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
							Transactions
						</CardTitle>
						<ShoppingCart className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-lg font-bold">--</div>
						<p className="text-[10px] text-muted-foreground">
							Odoo synchronization pending
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
							AOV
						</CardTitle>
						<Tag className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-lg font-bold">--</div>
						<p className="text-[10px] text-muted-foreground">
							Odoo synchronization pending
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
							Active Alerts
						</CardTitle>
						<AlertTriangle className="size-4 text-amber-500" />
					</CardHeader>
					<CardContent>
						<div className="text-lg font-bold">0</div>
						<p className="text-[10px] text-muted-foreground">
							Store operating normally
						</p>
					</CardContent>
				</Card>
			</div>

			<Card className="col-span-4">
				<CardHeader>
					<CardTitle className="text-sm font-semibold">
						Store Diagnostic Logs
					</CardTitle>
					<CardDescription className="text-xs text-muted-foreground">
						Detailed purchasing, margin (COGS), and inventory metrics are
						pending Odoo POS adapter integration.
					</CardDescription>
				</CardHeader>
				<CardContent className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg m-6">
					<Store className="size-8 text-muted-foreground mb-2 animate-pulse" />
					<span className="text-xs text-muted-foreground">
						Operational drilldowns will populate after data synchronization
						setup.
					</span>
				</CardContent>
			</Card>
		</div>
	);
}
