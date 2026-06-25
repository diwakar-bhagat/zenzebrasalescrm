"use client";

import { Filter, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useFilterStore } from "@/stores/founder/filter-store";

export function formatStoreName(name: string): string {
	if (name === "Klj store") return "KLJ";
	if (name === "SmartworksNoida Noida") return "Smart Works Noida";
	if (name === "Head office" || name === "Head Office") return "Head office";
	return name
		.replace(/([A-Z])/g, " $1")
		.replace(/[_-]/g, " ")
		.trim()
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

interface GlobalFilterBarProps {
	availableStores?: string[];
	availableCategories: string[];
	availableBrands: string[];
	categoryBrandMap?: Record<string, string[]>;
	skuName?: string | null;
}

function toISODate(date: Date) {
	return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: string) {
	const end = new Date();
	const start = new Date(end);
	if (preset === "today")
		return { startDate: toISODate(end), endDate: toISODate(end) };
	if (preset === "last7") {
		start.setUTCDate(start.getUTCDate() - 6);
		return { startDate: toISODate(start), endDate: toISODate(end) };
	}
	if (preset === "thisMonth") {
		start.setUTCDate(1);
		return { startDate: toISODate(start), endDate: toISODate(end) };
	}
	start.setUTCDate(start.getUTCDate() - 29);
	return { startDate: toISODate(start), endDate: toISODate(end) };
}

export function GlobalFilterBar({
	availableStores = [],
	availableCategories,
	availableBrands,
	categoryBrandMap = {},
	skuName,
}: GlobalFilterBarProps) {
	const {
		startDate,
		endDate,
		store,
		category,
		brand,
		sku,
		categoryScope,
		compareMode,
		compareStartDate,
		compareEndDate,
		setStartDate,
		setEndDate,
		setDateRange,
		setStore,
		setCategory,
		setBrand,
		setSku,
		setCategoryScope,
		setCompareMode,
		setCompareStartDate,
		setCompareEndDate,
		reset,
	} = useFilterStore();

	// Reset selected brand if it is not valid for the newly selected category
	useEffect(() => {
		if (
			category &&
			category !== "All Categories" &&
			brand &&
			brand !== "All Brands"
		) {
			const validBrands = categoryBrandMap[category] || [];
			if (!validBrands.includes(brand)) {
				setBrand("All Brands");
			}
		}
	}, [category, brand, categoryBrandMap, setBrand]);

	const hasActiveFilters =
		store !== "ALL" ||
		category !== "All Categories" ||
		brand !== "All Brands" ||
		sku !== "" ||
		categoryScope !== "all" ||
		compareMode !== "mirror";

	// Filter available brands based on the selected category
	const filteredBrands =
		category && category !== "All Categories"
			? categoryBrandMap[category] || []
			: availableBrands;

	return (
		<div className="sticky top-0 z-40 mb-6 w-full border-b bg-background/95 pt-4 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex flex-col gap-4">
				{/* Row 1: Time Filters (Analysis Period vs Compare Against) */}
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex items-center gap-2 font-medium text-muted-foreground text-sm mr-2 shrink-0">
						<Filter className="size-4" />
						<span>Global Filters</span>
					</div>

					{/* Analysis Period Box */}
					<div className="flex items-center gap-2 border bg-muted/20 p-1 px-3 rounded-lg text-sm">
						<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 border-r pr-2 mr-1">
							Analysis Period
						</span>
						<Select
							onValueChange={(value) => {
								const range = getPresetRange(value);
								setDateRange(range.startDate, range.endDate);
							}}
						>
							<SelectTrigger className="h-7 w-[110px] border-0 bg-transparent p-0 shadow-none focus:ring-0 text-xs">
								<SelectValue placeholder="Quick range" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="today">Today</SelectItem>
								<SelectItem value="last7">Last 7 Days</SelectItem>
								<SelectItem value="last30">Last 30 Days</SelectItem>
								<SelectItem value="thisMonth">This Month</SelectItem>
							</SelectContent>
						</Select>
						<Input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="h-7 w-[120px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs font-medium"
						/>
						<span className="text-muted-foreground text-xs shrink-0">→</span>
						<Input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="h-7 w-[120px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs font-medium"
						/>
					</div>

					{/* Compare Against Box */}
					<div className="flex items-center gap-2 border bg-muted/20 p-1 px-3 rounded-lg text-sm">
						<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 border-r pr-2 mr-1">
							Compare Against
						</span>
						<Select
							value={compareMode}
							onValueChange={(v) => setCompareMode(v as "mirror" | "custom")}
						>
							<SelectTrigger className="h-7 w-[150px] border-0 bg-transparent p-0 shadow-none focus:ring-0 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="mirror">vs Previous Period</SelectItem>
								<SelectItem value="custom">vs Custom Period</SelectItem>
							</SelectContent>
						</Select>
						{compareMode === "custom" && (
							<>
								<Input
									type="date"
									value={compareStartDate}
									onChange={(e) => setCompareStartDate(e.target.value)}
									className="h-7 w-[120px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs font-medium"
								/>
								<span className="text-muted-foreground text-xs shrink-0">
									→
								</span>
								<Input
									type="date"
									value={compareEndDate}
									onChange={(e) => setCompareEndDate(e.target.value)}
									className="h-7 w-[120px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs font-medium"
								/>
							</>
						)}
					</div>
				</div>

				{/* Row 2: Dimension Filters */}
				<div className="flex flex-wrap items-center gap-3 border-t pt-3">
					<Select value={store} onValueChange={setStore}>
						<SelectTrigger className="h-9 w-[150px]">
							<SelectValue placeholder="Store" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">All Stores</SelectItem>
							{availableStores.map((storeName) => (
								<SelectItem key={storeName} value={storeName}>
									{formatStoreName(storeName)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={categoryScope}
						onValueChange={(v) => setCategoryScope(v as "all" | "retail")}
					>
						<SelectTrigger className="h-9 w-[130px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All categories</SelectItem>
							<SelectItem value="retail">Retail only</SelectItem>
						</SelectContent>
					</Select>

					<Select value={category} onValueChange={setCategory}>
						<SelectTrigger className="h-9 w-[150px]">
							<SelectValue placeholder="Category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="All Categories">All Categories</SelectItem>
							{availableCategories.map((value) => (
								<SelectItem key={value} value={value}>
									{value === "LIVE MENU" ? "(Live menu)" : value}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={brand} onValueChange={setBrand}>
						<SelectTrigger className="h-9 w-[150px]">
							<SelectValue placeholder="Brand" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="All Brands">All Brands</SelectItem>
							{filteredBrands.map((value) => (
								<SelectItem key={value} value={value}>
									{value}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div className="flex items-center gap-2 shrink-0">
						<Input
							placeholder="Search SKU or Name..."
							value={sku}
							onChange={(e) => setSku(e.target.value)}
							className="h-9 w-[180px]"
						/>
						{sku && skuName && (
							<span
								className="text-xs font-bold text-foreground bg-muted border px-2.5 py-1 rounded max-w-[220px] truncate"
								title={skuName}
							>
								{skuName}
							</span>
						)}
					</div>

					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={reset}
							className="h-9 px-2 text-muted-foreground hover:text-foreground"
						>
							<X className="mr-1 size-4" />
							Clear All
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
