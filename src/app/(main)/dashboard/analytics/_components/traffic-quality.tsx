"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
	actualQuality: {
		color: "var(--chart-3)",
		label: "Daily Transactions",
	},
	baselineQuality: {
		color: "var(--muted-foreground)",
		label: "Period Average",
	},
} satisfies ChartConfig;

interface DailyTrend {
	date: string;
	orders: number;
}

export function TrafficQuality({
	data,
}: {
	data: { dailyTrends?: DailyTrend[] } | null | undefined;
}) {
	const trends = data?.dailyTrends || [];

	const { chartData } = useMemo(() => {
		if (trends.length === 0) {
			return { chartData: [] };
		}
		const totalOrders = trends.reduce(
			(acc: number, curr) => acc + (curr.orders || 0),
			0,
		);
		const average = Math.round(totalOrders / trends.length);

		const mapped = trends.map((item) => ({
			date: item.date,
			actualQuality: item.orders,
			baselineQuality: average,
		}));

		return { chartData: mapped };
	}, [trends]);

	function formatTick(value: string) {
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

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle className="font-normal text-muted-foreground text-sm">
					Traffic Volume vs Baseline
				</CardTitle>
			</CardHeader>

			<CardContent>
				<ChartContainer config={chartConfig} className="h-68 w-full">
					<ComposedChart
						data={chartData}
						margin={{ bottom: 0, left: 0, right: 0, top: 8 }}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							axisLine={false}
							tickFormatter={formatTick}
							tickLine={false}
							tickMargin={14}
							tick={{ fontSize: 10 }}
							interval="preserveEnd"
						/>
						<YAxis
							axisLine={false}
							tickLine={false}
							tickMargin={10}
							width={34}
							tick={{ fontSize: 10 }}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									className="w-44"
									labelFormatter={(value) => formatTooltipLabel(String(value))}
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
												<span className="font-medium font-mono text-foreground tabular-nums">
													{Number(value).toLocaleString()}
												</span>
											</div>
										</>
									)}
								/>
							}
						/>
						<Line
							dataKey="baselineQuality"
							dot={false}
							stroke="var(--color-baselineQuality)"
							strokeOpacity={0.65}
							strokeDasharray="4 4"
							strokeWidth={1.5}
							type="monotone"
						/>
						<Line
							dataKey="actualQuality"
							dot={false}
							activeDot={{ r: 4 }}
							stroke="var(--color-actualQuality)"
							strokeWidth={2.5}
							type="monotone"
						/>
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
