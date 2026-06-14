import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Shield, UserCog, ShoppingBag, TrendingUp, Package, Table2, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreSettings } from "@/hooks/use-store-settings";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({
    query: {
      queryKey: getGetDashboardStatsQueryKey(),
    },
  });
  const { settings } = useStoreSettings();
  const sym = settings?.currencySymbol ?? "Rp";
  const fmt = (n: number) => `${sym} ${Math.round(n).toLocaleString("id-ID")}`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <span className="text-sm text-muted-foreground">
          Today, {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      {/* Today's Sales */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Today's Performance</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{fmt(stats.todaySales)}</div>
              <p className="text-xs text-muted-foreground mt-1">From {stats.todayTransactions} transaction(s)</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Transactions Today</CardTitle>
              <ShoppingBag className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.todayTransactions}</div>
              <p className="text-xs text-muted-foreground mt-1">Paid transactions</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Tables</CardTitle>
              <Table2 className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.openTables}</div>
              <p className="text-xs text-muted-foreground mt-1">Tables currently occupied</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Products</CardTitle>
              <Package className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground mt-1">Products in menu</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Staff & System */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">System Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-l-4 border-l-slate-400 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.activeUsers} active</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Roles</CardTitle>
              <Shield className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRoles}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Best Sellers + Users by Role */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Best Sellers */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Best Selling Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.bestSellingProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales today yet</p>
            ) : (
              <div className="space-y-3">
                {stats.bestSellingProducts.map((p, idx) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.productName}</div>
                      <div className="text-xs text-muted-foreground">{p.totalSold} sold</div>
                    </div>
                    <div className="text-sm font-semibold text-primary shrink-0">{fmt(p.totalRevenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users by Role */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCog className="h-5 w-5 text-slate-500" />
              Users by Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.usersByRole.map((role) => (
                <div key={role.roleName} className="flex items-center">
                  <div className="w-24 font-medium text-sm truncate">{role.roleName}</div>
                  <div className="flex-1 ml-3">
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-1000 ease-out"
                        style={{ width: `${stats.totalUsers > 0 ? Math.max(5, (role.count / stats.totalUsers) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-8 text-right text-sm text-muted-foreground font-mono ml-3">{role.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
