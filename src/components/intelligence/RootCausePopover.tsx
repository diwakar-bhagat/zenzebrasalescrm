"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The "ⓘ Explain" trigger used on any KPI card — wraps the existing Popover
 * primitive so every explanation panel opens the same way.
 */
export function RootCausePopover({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="size-6 text-muted-foreground hover:text-foreground"
					aria-label={`Explain ${title}`}
				>
					<Info className="size-3.5" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 sm:w-96" align="end">
				<PopoverHeader>
					<PopoverTitle>Why did {title.toLowerCase()} move?</PopoverTitle>
				</PopoverHeader>
				{children}
			</PopoverContent>
		</Popover>
	);
}
