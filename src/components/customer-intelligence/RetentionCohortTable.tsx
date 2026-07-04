import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	RetentionCohortCell,
	RetentionCohortResult,
} from "@/types/customer-intelligence";

import { money, monthLabel } from "./format";

interface Props {
	cohort: RetentionCohortResult;
}

/** Heatmap colour for a retention percentage. Month 0 is always the anchor. */
function cellClass(retentionPct: number, isAnchor: boolean): string {
	if (isAnchor) return "bg-foreground/10 font-semibold";
	if (retentionPct >= 50)
		return "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300";
	if (retentionPct >= 25)
		return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
	if (retentionPct > 0)
		return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
	return "bg-muted/30 text-muted-foreground";
}

export function RetentionCohortTable({ cohort }: Props) {
	const { cohorts, monthOffsets } = cohort;

	if (cohorts.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Customer Retention Cohorts</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No identified customers in this range yet. Retention needs customers
						with a mobile number or name.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Customer Retention Cohorts</CardTitle>
				<p className="text-muted-foreground text-sm">
					Each row is an acquisition month. Cells show the % of that cohort
					still purchasing in later months (identified customers only).
				</p>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="sticky left-0 bg-card">Cohort</TableHead>
							<TableHead className="text-right">New</TableHead>
							{monthOffsets.map((offset) => (
								<TableHead key={offset} className="text-center">
									M{offset}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{cohorts.map((row) => {
							const byOffset = new Map<number, RetentionCohortCell>();
							for (const cell of row.cells)
								byOffset.set(cell.monthOffset, cell);
							return (
								<TableRow key={row.cohortMonth}>
									<TableCell className="sticky left-0 bg-card font-medium">
										{monthLabel(row.cohortMonth)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{row.cohortSize}
									</TableCell>
									{monthOffsets.map((offset) => {
										const cell = byOffset.get(offset);
										if (!cell) {
											return (
												<TableCell
													key={offset}
													className="text-center text-muted-foreground/40"
												>
													·
												</TableCell>
											);
										}
										return (
											<TableCell
												key={offset}
												className={`text-center tabular-nums ${cellClass(
													cell.retentionPct,
													offset === 0,
												)}`}
												title={`${cell.activeCustomers} customers · ${money(
													cell.revenue,
												)} · AOV ${money(cell.aov)}`}
											>
												{cell.retentionPct}%
											</TableCell>
										);
									})}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
