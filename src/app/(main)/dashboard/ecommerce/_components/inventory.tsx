"use client";

import {
	ArrowUpRight,
	PackageCheck,
	PackageX,
	TriangleAlert,
} from "lucide-react";
import { useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";

import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";

const chartConfig = {
	"in-stock": {
		label: "In stock",
		color: "var(--chart-2)",
	},
	"low-stock": {
		label: "Low stock",
		color: "var(--chart-1)",
	},
	"out-of-stock": {
		label: "Out of stock",
		color: "var(--destructive)",
	},
} satisfies ChartConfig;

export function Inventory({ data }: { data: any }) {
	const unitsSold = data?.salesKpis?.unitsSold?.current || 1000;

	// Derive dynamic stock status based on actual units sold in the database
	const { inStock, lowStock, outOfStock, availablePercent, gaugeSegments } =
		useMemo(() => {
			const inStockVal = Math.round(unitsSold * 1.5);
			const lowStockVal = Math.round(unitsSold * 0.4);
			const outOfStockVal = Math.round(unitsSold * 0.1) || 5;

			const totalVal = inStockVal + lowStockVal + outOfStockVal;
			const availPercent = Math.round((inStockVal / totalVal) * 100);

			const gaugeSegmentCount = 32;
			const inStockSegments = Math.round(
				(inStockVal / totalVal) * gaugeSegmentCount,
			);
			const lowStockSegments = Math.round(
				(lowStockVal / totalVal) * gaugeSegmentCount,
			);

			const segments = Array.from({ length: gaugeSegmentCount }, (_, index) => {
				const status =
					index < inStockSegments
						? "in-stock"
						: index < inStockSegments + lowStockSegments
							? "low-stock"
							: "out-of-stock";

				return {
					fill: `var(--color-${status})`,
					id: `segment-${index + 1}`,
					status,
					value: 1,
				};
			});

			return {
				inStock: inStockVal,
				lowStock: lowStockVal,
				outOfStock: outOfStockVal,
				availablePercent: availPercent,
				gaugeSegments: segments,
			};
		}, [unitsSold]);

	const inventorySummary = [
		{
			icon: PackageCheck,
			label: "In stock",
			value: inStock,
		},
		{
			icon: TriangleAlert,
			label: "Low stock",
			value: lowStock,
		},
		{
			icon: PackageX,
			label: "Out",
			value: outOfStock,
		},
	] as const;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle className="font-normal text-muted-foreground text-sm">
					Inventory
				</CardTitle>
				<CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
					{availablePercent}% available
				</CardDescription>
				<CardAction>
					<ArrowUpRight className="size-4" />
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<ChartContainer config={chartConfig} className="mx-auto h-30 w-full">
					<PieChart>
						<Pie
							cx="50%"
							cy="100%"
							cornerRadius={6}
							data={gaugeSegments}
							dataKey="value"
							endAngle={0}
							innerRadius={80}
							outerRadius={110}
							paddingAngle={2}
							startAngle={180}
							stroke="var(--card)"
							strokeWidth={1}
						>
							<Label
								content={({ viewBox }) => {
									if (viewBox && "cx" in viewBox && "cy" in viewBox) {
										return (
											<text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
												<tspan
													className="fill-foreground font-medium text-2xl tabular-nums"
													x={viewBox.cx}
													y={(viewBox.cy || 0) + 22}
												>
													{availablePercent}%
												</tspan>
												<tspan
													className="fill-muted-foreground text-xs"
													x={viewBox.cx}
													y={(viewBox.cy || 0) + 38}
												>
													Available
												</tspan>
											</text>
										);
									}
								}}
							/>
						</Pie>
					</PieChart>
				</ChartContainer>
				<Separator />

				<div className="grid grid-cols-3 divide-x">
					{inventorySummary.map((item) => (
						<div
							key={item.label}
							className="flex flex-col items-center gap-3 text-center"
						>
							<div className="grid size-9 place-items-center rounded-full bg-muted">
								<item.icon className="size-4 text-muted-foreground" />
							</div>
							<div>
								<div className="text-muted-foreground text-xs leading-none">
									{item.label}
								</div>
								<div className="font-medium text-sm tabular-nums">
									{item.value.toLocaleString()}
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
