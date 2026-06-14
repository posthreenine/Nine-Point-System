import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fetchReport, formatRp } from "@/lib/report-api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Receipt, ShoppingBag, BarChart3 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Analytics {
  today: { revenue: number; transactionCount: number; grossProfit: number };
  thisMonth: { revenue: number; transactionCount: number; grossProfit: number };
  lastMonth: { revenue: number };
  trend: { day: string; transaction_count: number; revenue: number }[];
  topCategories: { category_name: string; total_qty: number; total_revenue: number }[];
  topProducts: { product_name: string; total_qty: number; total_revenue: number }[];
  paymentToday: { payment_method: string; cnt: number; rev: number }[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("revenue")
            ? formatRp(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ["reports", "analytics"],
    queryFn: () => fetchReport<Analytics>("/reports/analytics"),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const { today, thisMonth, lastMonth, trend, topCategories, topProducts, paymentToday } = analytics;

  const monthGrowth = lastMonth.revenue > 0
    ? ((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100
    : null;

  const trendData = trend.map(t => ({
    day: format(parseISO(t.day), "EEE dd"),
    Revenue: t.revenue,
    Transactions: t.transaction_count,
  }));

  const categoryData = topCategories.map(c => ({
    name: c.category_name,
    value: c.total_revenue,
    qty: c.total_qty,
  }));

  const paymentData = paymentToday.map(p => ({
    name: p.payment_method === "cash" ? "Cash" : p.payment_method === "qris" ? "QRIS" : p.payment_method,
    value: p.rev,
    count: p.cnt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Business overview — {format(new Date(), "EEEE, dd MMMM yyyy")}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Today Revenue</p>
                <p className="text-xl font-bold mt-1">{formatRp(today.revenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{today.transactionCount} transactions</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <DollarSign className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Today Profit</p>
                <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRp(today.grossProfit)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {today.revenue > 0 ? `${((today.grossProfit / today.revenue) * 100).toFixed(1)}% margin` : "—"}
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Monthly Revenue</p>
                <p className="text-xl font-bold mt-1">{formatRp(thisMonth.revenue)}</p>
                {monthGrowth !== null && (
                  <p className={`text-xs mt-0.5 flex items-center gap-1 ${monthGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {monthGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(monthGrowth).toFixed(1)}% vs last month
                  </p>
                )}
              </div>
              <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <BarChart3 className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Monthly Profit</p>
                <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatRp(thisMonth.grossProfit)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{thisMonth.transactionCount} transactions</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ShoppingBag className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" dot={{ r: 3, fill: "#6366f1" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Categories (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatRp(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="space-y-1.5 mt-2">
              {categoryData.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground truncate">{c.name}</span>
                  </span>
                  <span className="font-medium shrink-0">{formatRp(c.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Best Selling Products (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">No data yet</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.product_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(p.total_qty / (topProducts[0]?.total_qty || 1)) * 100}%`,
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
            <CardTitle className="text-sm font-semibold">Today's Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">No transactions today</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={paymentData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={48} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatRp(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {paymentData.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{p.name}</span>
                      </span>
                      <span className="font-medium">{formatRp(p.value)} ({p.count}x)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
