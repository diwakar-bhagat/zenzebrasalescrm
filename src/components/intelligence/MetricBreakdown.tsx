import { formatSignedPercent, growthTextClass } from "@/lib/growth-ui";

export interface MetricBreakdownDriver {
	label: string;
	value: number | null;
}

/**
 * Generic growth-driver strip — the pattern originally inline in Sprint 1's
 * RootCauseCard (Revenue/Bills/AOV tiles), made reusable for any KPI's
 * explanation popover.
 */
export function MetricBreakdown({
	drivers,
}: {
	drivers: MetricBreakdownDriver[];
}) {
	return (
		<div className="grid gap-2 sm:grid-cols-3">
			{drivers.map((driver) => (
				<div key={driver.label} className="rounded-lg bg-muted/30 p-2.5">
					<p className="text-[11px] text-muted-foreground">{driver.label}</p>
					<p
						className={`mt-0.5 text-sm font-semibold ${growthTextClass(driver.value)}`}
					>
						{formatSignedPercent(driver.value)}
					</p>
				</div>
			))}
		</div>
	);
}
