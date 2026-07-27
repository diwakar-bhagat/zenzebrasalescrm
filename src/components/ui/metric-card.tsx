import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { tokens } from "@/styles/tokens";

interface MetricCardProps extends React.ComponentProps<"div"> {
	title: string;
	value: string | number;
	growth?: number | null;
	comparisonLabel?: string;
	icon?: LucideIcon;
	suffix?: string;
}

export function MetricCard({
	title,
	value,
	growth,
	comparisonLabel,
	icon: Icon,
	suffix,
	className,
	...props
}: MetricCardProps) {
	const isPositive = growth !== undefined && growth !== null && growth >= 0;
	const isNegative = growth !== undefined && growth !== null && growth < 0;

	return (
		<div
			className={cn(
				tokens.effects.glass,
				tokens.effects.glassHover,
				tokens.radius.lg,
				"flex flex-col gap-2 p-5 transition-all duration-300",
				className,
			)}
			{...props}
		>
			<div className="flex items-center justify-between">
				<span className={tokens.typography.kpiLabel}>
					{title}
				</span>
				{Icon && (
					<div className="p-2 rounded-lg bg-white/5 border border-white/5 text-zinc-300">
						<Icon className="size-4" />
					</div>
				)}
			</div>

			<div className="flex items-baseline gap-1 mt-1">
				<span className="text-2xl font-bold tracking-tight text-foreground">
					{value}
				</span>
				{suffix && (
					<span className="text-xs font-medium text-muted-foreground ml-0.5">
						{suffix}
					</span>
				)}
			</div>

			{growth !== undefined && growth !== null && (
				<div className="flex items-center gap-1.5 mt-1 text-xs">
					<span
						className={cn(
							"flex items-center font-semibold gap-0.5 rounded px-1.5 py-0.5",
							isPositive && "bg-emerald-500/10 text-emerald-500",
							isNegative && "bg-rose-500/10 text-rose-500",
							growth === 0 && "bg-gray-500/10 text-gray-500",
						)}
					>
						{isPositive && <ArrowUpRight className="size-3 shrink-0" />}
						{isNegative && <ArrowDownRight className="size-3 shrink-0" />}
						{growth >= 0 ? `+${Math.abs(growth)}%` : `-${Math.abs(growth)}%`}
					</span>
					{comparisonLabel && (
						<span className="text-muted-foreground/60">{comparisonLabel}</span>
					)}
				</div>
			)}
		</div>
	);
}
