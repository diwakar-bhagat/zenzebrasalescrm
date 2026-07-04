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
	if (isAnchor)
		return "bg-muted/60 font-bold border-l-2 border-primary/45 rounded-l-md";
	if (retentionPct >= 50)
		return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold rounded-md border border-emerald-500/10 hover:bg-emerald-500/30 transition-colors";
	if (retentionPct >= 25)
		return "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold rounded-md border border-amber-500/10 hover:bg-amber-500/25 transition-colors";
	if (retentionPct > 0)
		return "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold rounded-md border border-rose-500/10 hover:bg-rose-500/25 transition-colors";
	return "bg-muted/20 text-muted-foreground/60 rounded-md border border-transparent";
}

export function RetentionCohortTable({ cohort }: Props) {
	const { cohorts, monthOffsets } = cohort;

	if (cohorts.length === 0) {
		return (
			<Card className="transition-all duration-300 hover:border-foreground/20">
				<CardHeader className="pb-3">
					<CardTitle className="font-semibold text-lg">
						Customer Retention Cohorts
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<p className="text-muted-foreground text-xs">
						No identified customers in this range yet. Retention needs customers
						with a mobile number or name.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]">
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-lg">
					Customer Retention Cohorts
				</CardTitle>
				<p className="text-muted-foreground text-xs leading-relaxed">
					Each row is an acquisition month. Cells show the % of that cohort
					still purchasing in later months (identified customers only).
				</p>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="overflow-x-auto rounded-lg border border-border/60">
					<Table className="border-collapse">
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="sticky left-0 bg-card font-semibold text-xs uppercase tracking-wider h-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] z-10">
									Cohort
								</TableHead>
								<TableHead className="text-right font-semibold text-xs uppercase tracking-wider h-10 px-4">
									New
								</TableHead>
								{monthOffsets.map((offset) => (
									<TableHead
										key={offset}
										className="text-center font-semibold text-xs uppercase tracking-wider h-10 px-2 min-w-14"
									>
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
									<TableRow key={row.cohortMonth} className="hover:bg-muted/10">
										<TableCell className="sticky left-0 bg-card font-semibold text-xs py-2.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] z-10 border-r border-border/20">
											{monthLabel(row.cohortMonth)}
										</TableCell>
										<TableCell className="text-right tabular-nums py-2.5 px-4 font-semibold text-xs border-r border-border/20">
											{row.cohortSize}
										</TableCell>
										{monthOffsets.map((offset) => {
											const cell = byOffset.get(offset);
											if (!cell) {
												return (
													<TableCell
														key={offset}
														className="text-center text-muted-foreground/30 py-2.5 px-2 text-xs"
													>
														·
													</TableCell>
												);
											}
											return (
												<TableCell
													key={offset}
													className="text-center py-2 px-1 text-xs"
												>
													<div
														className={`py-1.5 px-1 tabular-nums cursor-default ${cellClass(
															cell.retentionPct,
															offset === 0,
														)}`}
														title={`${cell.activeCustomers} customers · ${money(
															cell.revenue,
														)} · AOV ${money(cell.aov)}`}
													>
														{cell.retentionPct}%
													</div>
												</TableCell>
											);
										})}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
