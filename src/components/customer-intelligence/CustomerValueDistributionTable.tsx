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
			<Card className="transition-all duration-300 hover:border-foreground/20">
				<CardHeader className="pb-3">
					<CardTitle className="font-semibold text-lg">
						Customer Value Distribution
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<p className="text-muted-foreground text-xs">
						No customer activity in this range yet.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]">
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-lg">
					Customer Value Distribution
				</CardTitle>
				<p className="text-muted-foreground text-xs">
					Customers grouped by lifetime visits — who creates the business.
				</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 pt-0">
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="text-xs font-semibold uppercase tracking-wider h-10">
									Visits
								</TableHead>
								<TableHead className="text-right text-xs font-semibold uppercase tracking-wider h-10">
									Customers
								</TableHead>
								<TableHead className="text-right text-xs font-semibold uppercase tracking-wider h-10">
									Cust %
								</TableHead>
								<TableHead className="text-right text-xs font-semibold uppercase tracking-wider h-10">
									Revenue
								</TableHead>
								<TableHead className="text-right text-xs font-semibold uppercase tracking-wider h-10">
									Rev %
								</TableHead>
								<TableHead className="text-right text-xs font-semibold uppercase tracking-wider h-10">
									AOV
								</TableHead>
								<TableHead className="text-right text-xs font-semibold uppercase tracking-wider h-10">
									LTV
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow
									key={row.bucket}
									className="transition-colors duration-150"
								>
									<TableCell className="font-semibold py-2.5">
										{row.bucket}
									</TableCell>
									<TableCell className="text-right tabular-nums py-2.5">
										{row.customers.toLocaleString("en-IN")}
									</TableCell>
									<TableCell className="text-right tabular-nums py-2.5">
										{pct(row.customerSharePct)}
									</TableCell>
									<TableCell className="text-right tabular-nums py-2.5">
										{money(row.revenue)}
									</TableCell>
									<TableCell className="text-right tabular-nums py-2.5">
										{pct(row.revenueSharePct)}
									</TableCell>
									<TableCell className="text-right tabular-nums py-2.5">
										{money(row.aov)}
									</TableCell>
									<TableCell className="text-right font-semibold tabular-nums py-2.5">
										{money(row.ltv)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
						<TableFooter className="bg-transparent border-t border-border/80">
							<TableRow className="hover:bg-transparent">
								<TableCell className="font-bold py-3">Total</TableCell>
								<TableCell className="text-right font-bold tabular-nums py-3">
									{totals.customers.toLocaleString("en-IN")}
								</TableCell>
								<TableCell className="text-right tabular-nums font-semibold py-3">
									100%
								</TableCell>
								<TableCell className="text-right font-bold tabular-nums py-3">
									{money(totals.revenue)}
								</TableCell>
								<TableCell className="text-right tabular-nums font-semibold py-3">
									100%
								</TableCell>
								<TableCell className="text-right py-3" />
								<TableCell className="text-right py-3" />
							</TableRow>
						</TableFooter>
					</Table>
				</div>

				{insights.length > 0 && (
					<div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs leading-relaxed mt-1">
						{insights.map((text) => (
							<div key={text} className="flex items-start gap-2.5">
								<Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
								<span className="text-muted-foreground">{text}</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
