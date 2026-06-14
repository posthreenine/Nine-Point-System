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
import { FileSpreadsheet, FileText, TrendingUp, DollarSign, CalendarDays, Percent } from "lucide-react";
import { format, parseISO } from "date-fns";

interface ProfitProduct {
  productId: number;
  productName: string;
  productCode: string;
  totalQty: number;
  totalRevenue: number;
  totalHpp: number;
  grossProfit: number;
  marginPercentage: number;
}

interface ProfitReport {
  startDate: string;
  endDate: string;
  transactionCount: number;
  revenue: number;
  totalDiscount: number;
  totalTax: number;
  totalServiceCharge: number;
  totalHpp: number;
  grossProfit: number;
  netProfit: number;
  marginPercentage: number;
  byProduct: ProfitProduct[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
const today = new Date().toISOString().split("T")[0];

export default function ProfitReportPage() {
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

  const { data, isLoading } = useQuery<ProfitReport>({
    queryKey: ["reports", "profit", startDate, endDate],
    queryFn: () => fetchReport<ProfitReport>("/reports/profit", { startDate, endDate }),
  });

  const top8Chart = (data?.byProduct ?? []).slice(0, 8).map(p => ({
    name: p.productName.length > 14 ? p.productName.slice(0, 14) + "…" : p.productName,
    Profit: p.grossProfit,
    Revenue: p.totalRevenue,
  }));

  function handleExcelExport() {
    if (!data) return;
    exportToExcel(
      [
        { "": "SUMMARY", "Revenue (Rp)": data.revenue, "HPP (Rp)": data.totalHpp, "Gross Profit (Rp)": data.grossProfit, "Margin (%)": data.marginPercentage },
        ...data.byProduct.map((p, i) => ({
          "#": i + 1,
          Product: p.productName,
          Code: p.productCode,
          "Qty": p.totalQty,
          "Revenue (Rp)": p.totalRevenue,
          "HPP (Rp)": p.totalHpp,
          "Gross Profit (Rp)": p.grossProfit,
          "Margin (%)": p.marginPercentage,
        })),
      ],
      `profit-report-${startDate}-${endDate}`,
      "Profit Report"
    );
  }

  function handlePDFExport() {
    if (!data) return;
    exportToPDF(
      "Profit Report",
      `${format(parseISO(startDate), "dd MMM yyyy")} – ${format(parseISO(endDate), "dd MMM yyyy")}  |  Gross Profit: ${formatRp(data.grossProfit)}  |  Margin: ${formatPct(data.marginPercentage)}`,
      ["#", "Product", "Qty", "Revenue", "HPP", "Gross Profit", "Margin"],
      data.byProduct.map((p, i) => [
        String(i + 1), p.productName, String(p.totalQty),
        formatRp(p.totalRevenue), formatRp(p.totalHpp), formatRp(p.grossProfit), formatPct(p.marginPercentage)
      ]),
      `profit-report-${startDate}-${endDate}`
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Profit Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gross profit, HPP (COGS), and margin analysis by date range</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDFExport} disabled={!data}>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i=><Skeleton key={i} className="h-24"/>)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Revenue</p>
                    <p className="text-lg font-bold mt-1 text-indigo-600 dark:text-indigo-400">{formatRp(data.revenue)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{data.transactionCount} transactions</p>
                  </div>
                  <DollarSign className="h-4 w-4 text-indigo-600 mt-0.5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Total HPP (COGS)</p>
                    <p className="text-lg font-bold mt-1 text-red-500">{formatRp(data.totalHpp)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {data.revenue > 0 ? formatPct((data.totalHpp / data.revenue) * 100) + " of revenue" : "—"}
                    </p>
                  </div>
                  <DollarSign className="h-4 w-4 text-red-500 mt-0.5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Gross Profit</p>
                    <p className="text-lg font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRp(data.grossProfit)}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Net: {formatRp(data.netProfit)}</p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Profit Margin</p>
                    <p className={`text-lg font-bold mt-1 ${data.marginPercentage >= 40 ? "text-emerald-600" : data.marginPercentage >= 20 ? "text-amber-600" : "text-red-500"}`}>
                      {formatPct(data.marginPercentage)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {data.marginPercentage >= 40 ? "Excellent" : data.marginPercentage >= 20 ? "Good" : "Low"}
                    </p>
                  </div>
                  <Percent className="h-4 w-4 text-muted-foreground mt-0.5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Gross Profit by Product (Top 8)</CardTitle>
              </CardHeader>
              <CardContent>
                {top8Chart.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-12">No data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={top8Chart} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number, name: string) => [formatRp(v), name]} />
                      <Bar dataKey="Profit" name="Gross Profit" radius={[0, 4, 4, 0]}>
                        {top8Chart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">P&L Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Revenue", value: data.revenue, color: "text-foreground" },
                    { label: "Discount", value: -data.totalDiscount, color: "text-red-500" },
                    { label: "Tax Collected", value: data.totalTax, color: "text-muted-foreground" },
                    { label: "Service Charge", value: data.totalServiceCharge, color: "text-muted-foreground" },
                    { label: "HPP (COGS)", value: -data.totalHpp, color: "text-red-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center border-b pb-2.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-medium ${color}`}>
                        {value < 0 ? `- ${formatRp(-value)}` : formatRp(value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1 font-semibold">
                    <span>Gross Profit</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatRp(data.grossProfit)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.byProduct.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Product Profit Breakdown</CardTitle>
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
                        <th className="text-right py-2 pr-3">Gross Profit</th>
                        <th className="text-center py-2 hidden sm:table-cell">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byProduct.map((p, i) => (
                        <tr key={p.productId} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 pr-3 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium">{p.productName}</p>
                            <p className="text-xs text-muted-foreground">{p.productCode}</p>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono">{p.totalQty}</td>
                          <td className="py-2.5 pr-3 text-right font-mono">{formatRp(p.totalRevenue)}</td>
                          <td className="py-2.5 pr-3 text-right font-mono text-red-400 hidden md:table-cell">{formatRp(p.totalHpp)}</td>
                          <td className="py-2.5 pr-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">{formatRp(p.grossProfit)}</td>
                          <td className="py-2.5 text-center hidden sm:table-cell">
                            <Badge className={`text-xs border-0 ${
                              p.marginPercentage >= 60 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                              p.marginPercentage >= 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}>
                              {formatPct(p.marginPercentage)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
