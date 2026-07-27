import { create } from "zustand";
import { getDefaultPeriod } from "@/lib/business-logic/comparison";

interface FilterState {
	startDate: string;
	endDate: string;
	isDateFiltered: boolean;
	store: "ALL" | string;
	category: string;
	brand: string;
	sku: string;
	categoryScope: "all" | "retail";
	compareMode: "mirror" | "custom";
	compareStartDate: string;
	compareEndDate: string;
	setStartDate: (startDate: string) => void;
	setEndDate: (endDate: string) => void;
	setDateRange: (startDate: string, endDate: string) => void;
	setStore: (store: "ALL" | string) => void;
	setCategory: (category: string) => void;
	setBrand: (brand: string) => void;
	setSku: (sku: string) => void;
	setCategoryScope: (categoryScope: "all" | "retail") => void;
	setCompareMode: (compareMode: "mirror" | "custom") => void;
	setCompareStartDate: (compareStartDate: string) => void;
	setCompareEndDate: (compareEndDate: string) => void;
	setCompareDateRange: (
		compareStartDate: string,
		compareEndDate: string,
	) => void;
	/** Compat shim for sales page — sets the full data date range */
	setDataBounds: (minDate: string, maxDate: string) => void;
	reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => {
	const range = getDefaultPeriod();

	return {
		startDate: range.current.startDate,
		endDate: range.current.endDate,
		isDateFiltered: false,
		store: "ALL",
		category: "All Categories",
		brand: "All Brands",
		sku: "",
		categoryScope: "all",
		compareMode: "mirror",
		compareStartDate: range.previous.startDate,
		compareEndDate: range.previous.endDate,
		setStartDate: (startDate) => set({ startDate, isDateFiltered: true }),
		setEndDate: (endDate) => set({ endDate, isDateFiltered: true }),
		setDateRange: (startDate, endDate) =>
			set({ startDate, endDate, isDateFiltered: true }),
		setStore: (store) => set({ store }),
		setCategory: (category) => set({ category }),
		setBrand: (brand) => set({ brand }),
		setSku: (sku) => set({ sku }),
		setCategoryScope: (categoryScope) => set({ categoryScope }),
		setCompareMode: (compareMode) => set({ compareMode }),
		setCompareStartDate: (compareStartDate) => set({ compareStartDate }),
		setCompareEndDate: (compareEndDate) => set({ compareEndDate }),
		setCompareDateRange: (compareStartDate, compareEndDate) =>
			set({ compareStartDate, compareEndDate }),
		setDataBounds: (minDate, maxDate) =>
			set({ startDate: minDate, endDate: maxDate, isDateFiltered: false }),
		reset: () => {
			const nextRange = getDefaultPeriod();
			set({
				startDate: nextRange.current.startDate,
				endDate: nextRange.current.endDate,
				isDateFiltered: false,
				store: "ALL",
				category: "All Categories",
				brand: "All Brands",
				sku: "",
				categoryScope: "all",
				compareMode: "mirror",
				compareStartDate: nextRange.previous.startDate,
				compareEndDate: nextRange.previous.endDate,
			});
		},
	};
});

// Explicit export for Turbopack dev-server module resolution
export default useFilterStore;
