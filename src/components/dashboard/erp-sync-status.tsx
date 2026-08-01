"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertCircle, Server } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SyncHealth, SyncMode } from "@/lib/erp/sync-health";

/**
 * ERP connection status for the dashboard header.
 *
 * Replaces the upload-age badge. It reports the pipeline's real state: "LIVE" appears only
 * when a webhook has actually been delivered recently, and metrics that cannot yet be measured
 * are shown as pending rather than filled with plausible-looking numbers.
 */

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const MODE_PRESENTATION: Record<
	SyncMode,
	{ label: string; variant: BadgeVariant; dot: string; summary: string }
> = {
	live: {
		label: "Live",
		variant: "outline",
		dot: "bg-emerald-500",
		summary: "Odoo is streaming sales as they happen.",
	},
	scheduled: {
		label: "Synced",
		variant: "outline",
		dot: "bg-sky-500",
		summary:
			"No recent webhook. Data is arriving from the once-daily scheduled pull.",
	},
	delayed: {
		label: "Delayed",
		variant: "secondary",
		dot: "bg-amber-500",
		summary: "Data is behind. Deliveries are failing or the last pull is late.",
	},
	offline: {
		label: "Offline",
		variant: "destructive",
		dot: "bg-destructive",
		summary: "No data has arrived from Odoo. The connection needs attention.",
	},
};

function relative(iso: string | null): string {
	if (!iso) return "never";
	try {
		return `${formatDistanceToNowStrict(new Date(iso))} ago`;
	} catch {
		return "unknown";
	}
}

/** One label/value pair. Values that are not yet measurable read as muted placeholder text. */
function Metric({
	label,
	value,
	hint,
	pending,
}: {
	label: string;
	value: string;
	hint?: string;
	pending?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-1.5">
			<span className="text-muted-foreground text-sm">{label}</span>
			{hint ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<span
							className={`text-sm tabular-nums ${pending ? "text-muted-foreground italic" : "font-medium"}`}
						>
							{value}
						</span>
					</TooltipTrigger>
					<TooltipContent className="max-w-64">{hint}</TooltipContent>
				</Tooltip>
			) : (
				<span
					className={`text-sm tabular-nums ${pending ? "text-muted-foreground italic" : "font-medium"}`}
				>
					{value}
				</span>
			)}
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
				{title}
			</h3>
			<div className="divide-border/60 divide-y">{children}</div>
		</div>
	);
}

export function ErpSyncStatus() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ["sync-health"],
		queryFn: async (): Promise<SyncHealth> => {
			const res = await fetch("/api/system/sync-health");
			const json = await res.json();
			if (!json.success) throw new Error(json.error ?? "Request failed");
			return json.data;
		},
		refetchInterval: 30_000,
		staleTime: 15_000,
	});

	if (isLoading) return <Skeleton className="h-5 w-24 rounded-4xl" />;

	if (isError || !data) {
		return (
			<Badge variant="destructive" className="gap-1.5">
				<Server className="size-3" />
				Status unavailable
			</Badge>
		);
	}

	const presentation = MODE_PRESENTATION[data.mode];
	const lastActivity = data.webhook.lastSuccessAt ?? data.data.lastIngestedAt;

	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={`ERP status: ${presentation.label}. Open sync details.`}
					className="rounded-4xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<Badge variant={presentation.variant} className="gap-1.5">
						<span
							aria-hidden
							className={`size-1.5 rounded-full ${presentation.dot}`}
						/>
						{presentation.label}
					</Badge>
				</button>
			</SheetTrigger>

			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<Server className="text-muted-foreground size-4" />
						{data.erp.name}
					</SheetTitle>
					<SheetDescription>{presentation.summary}</SheetDescription>
				</SheetHeader>

				<div className="space-y-5 px-4 pb-6">
					{data.webhook.lastError && (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertTitle>Last delivery error</AlertTitle>
							<AlertDescription className="break-words">
								{data.webhook.lastError}
							</AlertDescription>
						</Alert>
					)}

					{!data.webhook.secretConfigured && (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertTitle>Webhook endpoint is unauthenticated</AlertTitle>
							<AlertDescription>
								ODOO_WEBHOOK_SECRET is not set, so deliveries are rejected.
								Configure it in Odoo and in the server environment.
							</AlertDescription>
						</Alert>
					)}

					<Section title="Data">
						<Metric label="Last transaction" value={relative(lastActivity)} />
						<Metric
							label="Latest sale date"
							value={data.data.latestSaleDate ?? "—"}
						/>
						<Metric
							label="Rows today"
							value={data.data.rowsToday.toLocaleString("en-IN")}
						/>
						<Metric
							label="Total rows"
							value={data.data.totalRows.toLocaleString("en-IN")}
						/>
					</Section>

					<Separator />

					<Section title="Reflection time">
						{data.reflection ? (
							<>
								<Metric
									label="Median"
									value={`${data.reflection.p50Ms} ms`}
									hint="Time from Odoo recording the sale to the row being queryable here."
								/>
								<Metric
									label="95th percentile"
									value={`${data.reflection.p95Ms} ms`}
								/>
								<Metric
									label="Sample"
									value={`${data.reflection.sampleSize} events (24h)`}
								/>
							</>
						) : (
							<Metric
								label="Median"
								value="awaiting first webhook"
								pending
								hint="Reflection time is measured from real deliveries. No webhook events have been recorded in the last 24 hours, so there is nothing to average yet."
							/>
						)}
						{data.sla ? (
							<Metric
								label={`Within ${data.sla.targetMs / 1000}s`}
								value={`${data.sla.metPct}%`}
								hint={`SLA ${data.sla.state} over ${data.sla.sampleSize} events.`}
							/>
						) : (
							<Metric
								label="SLA"
								value={
									data.reflection ? "collecting data" : "no events measured"
								}
								pending
								hint="An SLA percentage is only shown once at least 20 events have been measured; below that a single delivery would read as 0% or 100%."
							/>
						)}
					</Section>

					<Separator />

					<Section title="Webhook">
						<Metric
							label="Last delivery"
							value={relative(data.webhook.lastEventAt)}
						/>
						<Metric
							label="Events today"
							value={String(data.webhook.eventsToday)}
						/>
						<Metric
							label="Success rate (24h)"
							value={
								data.webhook.successRate24h === null
									? "no deliveries"
									: `${data.webhook.successRate24h}%`
							}
							pending={data.webhook.successRate24h === null}
						/>
						<Metric
							label="Failures (24h)"
							value={String(data.webhook.failures24h)}
						/>
					</Section>

					<Separator />

					<Section title="Scheduled pull">
						<Metric
							label="Last run"
							value={relative(data.sync.lastSuccessAt)}
							hint="Runs once daily. On Vercel's Hobby plan this is the maximum cron frequency, so it is a safety net rather than a real-time fallback."
						/>
						<Metric
							label="Records last run"
							value={String(data.sync.recordsLastRun)}
						/>
						{data.sync.consecutiveFailures > 0 && (
							<Metric
								label="Consecutive failures"
								value={String(data.sync.consecutiveFailures)}
							/>
						)}
					</Section>

					<Separator />

					<Section title="Stores">
						{data.stores.map((store) => (
							<Metric
								key={store.name}
								label={store.name}
								value={store.lastSaleDate ?? "no data"}
								hint={`${store.rowsLast7Days.toLocaleString("en-IN")} rows in the last 7 days.`}
							/>
						))}
					</Section>

					<Separator />

					<Section title="System">
						<Metric label="Query latency" value={`${data.apiLatencyMs} ms`} />
						<Metric
							label="Odoo API"
							value={data.erp.configured ? "configured" : "not configured"}
							pending={!data.erp.configured}
							hint={
								data.erp.configured
									? undefined
									: "ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_PASSWORD are unset, so thin webhook notifications cannot be hydrated."
							}
						/>
					</Section>
				</div>
			</SheetContent>
		</Sheet>
	);
}
