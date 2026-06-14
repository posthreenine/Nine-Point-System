import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchReport, formatRp, formatPct, exportToExcel, exportToPDF, PRESET_RANGES } from "@/lib/report-api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { FileSpreadsheet, FileText, Package, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";

interface ProductItem {
  productId: number;
  productName: string;
  productCode: string;
  totalQty: number;
  totalRevenue: number;
  transactionCount: number;
  hppPerUnit: number;
  totalHpp: number;
  grossProfit: number;
  marginPercentage: number;
}

interface ProductReport {
  startDate: string;
  endDate: string;
  products: ProductItem[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];
const today = new Date().toISOString().split("T")[0];

function marginBadge(pct: number) {
  if (pct >= 60) return <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">High</Badge>;
  if (pct >= 30) return <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Med</Badge>;
  return <Badge variant="destructive" className="text-xs">Low</Badge>;
}

export default function ProductReportPage() {
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [activePreset, setActivePreset] = useState("Today");

  function applyPreset(label: string) {
    const preset = PRESET_RANGES.find(p => p.label === label);
    if (!preset) return;
    const { startDate: s, endDate: e } = preset.getValue();
    setStartDate(s);
    setEndDate(e);
    setActivePreset(label);
  }

  const { data, isLoading } = useQuery<ProductReport>({
    queryKey: ["reports", "products", startDate, endDate],
    queryFn: () => fetchReport<ProductReport>("/reports/products", { startDate, endDate }),
  });

  const top8 = (data?.products ?? []).slice(0, 8).map(p => ({
    name: p.productName.length > 14 ? p.productName.slice(0, 14) + "…" : p.productName,
    Revenue: p.totalRevenue,
    Profit: p.grossProfit,
  }));

  function handleExcelExport() {
    if (!data) return;
    exportToExcel(
      data.products.map((p, i) => ({
        "#": i + 1,
        Product: p.productName,
        Code: p.productCode,
        "Qty Sold": p.totalQty,
        "Revenue (Rp)": p.totalRevenue,
        "HPP/Unit (Rp)": p.hppPerUnit,
        "Total HPP (Rp)": p.totalHpp,
        "Gross Profit (Rp)": p.grossProfit,
        "Margin (%)": p.marginPercentage,
      })),
      `product-report-${startDate}-${endDate}`,
      "Product Report"
    );
  }

  function handlePDFExport() {
    if (!data) return;
    exportToPDF(
      "Product Sales Report",
      `${format(parseISO(startDate), "dd MMM yyyy")} – ${format(parseISO(endDate), "dd MMM yyyy")}`,
      ["#", "Product", "Qty", "Revenue", "HPP", "Profit", "Margin"],
      data.products.map((p, i) => [
        String(i + 1), p.productName, String(p.totalQty),
        formatRp(p.totalRevenue), formatRp(p.totalHpp), formatRp(p.grossProfit), formatPct(p.marginPercentage)
      ]),
      `product-report-${startDate}-${endDate}`
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Product Sales Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance by product — quantity, revenue, HPP, and profit</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={!data || data.products.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDFExport} disabled={!data || data.products.length === 0}>
            <FileText className="h-4 w-4 mr-1.5" />PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESET_RANGES.map(p => (
          <Button key={p.label} size="sm" variant={activePreset === p.label ? "default" : "outline"} onClick={() => applyPreset(p.label)}>
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-2 ml-1">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActivePreset(""); }} max={endDate} className="w-36 h-8 text-sm" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActivePreset(""); }} min={startDate} max={today} className="w-36 h-8 text-sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-52" />
          <Skeleton className="h-64" />
        </div>
      ) : !data || data.products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">No product sales data for this period</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 8 Products by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top8} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number, name: string) => [formatRp(v), name]} />
                  <Bar dataKey="Revenue" radius={[0, 4, 4, 0]}>
                    {top8.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All Products ({data.products.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-3">#</th>
                      <th className="text-left py-2 pr-3">Product</th>
                      <th className="text-right py-2 pr-3">Qty</th>
                      <th className="text-right py-2 pr-3">Revenue</th>
                      <th className="text-right py-2 pr-3 hidden md:table-cell">HPP</th>
                      <th className="text-right py-2 pr-3">Profit</th>
                      <th className="text-center py-2 pr-3 hidden sm:table-cell">Margin</th>
                      <th className="text-center py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p, i) => (
                      <tr key={p.productId} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 pr-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{p.productName}</p>
                          <p className="text-xs text-muted-foreground">{p.productCode}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono">{p.totalQty}</td>
                        <td className="py-2.5 pr-3 text-right font-mono font-medium">{formatRp(p.totalRevenue)}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground hidden md:table-cell">{formatRp(p.totalHpp)}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">{formatRp(p.grossProfit)}</td>
                        <td className="py-2.5 pr-3 text-center font-mono text-xs hidden sm:table-cell">{formatPct(p.marginPercentage)}</td>
                        <td className="py-2.5 text-center">{marginBadge(p.marginPercentage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
