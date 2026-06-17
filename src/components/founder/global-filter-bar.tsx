"use client";

import { useFilterStore } from "@/stores/founder/filter-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GlobalFilterBarProps {
  availableStores: string[];
  availableCategories: string[];
  availableBrands: string[];
}

export function GlobalFilterBar({
  availableStores,
  availableCategories,
  availableBrands
}: GlobalFilterBarProps) {
  const { 
    days, store, category, brand, sku, 
    setDays, setStore, setCategory, setBrand, setSku, reset 
  } = useFilterStore();

  const hasActiveFilters = 
    days !== "30" || 
    store !== "All Stores" || 
    category !== "All Categories" || 
    brand !== "All Brands" || 
    sku !== "";

  return (
    <div className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-2">
          <Filter className="size-4" />
          <span>Global Filters</span>
        </div>

        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Time Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
            <SelectItem value="365">Last Year</SelectItem>
          </SelectContent>
        </Select>

        <Select value={store} onValueChange={setStore}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Stores">All Stores</SelectItem>
            {availableStores.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Categories">All Categories</SelectItem>
            {availableCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Brands">All Brands</SelectItem>
            {availableBrands.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input 
          placeholder="Search SKU..." 
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-[180px] h-9"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-9 px-2 text-muted-foreground hover:text-foreground">
            <X className="size-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
