import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchReport, formatRp, exportToExcel, exportToPDF } from "@/lib/report-api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { FileSpreadsheet, FileText, TrendingUp, Receipt, DollarSign, CalendarDays } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, parseISO } from "date-fns";

interface WeeklyReport {
  start: string;
  end: string;
  summary: {
    transactionCount: number;
    revenue: number;
    avgTransaction: number;
    grossProfit: number;
    totalHpp: number;
  };
  byDay: { day: string; transaction_count: number; revenue: number }[];
  byPayment: { payment_method: string; count: number; revenue: number }[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
const todayDate = new Date();

function getWeekRange(referenceDate: Date) {
  const s = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const e = endOfWeek(referenceDate, { weekStartsOn: 1 });
  return {
    start: s.toISOString().split("T")[0],
    end: e > todayDate ? todayDate.toISOString().split("T")[0] : e.toISOString().split("T")[0],
  };
}

const PRESETS = [
  { label: "This Week", ...getWeekRange(todayDate) },
  { label: "Last Week", ...getWeekRange(subDays(todayDate, 7)) },
  { label: "Last 7 Days", start: subDays(todayDate, 6).toISOString().split("T")[0], end: todayDate.toISOString().split("T")[0] },
];

export default function WeeklyReportPage() {
  const [start, setStart] = useState(PRESETS[0].start);
  const [end, setEnd] = useState(PRESETS[0].end);
  const [active, setActive] = useState("This Week");

  function applyPreset(p: typeof PRESETS[0]) {
    setStart(p.start);
    setEnd(p.end);
    setActive(p.label);
  }

  const { data, isLoading } = useQuery<WeeklyReport>({
    queryKey: ["reports", "weekly", start, end],
    queryFn: () => fetchReport<WeeklyReport>("/reports/weekly", { start, end }),
  });

  const chartData = data?.byDay.map(d => ({
    day: format(parseISO(d.day), "EEE dd"),
    Revenue: d.revenue,
    Transactions: d.transaction_count,
  })) ?? [];

  function handleExcelExport() {
    if (!data) return;
    exportToExcel(
      data.byDay.map(d => ({
        Date: d.day,
        "Day": format(parseISO(d.day), "EEEE"),
        Transactions: d.transaction_count,
        "Revenue (Rp)": d.revenue,
      })),
      `weekly-report-${start}-to-${end}`,
      "Weekly Report"
    );
  }

  function handlePDFExport() {
    if (!data) return;
    exportToPDF(
      "Weekly Sales Report",
      `${format(parseISO(start), "dd MMM")} – ${format(parseISO(end), "dd MMM yyyy")}  |  Revenue: ${formatRp(data.summary.revenue)}`,
      ["Date", "Day", "Transactions", "Revenue"],
      data.byDay.map(d => [d.day, format(parseISO(d.day), "EEEE"), String(d.transaction_count), formatRp(d.revenue)]),
      `weekly-report-${start}-${end}`
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Weekly Sales Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue and transaction trends by day</p>
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
        {PRESETS.map(p => (
          <Button key={p.label} size="sm" variant={active === p.label ? "default" : "outline"} onClick={() => applyPreset(p)}>
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-2 ml-1">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input type="date" value={start} onChange={e => { setStart(e.target.value); setActive(""); }} max={end} className="w-36 h-8 text-sm" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={end} onChange={e => { setEnd(e.target.value); setActive(""); }} min={start} max={todayDate.toISOString().split("T")[0]} className="w-36 h-8 text-sm" />
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
              <CardTitle className="text-sm">Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">No transactions in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number, name: string) => name === "Revenue" ? formatRp(v) : v} />
                    <Bar dataKey="Revenue" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Day</th>
                      <th className="text-right py-2 pr-3">Transactions</th>
                      <th className="text-right py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDay.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No data in this period</td></tr>
                    ) : (
                      data.byDay.map((d, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2.5 pr-3 font-medium">{format(parseISO(d.day), "dd MMM yyyy")}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{format(parseISO(d.day), "EEEE")}</td>
                          <td className="py-2.5 pr-3 text-right">{d.transaction_count}</td>
                          <td className="py-2.5 text-right font-mono font-medium">{formatRp(d.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.byDay.length > 0 && (
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td className="pt-3 pr-3" colSpan={2}>Total</td>
                        <td className="pt-3 pr-3 text-right">{data.summary.transactionCount}</td>
                        <td className="pt-3 text-right text-indigo-600">{formatRp(data.summary.revenue)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
