import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchReport, formatRp, exportToExcel, exportToPDF } from "@/lib/report-api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { FileSpreadsheet, FileText, TrendingUp, Receipt, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, subMonths, addMonths } from "date-fns";

interface MonthlyReport {
  month: string;
  summary: {
    transactionCount: number;
    revenue: number;
    avgTransaction: number;
    totalDiscount: number;
    grossProfit: number;
    totalHpp: number;
  };
  byDay: { day: string; transaction_count: number; revenue: number }[];
  byPayment: { payment_method: string; count: number; revenue: number }[];
  topProducts: { product_name: string; total_qty: number; total_revenue: number }[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export default function MonthlyReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.toISOString().slice(0, 7));

  function shiftMonth(delta: number) {
    const d = new Date(month + "-01");
    const n = delta > 0 ? addMonths(d, 1) : subMonths(d, 1);
    const nm = n.toISOString().slice(0, 7);
    if (nm <= now.toISOString().slice(0, 7)) setMonth(nm);
  }

  const { data, isLoading } = useQuery<MonthlyReport>({
    queryKey: ["reports", "monthly", month],
    queryFn: () => fetchReport<MonthlyReport>("/reports/monthly", { month }),
  });

  const chartData = (data?.byDay ?? []).map(d => ({
    day: format(parseISO(d.day), "dd"),
    Revenue: d.revenue,
    Transactions: d.transaction_count,
  }));

  function handleExcelExport() {
    if (!data) return;
    exportToExcel(
      data.byDay.map(d => ({
        Date: d.day,
        Transactions: d.transaction_count,
        "Revenue (Rp)": d.revenue,
      })),
      `monthly-report-${month}`,
      "Monthly Report"
    );
  }

  function handlePDFExport() {
    if (!data) return;
    exportToPDF(
      "Monthly Sales Report",
      `Month: ${format(new Date(month + "-01"), "MMMM yyyy")}  |  Revenue: ${formatRp(data.summary.revenue)}  |  Transactions: ${data.summary.transactionCount}`,
      ["Date", "Transactions", "Revenue"],
      data.byDay.map(d => [d.day, String(d.transaction_count), formatRp(d.revenue)]),
      `monthly-report-${month}`
    );
  }

  const monthLabel = month ? format(new Date(month + "-01"), "MMMM yyyy") : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Monthly Sales Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Full month revenue, profit, and product breakdown</p>
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

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          max={now.toISOString().slice(0, 7)}
          className="h-8 px-3 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)} disabled={month >= now.toISOString().slice(0, 7)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">{monthLabel}</span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i=><Skeleton key={i} className="h-24"/>)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Revenue", value: formatRp(data.summary.revenue), color: "text-indigo-600", icon: DollarSign },
              { label: "Transactions", value: String(data.summary.transactionCount), color: "text-violet-600", icon: Receipt },
              { label: "Avg Transaction", value: formatRp(data.summary.avgTransaction), color: "text-amber-600", icon: TrendingUp },
              { label: "Gross Profit", value: formatRp(data.summary.grossProfit), color: "text-emerald-600", icon: TrendingUp },
            ].map(({ label, value, color, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
                    </div>
                    <Icon className={`h-4 w-4 ${color} mt-0.5`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Revenue — {monthLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">No transactions this month</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number, name: string) => name === "Revenue" ? formatRp(v) : v} />
                    <Area type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#monthGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">No data</p>
                ) : (
                  <div className="space-y-3">
                    {data.topProducts.slice(0, 8).map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.product_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(p.total_qty / (data.topProducts[0]?.total_qty || 1)) * 100}%`,
                                  background: COLORS[i % COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{p.total_qty} sold</span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold shrink-0">{formatRp(p.total_revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byPayment.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">No data</p>
                ) : (
                  <div className="space-y-3">
                    {data.byPayment.map((p, i) => {
                      const name = p.payment_method === "cash" ? "Cash" : p.payment_method === "qris" ? "QRIS" : p.payment_method;
                      const total = data.byPayment.reduce((s, x) => s + x.revenue, 0);
                      const pct = total > 0 ? (p.revenue / total) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{name} ({p.count}x)</span>
                            <span className="font-medium">{formatRp(p.revenue)}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-right py-2 pr-4">Transactions</th>
                      <th className="text-right py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDay.map((d, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 pr-4">{format(parseISO(d.day), "EEEE, dd MMM")}</td>
                        <td className="py-2 pr-4 text-right">{d.transaction_count}</td>
                        <td className="py-2 text-right font-mono">{formatRp(d.revenue)}</td>
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
