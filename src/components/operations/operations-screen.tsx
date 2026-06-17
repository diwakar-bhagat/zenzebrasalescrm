"use client";

import { Box, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

type OperationsMode =
	| "merchant"
	| "task-manager"
	| "material-requisition"
	| "fabric-working"
	| "design-gallery"
	| "notifications"
	| "sample-create"
	| "sample-assign"
	| "sampling-status"
	| "sample-tracking"
	| "style-repository"
	| "style-databank"
	| "inventory"
	| "production"
	| "suppliers"
	| "costing"
	| "generic";

type OperationsScreenProps = {
	mode: OperationsMode;
	title?: string;
	description?: string;
};

const MODE_TITLES: Record<OperationsMode, string> = {
	merchant: "Dashboard",
	"task-manager": "Task Manager",
	"material-requisition": "Material Requisition",
	"fabric-working": "Fabric Working",
	"design-gallery": "Design Gallery",
	notifications: "Notifications",
	"sample-create": "Sample Create",
	"sample-assign": "Sample Assign",
	"sampling-status": "Sampling Status",
	"sample-tracking": "Sample Tracking",
	"style-repository": "Style Repository",
	"style-databank": "Style Databank",
	inventory: "Inventory",
	production: "Production",
	suppliers: "Suppliers",
	costing: "Costing",
	generic: "Module",
};

export function OperationsScreen({
	mode,
	title,
	description,
}: OperationsScreenProps) {
	const screenTitle = title ?? MODE_TITLES[mode];
	const screenDescription =
		description ?? "This module is ready for configuration.";

	return (
		<div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-1">
					<h1 className="font-semibold text-2xl tracking-tight">
						{screenTitle}
					</h1>
					<p className="text-muted-foreground text-sm">{screenDescription}</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="relative">
						<Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
						<Input className="w-64 pl-8" placeholder="Search" disabled />
					</div>
					<Button variant="outline" disabled>
						Configure
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{screenTitle}</CardTitle>
					<CardDescription>{screenDescription}</CardDescription>
				</CardHeader>
				<CardContent>
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Box />
							</EmptyMedia>
							<EmptyTitle>No data configured</EmptyTitle>
							<EmptyDescription>
								Connect a data source or configure this module to begin.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button variant="outline" disabled>
								No action available
							</Button>
						</EmptyContent>
					</Empty>
				</CardContent>
			</Card>
		</div>
	);
}
