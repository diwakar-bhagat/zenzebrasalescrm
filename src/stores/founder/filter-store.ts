import { create } from "zustand";

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);

  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
  };
}

interface FilterState {
  startDate: string;
  endDate: string;
  store: string;
  category: string;
  brand: string;
  sku: string;
  setStartDate: (startDate: string) => void;
  setEndDate: (endDate: string) => void;
  setDateRange: (startDate: string, endDate: string) => void;
  setStore: (store: string) => void;
  setCategory: (category: string) => void;
  setBrand: (brand: string) => void;
  setSku: (sku: string) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => {
  const range = defaultDateRange();

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    store: "All Stores",
    category: "All Categories",
    brand: "All Brands",
    sku: "",
    setStartDate: (startDate) => set({ startDate }),
    setEndDate: (endDate) => set({ endDate }),
    setDateRange: (startDate, endDate) => set({ startDate, endDate }),
    setStore: (store) => set({ store }),
    setCategory: (category) => set({ category }),
    setBrand: (brand) => set({ brand }),
    setSku: (sku) => set({ sku }),
    reset: () => {
      const nextRange = defaultDateRange();
      set({
        startDate: nextRange.startDate,
        endDate: nextRange.endDate,
        store: "All Stores",
        category: "All Categories",
        brand: "All Brands",
        sku: "",
      });
    },
  };
});
