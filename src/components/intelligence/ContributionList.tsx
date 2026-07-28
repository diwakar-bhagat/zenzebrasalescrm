import { formatSignedPercent, growthTextClass } from "@/lib/growth-ui";

export interface ContributionRow {
	key: string;
	label: string;
	value: number | "NEW STORE" | null;
	/** Optional pre-formatted display for the value instead of a growth %. */
	displayValue?: string;
}

/**
 * Generic label/value row list — one renderer for store contribution, top
 * customers, category/brand/SKU movers, and anything else shaped like
 * "this thing, this number" across the explanation popovers.
 */
export function ContributionList({
	title,
	rows,
	emptyText = "No data",
}: {
	title: string;
	rows: ContributionRow[];
	emptyText?: string;
}) {
	return (
		<div className="rounded-lg border p-2.5">
			<p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
				{title}
			</p>
			<div className="space-y-1">
				{rows.length === 0 && (
					<p className="text-sm text-muted-foreground">{emptyText}</p>
				)}
				{rows.map((row) => (
					<div
						key={row.key}
						className="flex items-center justify-between text-sm"
					>
						<span className="truncate font-medium">{row.label}</span>
						<span
							className={
								row.displayValue
									? "text-muted-foreground shrink-0 pl-2"
									: `shrink-0 pl-2 ${
											typeof row.value === "number"
												? growthTextClass(row.value)
												: "text-muted-foreground"
										}`
							}
						>
							{row.displayValue ??
								(row.value === "NEW STORE"
									? "New store"
									: formatSignedPercent(row.value))}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
