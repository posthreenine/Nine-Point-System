import { useState } from "react";
import { useGetProfitAnalysis } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id")}`;
}

export default function ProfitAnalysisPage() {
  const [search, setSearch] = useState("");
  const { data: items = [], isLoading } = useGetProfitAnalysis();

  const filtered = items.filter(p =>
    p.productName.toLowerCase().includes(search.toLowerCase()) ||
    p.productCode.toLowerCase().includes(search.toLowerCase()) ||
    (p.categoryName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Summary stats
  const totalProducts = items.length;
  const avgMargin = items.length > 0 ? items.reduce((s, i) => s + i.marginPercentage, 0) / items.length : 0;
  const bestProduct = items.reduce((best, i) => (!best || i.marginPercentage > best.marginPercentage) ? i : best, items[0] ?? null);
  const worstProduct = items.reduce((worst, i) => (!worst || i.marginPercentage < worst.marginPercentage) ? i : worst, items[0] ?? null);

  function marginColor(pct: number) {
    if (pct >= 60) return "text-green-600 dark:text-green-400";
    if (pct >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-500";
  }

  function marginBadge(pct: number) {
    if (pct >= 60) return <Badge variant="default">High</Badge>;
    if (pct >= 40) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profit Analysis (HPP)</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Harga Pokok Produksi & margin analysis per product</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Total Products</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalProducts}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Avg Margin</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${marginColor(avgMargin)}`}>{avgMargin.toFixed(1)}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Best Margin</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{bestProduct ? `${bestProduct.marginPercentage.toFixed(1)}%` : "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{bestProduct?.productName ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Worst Margin</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{worstProduct ? `${worstProduct.marginPercentage.toFixed(1)}%` : "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{worstProduct?.productName ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">{search ? "No products match" : "No data available"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Selling Price</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">HPP</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Profit</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Margin</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Level</th>
                </tr></thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.productCode}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.categoryName ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatRp(item.sellingPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatRp(item.hpp)}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-green-600">{formatRp(item.profit)}</td>
                      <td className={`px-4 py-3 text-right font-bold font-mono ${marginColor(item.marginPercentage)}`}>
                        {item.marginPercentage.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center">{marginBadge(item.marginPercentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
