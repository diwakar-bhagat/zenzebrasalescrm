"use client";

import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilterStore } from "@/stores/founder/filter-store";

interface GlobalFilterBarProps {
  availableStores: string[];
  availableCategories: string[];
  availableBrands: string[];
  maxDate?: string;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: string, maxDate?: string) {
  const anchorDate = maxDate ? new Date(`${maxDate}T00:00:00.000Z`) : new Date();
  const end = anchorDate;
  const start = new Date(end);

  if (preset === "today") {
    return { startDate: toISODate(end), endDate: toISODate(end) };
  }

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

export function GlobalFilterBar({ availableStores, availableCategories, availableBrands, maxDate }: GlobalFilterBarProps) {
  const {
    startDate,
    endDate,
    store,
    category,
    brand,
    sku,
    setStartDate,
    setEndDate,
    setDateRange,
    setStore,
    setCategory,
    setBrand,
    setSku,
    reset,
  } = useFilterStore();

  const hasActiveFilters =
    store !== "All Stores" || category !== "All Categories" || brand !== "All Brands" || sku !== "";

  return (
    <div className="sticky top-0 z-40 mb-6 w-full border-b bg-background/95 pt-4 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-2 flex items-center gap-2 font-medium text-muted-foreground text-sm">
          <Filter className="size-4" />
          <span>Global Filters</span>
        </div>

        <Select
          onValueChange={(value) => {
            const range = getPresetRange(value, maxDate);
            setDateRange(range.startDate, range.endDate);
          }}
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Quick range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="last7">Last 7 Days</SelectItem>
            <SelectItem value="last30">Last 30 Days</SelectItem>
            <SelectItem value="thisMonth">This Month</SelectItem>
          </SelectContent>
        </Select>

        <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 w-[150px]" />
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 w-[150px]" />

        <Select value={store} onValueChange={setStore}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Stores">All Stores</SelectItem>
            {availableStores.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Categories">All Categories</SelectItem>
            {availableCategories.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Brands">All Brands</SelectItem>
            {availableBrands.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search SKU..."
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          className="h-9 w-[180px]"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-9 px-2 text-muted-foreground hover:text-foreground">
            <X className="mr-1 size-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
