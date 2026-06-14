import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchReport, formatRp, exportToExcel, exportToPDF } from "@/lib/report-api";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FileSpreadsheet, FileText, TrendingUp, Receipt, DollarSign, CalendarDays } from "lucide-react";
import { format, subDays } from "date-fns";

interface DailyReport {
  date: string;
  summary: {
    transactionCount: number;
    revenue: number;
    avgTransaction: number;
    totalDiscount: number;
    totalTax: number;
    totalServiceCharge: number;
    grossProfit: number;
    totalHpp: number;
  };
  byHour: { hour: number; transaction_count: number; revenue: number }[];
  byPayment: { payment_method: string; count: number; revenue: number }[];
  topProducts: { product_name: string; product_code: string; total_qty: number; total_revenue: number }[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

const today = new Date().toISOString().split("T")[0];
const yesterday = subDays(new Date(), 1).toISOString().split("T")[0];

export default function DailyReportPage() {
  const [date, setDate] = useState(today);

  const { data, isLoading } = useQuery<DailyReport>({
    queryKey: ["reports", "daily", date],
    queryFn: () => fetchReport<DailyReport>("/reports/daily", { date }),
  });

  const hourData = Array.from({ length: 24 }, (_, h) => {
    const found = data?.byHour.find(b => b.hour === h);
    return { hour: `${String(h).padStart(2, "0")}:00`, revenue: found?.revenue ?? 0, transactions: found?.transaction_count ?? 0 };
  }).filter(d => d.revenue > 0 || (data?.byHour.some(b => b.hour >= 6 && b.hour <= 22)));

  const paymentData = (data?.byPayment ?? []).map(p => ({
    name: p.payment_method === "cash" ? "Cash" : p.payment_method === "qris" ? "QRIS" : p.payment_method,
    value: p.revenue,
    count: p.count,
  }));

  function handleExcelExport() {
    if (!data) return;
    const rows = data.topProducts.map((p, i) => ({
      Rank: i + 1,
      Product: p.product_name,
      Code: p.product_code,
      "Qty Sold": p.total_qty,
      "Revenue (Rp)": p.total_revenue,
    }));
    exportToExcel(rows, `daily-report-${date}`, "Daily Report");
  }

  function handlePDFExport() {
    if (!data) return;
    const s = data.summary;
    exportToPDF(
      "Daily Sales Report",
      `Date: ${format(new Date(date + "T00:00:00"), "dd MMMM yyyy")}  |  Transactions: ${s.transactionCount}  |  Revenue: ${formatRp(s.revenue)}`,
      ["#", "Product", "Code", "Qty", "Revenue"],
      data.topProducts.map((p, i) => [
        String(i + 1), p.product_name, p.product_code, String(p.total_qty), formatRp(p.total_revenue)
      ]),
      `daily-report-${date}`
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Daily Sales Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue, transactions, and profit for a single day</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDFExport} disabled={!data}>
            <FileText className="h-4 w-4 mr-1.5" />
            PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {[
            { label: "Today", value: today },
            { label: "Yesterday", value: yesterday },
          ].map(p => (
            <Button key={p.label} size="sm" variant={date === p.value ? "default" : "outline"} onClick={() => setDate(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={today}
            className="w-40 h-8 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-52" />
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Revenue", value: formatRp(data.summary.revenue), icon: DollarSign, color: "text-indigo-600" },
              { label: "Transactions", value: String(data.summary.transactionCount), icon: Receipt, color: "text-violet-600" },
              { label: "Avg Transaction", value: formatRp(data.summary.avgTransaction), icon: TrendingUp, color: "text-amber-600" },
              { label: "Gross Profit", value: formatRp(data.summary.grossProfit), icon: TrendingUp, color: "text-emerald-600" },
            ].map(({ label, value, icon: Icon, color }) => (
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

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                {hourData.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-12">No transactions on this date</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hourData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number, name: string) => name === "revenue" ? formatRp(v) : v} />
                      <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentData.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-12">No data</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={30} paddingAngle={3}>
                          {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatRp(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                      {paymentData.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-muted-foreground">{p.name}</span>
                          </span>
                          <span className="font-medium">{formatRp(p.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top Products</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topProducts.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">No product data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-3">#</th>
                        <th className="text-left py-2 pr-3">Product</th>
                        <th className="text-right py-2 pr-3">Qty Sold</th>
                        <th className="text-right py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2.5 pr-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium">{p.product_name}</p>
                            <p className="text-xs text-muted-foreground">{p.product_code}</p>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono">{p.total_qty}</td>
                          <td className="py-2.5 text-right font-mono font-medium">{formatRp(p.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Summary Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Revenue", formatRp(data.summary.revenue)],
                  ["Discount", `- ${formatRp(data.summary.totalDiscount)}`],
                  ["Tax", formatRp(data.summary.totalTax)],
                  ["Service Charge", formatRp(data.summary.totalServiceCharge)],
                  ["HPP (COGS)", `- ${formatRp(data.summary.totalHpp)}`],
                  ["Gross Profit", formatRp(data.summary.grossProfit)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
