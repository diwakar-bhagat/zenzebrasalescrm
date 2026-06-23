"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToExcel } from "@/lib/export-excel";

function GrowthText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const formatted = value >= 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
  const colorClass = value > 0
    ? "text-status-on-track font-semibold"
    : value < 0
      ? "text-status-delayed font-semibold"
      : "text-muted-foreground";
  return <span className={colorClass}>{formatted}</span>;
}

function ExportButton({ data, filename, sheetName }: { data: Array<any>; filename: string; sheetName: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs shadow-sm hover:bg-accent"
      onClick={() => exportToExcel(data, filename, sheetName)}
    >
      <Download className="h-3.5 w-3.5" />
      Export Excel
    </Button>
  );
}

export function DailyHealthTable({ metrics, comparisonLabel }: { metrics: Array<{ metric: string; current: number; previous: number | null; growth: number | null; footnote?: string }>; comparisonLabel?: string }) {
  const rows = metrics.map((m) => ({
    Metric: m.metric,
    Current: m.metric === "AOV" || m.metric === "Sales" ? formatCurrency(m.current) : m.current.toLocaleString(),
    Previous: m.previous == null ? "—" : m.metric === "AOV" || m.metric === "Sales" ? formatCurrency(m.previous) : m.previous.toLocaleString(),
    Growth: m.growth,
    footnote: m.footnote,
  }));

  // Prepare clean export structure
  const exportData = metrics.map((m) => ({
    Metric: m.metric,
    Current: m.current,
    Previous: m.previous,
    "Growth (%)": m.growth,
  }));

  const footnote = metrics.find((m) => m.footnote)?.footnote;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Daily Business Health</CardTitle>
          <CardDescription>
            <span>Current vs previous period — mirror comparison</span>
            {comparisonLabel && <span className="block text-xs text-muted-foreground/80 mt-0.5">Compared: {comparisonLabel}</span>}
          </CardDescription>
        </div>
        <ExportButton data={exportData} filename="Daily_Business_Health" sheetName="Daily Health" />
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              <th className="px-3 py-2 text-left">Metric</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">Previous</th>
              <th className="px-3 py-2 text-right">Growth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.Metric} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 font-medium">{row.Metric}</td>
                <td className="px-3 py-2 text-right">{row.Current}</td>
                <td className="px-3 py-2 text-right">{row.Previous}</td>
                <td className="px-3 py-2 text-right">
                  <GrowthText value={row.Growth} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {footnote && <p className="text-xs text-muted-foreground mt-3">{footnote}</p>}
      </CardContent>
    </Card>
  );
}

export function BrandPerformanceTable({ data, comparisonLabel }: { data: Array<{ brand: string; currentUnits: number; currentRevenue: number; unitsGrowthPct: number | null }>; comparisonLabel?: string }) {
  const exportData = data.map((row) => ({
    Brand: row.brand,
    Units: row.currentUnits,
    Revenue: row.currentRevenue,
    "Growth (%)": row.unitsGrowthPct,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Brand Performance</CardTitle>
          <CardDescription>
            <span>Top brands by volume and revenue shift</span>
            {comparisonLabel && <span className="block text-xs text-muted-foreground/80 mt-0.5">Compared: {comparisonLabel}</span>}
          </CardDescription>
        </div>
        <ExportButton data={exportData} filename="Brand_Performance" sheetName="Brand Performance" />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-right">Units</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Growth</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row) => (
              <tr key={row.brand} className="border-b hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 font-medium">{row.brand}</td>
                <td className="px-3 py-2 text-right">{row.currentUnits.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(row.currentRevenue)}</td>
                <td className="px-3 py-2 text-right">
                  <GrowthText value={row.unitsGrowthPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function SkuPerformanceTable({ data, comparisonLabel }: { data: Array<{ skuCode: string | null; itemName: string; currentUnits: number; currentRevenue: number; unitsGrowthPct: number | null }>; comparisonLabel?: string }) {
  const exportData = data.map((row) => ({
    SKU: row.skuCode ?? "—",
    Item: row.itemName,
    Units: row.currentUnits,
    Revenue: row.currentRevenue,
    "Growth (%)": row.unitsGrowthPct,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Product (SKU) Performance</CardTitle>
          <CardDescription>
            <span>Movers by absolute growth and unit volume</span>
            {comparisonLabel && <span className="block text-xs text-muted-foreground/80 mt-0.5">Compared: {comparisonLabel}</span>}
          </CardDescription>
        </div>
        <ExportButton data={exportData} filename="SKU_Performance" sheetName="SKU Performance" />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Units</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Growth</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row) => (
              <tr key={`${row.skuCode ?? "missing-sku"}-${row.itemName}-${row.currentRevenue}`} className="border-b hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 font-mono text-xs">{row.skuCode ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{row.itemName}</td>
                <td className="px-3 py-2 text-right">{row.currentUnits.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(row.currentRevenue)}</td>
                <td className="px-3 py-2 text-right">
                  <GrowthText value={row.unitsGrowthPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function BillCutAnalysisTable({ data, comparisonLabel }: { data: Array<{ category: string; currentBillCuts: number; billCutsGrowthPct: number | null }>; comparisonLabel?: string }) {
  const exportData = data.map((row) => ({
    Category: row.category,
    "Bill Cuts": row.currentBillCuts,
    "Growth (%)": row.billCutsGrowthPct,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Bill Cut Analysis by Category</CardTitle>
          <CardDescription>
            <span>Transaction volume contribution by category</span>
            {comparisonLabel && <span className="block text-xs text-muted-foreground/80 mt-0.5">Compared: {comparisonLabel}</span>}
          </CardDescription>
        </div>
        <ExportButton data={exportData} filename="Bill_Cut_Analysis" sheetName="Bill Cuts" />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Bill Cuts</th>
              <th className="px-3 py-2 text-right">Growth</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((row) => (
              <tr key={row.category} className="border-b hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 font-medium">{row.category}</td>
                <td className="px-3 py-2 text-right">{row.currentBillCuts.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <GrowthText value={row.billCutsGrowthPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function AovAnalysisTable({ data, comparisonLabel }: { data: Array<{ category: string; currentAov: number; aovGrowthPct: number | null }>; comparisonLabel?: string }) {
  const exportData = data.map((row) => ({
    Category: row.category,
    AOV: row.currentAov,
    "Growth (%)": row.aovGrowthPct,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>AOV Analysis by Category</CardTitle>
          <CardDescription>
            <span>Basket value size shift by category</span>
            {comparisonLabel && <span className="block text-xs text-muted-foreground/80 mt-0.5">Compared: {comparisonLabel}</span>}
          </CardDescription>
        </div>
        <ExportButton data={exportData} filename="AOV_Analysis" sheetName="AOV" />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">AOV</th>
              <th className="px-3 py-2 text-right">Growth</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((row) => (
              <tr key={row.category} className="border-b hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 font-medium">{row.category}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(row.currentAov)}</td>
                <td className="px-3 py-2 text-right">
                  <GrowthText value={row.aovGrowthPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function CustomerIntelligenceCard({ data, comparisonLabel }: { data: { totalCustomers: number; repeatCustomers: number; newCustomers: number; repeatCustomersNote: string; topCustomers: Array<{ customerName: string | null; customerMobile: string; billCount: number; revenue: number }> }; comparisonLabel?: string }) {
  const exportData = data.topCustomers.map((c) => ({
    Customer: c.customerName ?? c.customerMobile,
    Mobile: c.customerMobile,
    Bills: c.billCount,
    Revenue: c.revenue,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Customer Intelligence</CardTitle>
          <CardDescription>
            <span>{data.repeatCustomersNote}</span>
            {comparisonLabel && <span className="block text-xs text-muted-foreground/80 mt-0.5">Compared: {comparisonLabel}</span>}
          </CardDescription>
        </div>
        <ExportButton data={exportData} filename="Customer_Intelligence_Top_Customers" sheetName="Top Customers" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Customers</p>
            <p className="text-xl font-bold">{data.totalCustomers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Repeat Customers</p>
            <p className="text-xl font-bold">{data.repeatCustomers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">New Customers</p>
            <p className="text-xl font-bold">{data.newCustomers.toLocaleString()}</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Bills</th>
              <th className="px-3 py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.topCustomers.map((c) => (
              <tr key={c.customerMobile} className="border-b hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 font-medium">{c.customerName ?? c.customerMobile}</td>
                <td className="px-3 py-2 text-right">{c.billCount}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(c.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function PaymentAnalysisCard({ data, comparisonLabel }: { data: { methods: Array<{ paymentMethod: string; revenue: number; billCuts: number; revenueSharePct: number }> }; comparisonLabel?: string }) {
  const exportData = data.methods.map((row) => ({
    "Payment Method": row.paymentMethod,
    Revenue: row.revenue,
    "Bill Cuts": row.billCuts,
    "Share (%)": row.revenueSharePct,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Payment Analysis</CardTitle>
          <CardDescription>
            <span>Revenue and transaction count by payment channel</span>
            {comparisonLabel && <span className="block text-xs text-muted-foreground/80 mt-0.5">Compared: {comparisonLabel}</span>}
          </CardDescription>
        </div>
        <ExportButton data={exportData} filename="Payment_Analysis" sheetName="Payments" />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Bills</th>
              <th className="px-3 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.methods.map((row) => (
              <tr key={row.paymentMethod} className="border-b hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 font-medium">{row.paymentMethod}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.revenue)}</td>
                <td className="px-3 py-2 text-right">{row.billCuts.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{row.revenueSharePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
