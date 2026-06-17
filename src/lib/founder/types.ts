export interface FounderUploadBatch {
  id: number;
  filename: string;
  status: "success" | "failed";
  rowCount: number;
  errorCount: number;
  uploadedAt: string;
}

export interface FounderSalesFact {
  id: number;
  batchId: number;
  saleDate: string;
  billNo: string;
  store: string;
  category: string;
  brand: string;
  sku: string;
  productName: string;
  quantity: number;
  netAmount: number;
  customerId?: string | null;
  rowNumber: number;
}

export interface DashboardFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  store?: string;
  category?: string;
  brand?: string;
  sku?: string;
}

export interface FounderDashboardStatus {
  hasData: boolean;
  activeBatch?: FounderUploadBatch;
  minDate?: string;
  maxDate?: string;
  availableStores: string[];
  availableCategories: string[];
  availableBrands: string[];
}

export interface KpiMetrics {
  currentSales: number;
  previousSales: number;
  currentBillCuts: number;
  previousBillCuts: number;
  currentAov: number;
  previousAov: number;
  currentUnits: number;
  previousUnits: number;
  currentCustomers: number | null;
  previousCustomers: number | null;
}

export interface DashboardResponse {
  kpis: KpiMetrics;
  categoryPerformance: Array<{ category: string; sales: number; growth: number | null }>;
  brandPerformance: Array<{ brand: string; sales: number; growth: number | null }>;
  productPerformance: Array<{ sku: string; productName: string; sales: number; growth: number | null }>;
  topGainers: Array<{ name: string; type: "category" | "brand" | "sku"; delta: number; growth: number }>;
  topDecliners: Array<{ name: string; type: "category" | "brand" | "sku"; delta: number; growth: number }>;
}

export interface UploadRowError {
  rowNumber: number;
  errors: string[];
}

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  errorCount: number;
  errors: UploadRowError[];
  parsedData?: any[]; // The canonical array of rows ready for insert
}
