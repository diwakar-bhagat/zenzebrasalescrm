import { format } from "date-fns";
import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

export interface TrendStore {
	name: string;
	revenue: number;
}

export interface TrendRow {
	date: string;
	stores: TrendStore[];
}

export interface TrendChartProps {
	trends: TrendRow[];
}

const LINE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export function TrendChart({ trends }: TrendChartProps) {
	// 1. Get all unique store names across all dates
	const uniqueStores = React.useMemo(() => {
		const storesSet = new Set<string>();
		for (const row of trends) {
			for (const store of row.stores) {
				storesSet.add(store.name);
			}
		}
		return Array.from(storesSet);
	}, [trends]);

	// 2. Rank stores by total revenue to determine default active stores (Top 3)
	const storeRevenueRank = React.useMemo(() => {
		const revs: Record<string, number> = {};
		for (const row of trends) {
			for (const store of row.stores) {
				revs[store.name] = (revs[store.name] || 0) + store.revenue;
			}
		}
		return Object.entries(revs)
			.sort((a, b) => b[1] - a[1])
			.map(([name]) => name);
	}, [trends]);

	// 3. Keep selected stores state, default to top 3
	const [selectedStores, setSelectedStores] = React.useState<string[]>([]);

	React.useEffect(() => {
		if (storeRevenueRank.length > 0) {
			setSelectedStores(storeRevenueRank.slice(0, 3));
		}
	}, [storeRevenueRank]);

	// 4. Map colors dynamically
	const storeColors = React.useMemo(() => {
		const colorsMap: Record<string, string> = {};
		uniqueStores.forEach((name, idx) => {
			colorsMap[name] = LINE_COLORS[idx % LINE_COLORS.length];
		});
		return colorsMap;
	}, [uniqueStores]);

	// 5. Construct Recharts data shape
	const chartData = React.useMemo(() => {
		return trends.map((row) => {
			const obj: any = { date: row.date };
			for (const store of row.stores) {
				if (selectedStores.includes(store.name)) {
					obj[store.name] = store.revenue;
				}
			}
			return obj;
		});
	}, [trends, selectedStores]);

	// 6. Chart config definition
	const chartConfig = React.useMemo(() => {
		const config: ChartConfig = {};
		uniqueStores.forEach((name) => {
			config[name] = {
				label: name,
				color: storeColors[name],
			};
		});
		return config;
	}, [uniqueStores, storeColors]);

	function formatWeekday(value: string) {
		try {
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return value;
			return format(date, "d MMM");
		} catch {
			return value;
		}
	}

	function formatTooltipLabel(value: string) {
		try {
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return value;
			return format(date, "PPPP");
		} catch {
			return value;
		}
	}

	const toggleStore = (name: string) => {
		setSelectedStores((prev) =>
			prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
		);
	};

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-col gap-1 pb-3">
				<CardTitle className="text-lg font-bold">Revenue Momentum</CardTitle>
				<CardDescription className="text-xs text-muted-foreground">
					Daily net revenue trends by operational location.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Checkbox Selector Group for Scaling to 10+ stores */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3">
					<span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
						Compare Stores:
					</span>
					{uniqueStores.map((name) => {
						const isChecked = selectedStores.includes(name);
						const color = storeColors[name];
						return (
							<div key={name} className="flex items-center gap-1.5">
								<Checkbox
									id={`chk-${name}`}
									checked={isChecked}
									onCheckedChange={() => toggleStore(name)}
								/>
								<Label
									htmlFor={`chk-${name}`}
									className="flex items-center gap-1 text-xs font-medium cursor-pointer"
								>
									<span
										className="size-2 rounded-full shrink-0"
										style={{ backgroundColor: color }}
									/>
									{name}
								</Label>
							</div>
						);
					})}
				</div>

				{/* Recharts Container */}
				{chartData.length === 0 ? (
					<div className="h-60 flex items-center justify-center text-muted-foreground text-xs">
						No trend data available.
					</div>
				) : (
					<ChartContainer config={chartConfig} className="h-60 w-full">
						<LineChart
							accessibilityLayer
							data={chartData}
							margin={{ bottom: 0, left: 0, right: 0, top: 8 }}
						>
							<CartesianGrid
								vertical={false}
								strokeDasharray="3 3"
								className="stroke-muted/40"
							/>
							<XAxis
								axisLine={false}
								dataKey="date"
								tickFormatter={formatWeekday}
								tickLine={false}
								tickMargin={10}
								tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
								interval="preserveEnd"
							/>
							<YAxis
								axisLine={false}
								tickLine={false}
								tickMargin={10}
								tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
								tickFormatter={(val) =>
									formatCurrency(Number(val), { noDecimals: true })
								}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(value) =>
											formatTooltipLabel(String(value))
										}
										formatter={(value, name, item) => (
											<>
												<div
													className="size-2.5 shrink-0 rounded-[2px]"
													style={{
														backgroundColor: item.color,
													}}
												/>
												<div className="flex flex-1 items-center justify-between leading-none gap-2">
													<span className="text-muted-foreground text-xs">
														{String(name ?? "")}
													</span>
													<span className="font-semibold font-mono text-foreground text-xs tabular-nums">
														{formatCurrency(Number(value))}
													</span>
												</div>
											</>
										)}
									/>
								}
							/>
							{selectedStores.map((name) => (
								<Line
									key={name}
									connectNulls
									dataKey={name}
									stroke={storeColors[name]}
									strokeWidth={2}
									dot={false}
									activeDot={{ r: 4 }}
									name={name}
								/>
							))}
						</LineChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
