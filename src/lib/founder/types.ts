export interface FounderUploadBatch {
  id: number;
  filename: string;
  status: "success" | "failed";
  rowCount: number;
  errorCount: number;
  validRowCount?: number;
  quarantinedRowCount?: number;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  uploadedAt: string;
}

export interface FounderSalesFact {
  id: number;
  batchId: number;
  saleDate: string;
  saleTime: string | null;
  billNo: string;
  billedBy: string;
  store: string;
  category: string;
  brand: string;
  sku: string;
  productName: string;
  quantity: number;
  netAmount: number;
  totalAmount: number;
  paymentMethod: string | null;
  sgst: number | null;
  cgst: number | null;
  igst: number | null;
  customerId?: string | null;
  customerName: string | null;
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

export interface CanonicalSalesRow {
  sale_date: string;
  sale_time: string | null;
  bill_no: string;
  billed_by: string;
  store: string;
  category: string;
  brand: string;
  sku: string;
  product_name: string;
  quantity: number;
  net_amount: number;
  total_amount: number;
  payment_method: string | null;
  sgst: number | null;
  cgst: number | null;
  igst: number | null;
  customer_id: string | null;
  customer_name: string | null;
  row_number: number;
}

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorCount: number;
  errors: UploadRowError[];
  validData: CanonicalSalesRow[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  parsedData?: CanonicalSalesRow[];
}
