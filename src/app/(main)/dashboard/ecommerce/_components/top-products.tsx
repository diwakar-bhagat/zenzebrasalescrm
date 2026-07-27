"use client";

import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";

import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
	"var(--chart-3)",
	"var(--chart-2)",
	"var(--chart-1)",
	"var(--chart-4)",
	"var(--chart-5)",
];

type ProductPerformanceRow = {
	category?: string | null;
	currentRevenue?: number | string | null;
	itemName?: string | null;
	skuCode?: string | null;
};

function toNumber(value: unknown) {
	const next = Number(value ?? 0);
	return Number.isFinite(next) ? next : 0;
}

export function TopProducts({ data }: { data: any }) {
	const productPerformance = (data?.productPerformance ||
		[]) as ProductPerformanceRow[];
	const currentTotalRevenue = toNumber(data?.salesKpis?.revenue?.current);

	const categories = useMemo(() => {
		const totals = productPerformance.reduce<Record<string, number>>(
			(acc, prod) => {
				const category = prod.category
					? String(prod.category)
					: "Uncategorized";
				acc[category] = (acc[category] ?? 0) + toNumber(prod.currentRevenue);
				return acc;
			},
			{},
		);
		const entries = Object.entries(totals) as Array<[string, number]>;
		const totalCatRevenue = entries.reduce((acc, [, value]) => acc + value, 0);
		if (totalCatRevenue <= 0) return [];

		return entries
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([name, revenue], index) => {
				const share = Math.round((revenue / totalCatRevenue) * 100);
				return {
					name,
					share: share > 0 ? share : 1,
					color: COLORS[index % COLORS.length],
				};
			});
	}, [productPerformance]);

	const products = useMemo(() => {
		return productPerformance.slice(0, 3).map((prod, index) => {
			const revenue = toNumber(prod.currentRevenue);
			const sku = prod.skuCode ? String(prod.skuCode) : null;
			const name = prod.itemName
				? String(prod.itemName)
				: (sku ?? "Unnamed product");
			const shareVal =
				currentTotalRevenue > 0
					? Math.round((revenue / currentTotalRevenue) * 100)
					: 0;
			return {
				key: `${sku ?? "product"}-${name}-${index}`,
				name,
				category: sku ? `SKU: ${sku}` : "SKU not available",
				share: `${shareVal}%`,
				sales: formatCurrency(revenue),
			};
		});
	}, [productPerformance, currentTotalRevenue]);

	const topProductsShare = useMemo(() => {
		const topProdRevenue = productPerformance
			.slice(0, 3)
			.reduce((acc, curr) => acc + toNumber(curr.currentRevenue), 0);
		if (currentTotalRevenue <= 0) return "0%";
		return `${Math.round((topProdRevenue / currentTotalRevenue) * 100)}%`;
	}, [productPerformance, currentTotalRevenue]);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle className="font-normal text-muted-foreground text-sm">
					Top Products
				</CardTitle>
				<CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
					{topProductsShare} of sales
				</CardDescription>
				<CardAction>
					<ArrowUpRight className="size-4" />
				</CardAction>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				{categories.length > 0 && (
					<div className="flex flex-col gap-2">
						<div
							aria-label="Sales by category"
							className="flex h-2 gap-1 overflow-hidden bg-muted rounded-full"
							role="img"
						>
							{categories.map((category: any) => (
								<div
									aria-hidden="true"
									key={category.name}
									style={{
										backgroundColor: category.color,
										width: `${category.share}%`,
									}}
								/>
							))}
						</div>

						<div className="flex flex-wrap gap-4">
							{categories.map((category: any) => (
								<div className="flex items-center gap-1" key={category.name}>
									<span
										aria-hidden="true"
										className="size-2 rounded-full"
										style={{ backgroundColor: category.color }}
									/>
									<span className="text-muted-foreground text-xs">
										{category.name}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				<div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3">
					<div className="text-muted-foreground text-xs">Products</div>
					<div className="text-muted-foreground text-xs">Share</div>
					<div className="text-muted-foreground text-xs">Sales</div>

					{products.map((product: any) => (
						<div className="contents text-sm" key={product.key}>
							<div className="min-w-0">
								<div className="truncate font-medium">{product.name}</div>
								<div className="text-muted-foreground text-xs">
									{product.category}
								</div>
							</div>
							<div className="self-center text-muted-foreground tabular-nums">
								{product.share}
							</div>
							<div className="self-center font-medium tabular-nums">
								{product.sales}
							</div>
						</div>
					))}
					{products.length === 0 && (
						<div className="col-span-3 py-6 text-center text-muted-foreground text-sm">
							Product movement will appear after SKU rows are available.
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
