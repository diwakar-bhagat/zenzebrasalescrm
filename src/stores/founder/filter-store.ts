import { create } from "zustand";

interface FilterState {
  days: string;
  store: string;
  category: string;
  brand: string;
  sku: string;
  setDays: (days: string) => void;
  setStore: (store: string) => void;
  setCategory: (category: string) => void;
  setBrand: (brand: string) => void;
  setSku: (sku: string) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  days: "30",
  store: "All Stores",
  category: "All Categories",
  brand: "All Brands",
  sku: "",
  setDays: (days) => set({ days }),
  setStore: (store) => set({ store }),
  setCategory: (category) => set({ category }),
  setBrand: (brand) => set({ brand }),
  setSku: (sku) => set({ sku }),
  reset: () => set({
    days: "30",
    store: "All Stores",
    category: "All Categories",
    brand: "All Brands",
    sku: ""
  })
}));
