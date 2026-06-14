import { useState } from "react";
import {
  useGetRestaurantTables, useUpdateRestaurantTable, useGetTransaction,
  getGetRestaurantTablesQueryKey, getGetTransactionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, BookMarked, ChevronRight, RefreshCw, X, Receipt } from "lucide-react";
import type { RestaurantTable } from "@workspace/api-client-react";

const STATUS_CONFIG = {
  available: { label: "Available", color: "bg-emerald-500", light: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: CheckCircle2 },
  occupied: { label: "Occupied", color: "bg-orange-500", light: "bg-orange-50 border-orange-200", text: "text-orange-700", icon: Clock },
  reserved: { label: "Reserved", color: "bg-blue-500", light: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: BookMarked },
};

function TableDetail({ table, onClose }: { table: RestaurantTable; onClose: () => void }) {
  const { settings } = useStoreSettings();
  const sym = settings?.currencySymbol ?? "Rp";
  const fmt = (n: number) => `${sym} ${Math.round(n).toLocaleString("id-ID")}`;
  const { data: tx } = useGetTransaction(table.currentTransactionId!, {
    query: { enabled: !!table.currentTransactionId, queryKey: getGetTransactionQueryKey(table.currentTransactionId!) },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">{table.name}</h3>
          <p className="text-sm text-muted-foreground">Capacity: {table.capacity} pax</p>
        </div>
        <Badge className={cn("capitalize", STATUS_CONFIG[table.status].light, STATUS_CONFIG[table.status].text, "border")}>
          {STATUS_CONFIG[table.status].label}
        </Badge>
      </div>

      {table.status === "occupied" && tx ? (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between font-medium">
            <span className="text-muted-foreground">Invoice</span>
            <span className="font-mono">{tx.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cashier</span><span>{tx.cashierName}</span>
          </div>
          {tx.customerName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span><span>{tx.customerName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items</span><span>{tx.items.length} items</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1 border-t">
            <span>Total</span><span className="text-primary">{fmt(tx.totalAmount)}</span>
          </div>
          <div className="border-t pt-2 space-y-1">
            {tx.items.map(i => (
              <div key={i.id} className="flex justify-between text-xs text-muted-foreground">
                <span>{i.quantity}× {i.productName}</span>
                <span>{fmt(i.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : table.status === "available" ? (
        <p className="text-sm text-muted-foreground text-center py-4">Table is available for new orders</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Table is reserved</p>
      )}
    </div>
  );
}

export default function Tables() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tables = [], isLoading, refetch } = useGetRestaurantTables();
  const updateTable = useUpdateRestaurantTable();

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const available = tables.filter(t => t.status === "available").length;
  const occupied = tables.filter(t => t.status === "occupied").length;
  const reserved = tables.filter(t => t.status === "reserved").length;

  async function handleStatusChange(tableId: number, status: "available" | "occupied" | "reserved") {
    setIsUpdating(true);
    try {
      await updateTable.mutateAsync({ id: tableId, data: { status } });
      await qc.invalidateQueries({ queryKey: getGetRestaurantTablesQueryKey() });
      toast({ title: `Table status updated to ${status}` });
      setSelectedTable(null);
    } catch (err: any) {
      toast({ title: "Failed to update table", description: err?.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Table Management</h1>
          <p className="text-muted-foreground mt-1">Manage restaurant tables and their status</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Available", count: available, color: "border-l-emerald-500 text-emerald-600" },
          { label: "Occupied", count: occupied, color: "border-l-orange-500 text-orange-600" },
          { label: "Reserved", count: reserved, color: "border-l-blue-500 text-blue-600" },
        ].map(s => (
          <div key={s.label} className={cn("bg-card border rounded-lg p-4 border-l-4", s.color.split(" ")[0])}>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={cn("text-3xl font-bold mt-1", s.color.split(" ")[1])}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10 gap-3">
          {tables.map(table => {
            const cfg = STATUS_CONFIG[table.status];
            return (
              <button
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={cn(
                  "aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all hover:shadow-md active:scale-95 relative",
                  cfg.light.split(" ")[0],
                  cfg.light.split(" ")[1],
                )}
              >
                <div className={cn("h-2.5 w-2.5 rounded-full mb-1.5", cfg.color)} />
                <span className="text-xs font-bold leading-tight text-center px-1">{table.name}</span>
                {table.currentInvoiceNumber && (
                  <Receipt className="h-3 w-3 mt-1 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={cn("h-3 w-3 rounded-full", v.color)} />
            <span className="text-muted-foreground">{v.label}</span>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedTable} onOpenChange={v => !v && setSelectedTable(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Table Details
              <button onClick={() => setSelectedTable(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </DialogTitle>
          </DialogHeader>

          {selectedTable && (
            <div className="space-y-4">
              <TableDetail table={selectedTable} onClose={() => setSelectedTable(null)} />

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {selectedTable.status !== "available" && selectedTable.status !== "occupied" && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => handleStatusChange(selectedTable.id, "available")} disabled={isUpdating}>
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Available
                  </Button>
                )}
                {selectedTable.status === "available" && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleStatusChange(selectedTable.id, "reserved")} disabled={isUpdating}>
                    <BookMarked className="h-4 w-4" />
                    Reserve
                  </Button>
                )}
                {selectedTable.status === "reserved" && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => handleStatusChange(selectedTable.id, "available")} disabled={isUpdating}>
                    <CheckCircle2 className="h-4 w-4" />
                    Release Reservation
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
