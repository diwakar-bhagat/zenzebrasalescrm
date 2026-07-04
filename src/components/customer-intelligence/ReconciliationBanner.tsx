import { AlertTriangle } from "lucide-react";

import type { ReconciliationReport } from "@/types/customer-intelligence";

/**
 * Surfaces a loud warning when any revenue partition fails to reconcile.
 * Numbers are never silently wrong — a founder sees the discrepancy instead.
 */
export function ReconciliationBanner({
	report,
}: {
	report: ReconciliationReport;
}) {
	if (report.ok) return null;

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
			<div className="flex items-center gap-2 font-bold">
				<AlertTriangle className="size-4 shrink-0" />
				Revenue reconciliation failed — figures may be inconsistent
			</div>
			<ul className="list-inside list-disc space-y-1 pl-1 text-xs">
				{report.warnings.map((w) => (
					<li key={w}>{w}</li>
				))}
			</ul>
		</div>
	);
}
