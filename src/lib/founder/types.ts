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
	uploadType?: "full_replace" | "incremental";
	latestSaleDate?: string | null;
	storesFound?: string[];
	categoriesFound?: string[];
	netSales?: number;
}

export interface FounderSalesFact {
	id: number;
	uploadId: number;
	saleDate: string;
	billNo: string;
	billedBy: string;
	productKey: string;
	category: string | null;
	brand: string | null;
	skuCode: string | null;
	itemName: string;
	quantity: number;
	mrpAmount: number;
	discountAmount: number;
	grossAmount: number;
	taxAmount: number;
	netAmount: number;
	paymentMethod: string | null;
	customerMobile: string | null;
	customerName: string | null;
}

export const STORE_WHITELIST = ["SmartworksNoida Noida", "Klj store"] as const;
export type StoreWhitelistValue = (typeof STORE_WHITELIST)[number];

export interface DashboardFilters {
	startDate: string;
	endDate: string;
	store?: string;
	category?: string;
	brand?: string;
	sku?: string;
	categoryScope?: "all" | "retail";
	compareMode?: "mirror" | "custom";
	compareStartDate?: string;
	compareEndDate?: string;
}

export interface FounderDashboardStatus {
	hasData: boolean;
	activeBatch?: FounderUploadBatch;
	minDate?: string;
	maxDate?: string;
	availableStores: string[];
	availableCategories: string[];
	availableBrands: string[];
	categoryBrandMap?: Record<string, string[]>;
	dataFreshness?: {
		latestSaleDate: string | null;
		daysStale: number | null;
		totalBills: number;
		totalRevenue: number;
		lastUploadAt: string | null;
	};
}

export interface UploadRowError {
	rowNumber: number;
	errors: string[];
}

export interface ParsedSalesRow {
	bill_no: string;
	sale_date: string;
	billed_by: string;
	product_key: string;
	sku_code: string | null;
	item_name: string;
	brand: string | null;
	category: string | null;
	quantity: number;
	mrp_amount: number;
	discount_amount: number;
	gross_amount: number;
	tax_amount: number;
	net_amount: number;
	customer_mobile: string | null;
	customer_name: string | null;
	payment_method: string | null;
	source_billed_by?: string;
	store_id?: number;
}

/** Legacy CSV/header-alias upload shape */
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
	validData: ParsedSalesRow[];
	dateRange: {
		start: string | null;
		end: string | null;
	};
	latestSaleDate?: string | null;
	quarantineReasons?: string[];
	normalizationReport?: Record<
		string,
		{
			displayName: string;
			rawSourcesCount: Record<string, number>;
			totalRows: number;
		}
	>;
}

export interface LegacyValidationResult {
	isValid: boolean;
	totalRows: number;
	validRows: number;
	errorCount: number;
	errors: UploadRowError[];
	validData: CanonicalSalesRow[];
	dateRange: { start: string | null; end: string | null };
	parsedData?: CanonicalSalesRow[];
}
