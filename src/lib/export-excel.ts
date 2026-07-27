import * as XLSX from "xlsx";

/**
 * Utility to export an array of JSON objects to an Excel file.
 * @param data Array of objects to export
 * @param filename Name of the file (without extension)
 * @param sheetName Name of the sheet inside the workbook
 */
export function exportToExcel(data: Array<any>, filename: string, sheetName: string) {
  try {
    // Clone data to avoid mutating original objects
    const cleanedData = data.map((item) => {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(item)) {
        // Exclude internal metadata or helper fields
        if (key === "footnote" || key.startsWith("_")) continue;
        cleaned[key] = value;
      }
      return cleaned;
    });

    const worksheet = XLSX.utils.json_to_sheet(cleanedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch (error) {
    console.error("Failed to export Excel file", error);
  }
}
