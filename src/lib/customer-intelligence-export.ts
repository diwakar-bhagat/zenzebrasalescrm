import * as XLSX from "xlsx";
import type { CustomerIntelligenceData } from "@/types/customer-intelligence";

export function exportCustomerIntelligenceExcel(
	data: CustomerIntelligenceData,
	storeName = "AllStores",
	dateRangeStr = "CurrentPeriod",
) {
	const nowStr = new Date().toLocaleString();

	// Extract Summary Cards
	const cards = data.revenueComposition.cards || [];
	const totalCard = cards.find((c) => c.key === "total");
	const repeatCard = cards.find((c) => c.key === "repeat");
	const newCard = cards.find((c) => c.key === "new");

	// --- SHEET 1: SUMMARY ---
	const summaryRows = [
		{ Field: "Report Name", Value: "Customer Intelligence Executive Summary" },
		{ Field: "Store", Value: storeName },
		{ Field: "Time Period", Value: dateRangeStr },
		{ Field: "Generated At", Value: nowStr },
		{ Field: "", Value: "" }, // Blank row
		{ Field: "Total Customers", Value: totalCard ? totalCard.customers : 0 },
		{ Field: "Total Revenue (₹)", Value: totalCard ? totalCard.revenue : 0 },
		{ Field: "Total Bills", Value: totalCard ? totalCard.bills : 0 },
		{ Field: "Total AOV (₹)", Value: totalCard ? totalCard.aov : 0 },
		{ Field: "", Value: "" },
		{ Field: "Repeat Customers", Value: repeatCard ? repeatCard.customers : 0 },
		{ Field: "Repeat Revenue (₹)", Value: repeatCard ? repeatCard.revenue : 0 },
		{
			Field: "Repeat Revenue Share (%)",
			Value: repeatCard ? `${repeatCard.revenuePct}%` : "0%",
		},
		{ Field: "", Value: "" },
		{ Field: "New Customers", Value: newCard ? newCard.customers : 0 },
		{ Field: "New Revenue (₹)", Value: newCard ? newCard.revenue : 0 },
		{
			Field: "New Revenue Share (%)",
			Value: newCard ? `${newCard.revenuePct}%` : "0%",
		},
		{ Field: "", Value: "" },
		{
			Field: "Revenue Quality Score",
			Value: `${data.qualityScore.score} / 100 (${data.qualityScore.band})`,
		},
	];

	const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
	summarySheet["!cols"] = [{ wch: 30 }, { wch: 45 }];

	// --- SHEET 2: CUSTOMER DETAILS / VALUE BUCKETS ---
	const valueRows = data.valueDistribution.rows || [];

	// Sort Highest Revenue -> Lowest Revenue
	const sortedValueRows = [...valueRows].sort((a, b) => b.revenue - a.revenue);

	const customerDetailsRows = sortedValueRows.map((row, index) => ({
		Rank: index + 1,
		"Customer / Visit Bucket": `Bucket ${row.bucket} Visits`,
		"Customer Count": row.customers,
		"Bills Count": row.bills,
		"Revenue (₹)": row.revenue,
		"Revenue Share (%)": `${row.revenueSharePct.toFixed(1)}%`,
		"AOV (₹)": row.aov,
		"LTV / Avg Spend (₹)": row.ltv,
	}));

	const detailsSheet = XLSX.utils.json_to_sheet(customerDetailsRows);
	detailsSheet["!cols"] = [
		{ wch: 8 },
		{ wch: 28 },
		{ wch: 18 },
		{ wch: 15 },
		{ wch: 18 },
		{ wch: 20 },
		{ wch: 15 },
		{ wch: 22 },
	];

	// --- CREATE WORKBOOK & WRITE FILE ---
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
	XLSX.utils.book_append_sheet(workbook, detailsSheet, "Customer Details");

	const sanitizedStore = storeName.replace(/[^a-zA-Z0-9]/g, "");
	const sanitizedDate = dateRangeStr.replace(/[^a-zA-Z0-9_-]/g, "");
	const fileName = `Customer_Intelligence_${sanitizedStore}_${sanitizedDate}.xlsx`;

	XLSX.writeFile(workbook, fileName);
	return fileName;
}
