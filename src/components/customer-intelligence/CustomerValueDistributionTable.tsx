import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ValueDistributionResult } from "@/types/customer-intelligence";

import { money, pct } from "./format";

interface Props {
	distribution: ValueDistributionResult;
}

/**
 * Customer Value Distribution — lifetime visit ladder plus generated insights.
 * Explains who creates the business. Presentation only.
 */
export function CustomerValueDistributionTable({ distribution }: Props) {
	const { rows, totals, insights } = distribution;

	if (rows.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Customer Value Distribution</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No customer activity in this range yet.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Customer Value Distribution</CardTitle>
				<p className="text-muted-foreground text-sm">
					Customers grouped by lifetime visits — who creates the business.
				</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Visits</TableHead>
							<TableHead className="text-right">Customers</TableHead>
							<TableHead className="text-right">Cust %</TableHead>
							<TableHead className="text-right">Revenue</TableHead>
							<TableHead className="text-right">Rev %</TableHead>
							<TableHead className="text-right">AOV</TableHead>
							<TableHead className="text-right">LTV</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.bucket}>
								<TableCell className="font-medium">{row.bucket}</TableCell>
								<TableCell className="text-right tabular-nums">
									{row.customers.toLocaleString("en-IN")}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{pct(row.customerSharePct)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{money(row.revenue)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{pct(row.revenueSharePct)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{money(row.aov)}
								</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{money(row.ltv)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell className="font-semibold">Total</TableCell>
							<TableCell className="text-right font-semibold tabular-nums">
								{totals.customers.toLocaleString("en-IN")}
							</TableCell>
							<TableCell className="text-right tabular-nums">100%</TableCell>
							<TableCell className="text-right font-semibold tabular-nums">
								{money(totals.revenue)}
							</TableCell>
							<TableCell className="text-right tabular-nums">100%</TableCell>
							<TableCell className="text-right" />
							<TableCell className="text-right" />
						</TableRow>
					</TableFooter>
				</Table>

				{insights.length > 0 && (
					<div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
						{insights.map((text) => (
							<div key={text} className="flex items-start gap-2 text-sm">
								<Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
								<span>{text}</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
