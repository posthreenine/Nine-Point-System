import { useState } from "react";
import {
  useGetTransactions, useGetTransaction, useVoidTransaction,
  getGetTransactionsQueryKey, getGetRestaurantTablesQueryKey, getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { cn } from "@/lib/utils";
import { PrintTicketsContainer, usePrintTicket, type PrintType } from "@/components/print-tickets";
import { Search, Receipt, RefreshCw, AlertTriangle, ChevronDown, Filter, Coffee, ChefHat, Users, Printer } from "lucide-react";
import type { Transaction, TransactionDetail } from "@workspace/api-client-react";

const STATUS_CONFIG = {
  open: { label: "Open", className: "bg-orange-100 text-orange-700 border-orange-200" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700 border-green-200" },
  void: { label: "Void", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Dine In",
  take_away: "Take Away",
  delivery: "Delivery",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  debit: "Debit",
  credit_card: "Credit Card",
  bank_transfer: "Transfer",
  qris: "QRIS",
};

function TransactionDetailView({ id, onClose }: { id: number; onClose: () => void }) {
  const { settings } = useStoreSettings();
  const sym = settings?.currencySymbol ?? "Rp";
  const fmt = (n: number) => `${sym} ${Math.round(n).toLocaleString("id-ID")}`;
  const { data: tx, isLoading } = useGetTransaction(id);
  const { printTicket } = usePrintTicket();
  const [printing, setPrinting] = useState<string | null>(null);

  async function doPrint(type: PrintType) {
    if (!tx) return;
    setPrinting(type);
    printTicket(type, tx);
    await new Promise(r => setTimeout(r, 800));
    setPrinting(null);
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading…</div>;
  if (!tx) return null;

  const date = new Date(tx.createdAt);
  const dateStr = `${date.toLocaleDateString("id-ID")} ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono font-bold text-base">{tx.invoiceNumber}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{dateStr}</div>
        </div>
        <Badge className={cn("border text-xs", STATUS_CONFIG[tx.status].className)}>{STATUS_CONFIG[tx.status].label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div><span className="text-muted-foreground">Cashier</span></div><div>{tx.cashierName}</div>
        <div><span className="text-muted-foreground">Type</span></div><div>{ORDER_TYPE_LABELS[tx.orderType]}</div>
        {tx.tableName && (<><div><span className="text-muted-foreground">Table</span></div><div>{tx.tableName}</div></>)}
        {tx.customerName && (<><div><span className="text-muted-foreground">Customer</span></div><div>{tx.customerName}</div></>)}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 text-xs font-medium text-muted-foreground">Item</th>
              <th className="text-center p-2 text-xs font-medium text-muted-foreground">Qty</th>
              <th className="text-right p-2 text-xs font-medium text-muted-foreground">Price</th>
              <th className="text-right p-2 text-xs font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {tx.items.map(item => (
              <tr key={item.id} className="border-t">
                <td className="p-2">
                  <div className="font-medium text-xs">{item.productName}</div>
                  {item.notes && <div className="text-xs text-muted-foreground">{item.notes}</div>}
                </td>
                <td className="p-2 text-center text-xs">{item.quantity}</td>
                <td className="p-2 text-right text-xs">{fmt(item.unitPrice)}</td>
                <td className="p-2 text-right text-xs font-medium">{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-sm bg-muted/30 rounded-lg p-3">
        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(tx.subtotal)}</span></div>
        {tx.discountAmount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>- {fmt(tx.discountAmount)}</span></div>}
        <div className="flex justify-between text-muted-foreground"><span>Tax ({settings?.taxPercentage ?? 0}%)</span><span>{fmt(tx.taxAmount)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Service ({settings?.serviceChargePercentage ?? 0}%)</span><span>{fmt(tx.serviceChargeAmount)}</span></div>
        <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="text-primary">{fmt(tx.totalAmount)}</span></div>
      </div>

      {tx.payment && (
        <div className="text-sm bg-green-50 rounded-lg p-3 space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{METHOD_LABELS[tx.payment.paymentMethod] ?? tx.payment.paymentMethod}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{fmt(tx.payment.amountPaid)}</span></div>
          {tx.payment.changeAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Change</span><span>{fmt(tx.payment.changeAmount)}</span></div>}
        </div>
      )}

      {tx.status === "paid" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Print</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => doPrint("receipt")} disabled={printing !== null}>
              <Receipt className="h-3.5 w-3.5" />Receipt
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => doPrint("waiter_copy")} disabled={printing !== null}>
              <Users className="h-3.5 w-3.5" />Waiter Copy
            </Button>
            {tx.items.some(i => i.productionStation === "bar" || i.productionStation === "both") && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => doPrint("bar_ticket")} disabled={printing !== null}>
                <Coffee className="h-3.5 w-3.5" />Bar Ticket
              </Button>
            )}
            {tx.items.some(i => i.productionStation === "kitchen" || i.productionStation === "both") && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => doPrint("kitchen_ticket")} disabled={printing !== null}>
                <ChefHat className="h-3.5 w-3.5" />Kitchen Ticket
              </Button>
            )}
            <Button size="sm" className="gap-1.5 text-xs col-span-2" onClick={async () => {
              await doPrint("receipt");
              if (tx.items.some(i => i.productionStation === "bar" || i.productionStation === "both")) await doPrint("bar_ticket");
              if (tx.items.some(i => i.productionStation === "kitchen" || i.productionStation === "both")) await doPrint("kitchen_ticket");
              await doPrint("waiter_copy");
            }} disabled={printing !== null}>
              <Printer className="h-3.5 w-3.5" />Print All
            </Button>
          </div>
        </div>
      )}

      {tx && <PrintTicketsContainer transaction={tx} />}
    </div>
  );
}

export default function Transactions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { settings } = useStoreSettings();
  const sym = settings?.currencySymbol ?? "Rp";
  const fmt = (n: number) => `${sym} ${Math.round(n).toLocaleString("id-ID")}`;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [voidConfirmId, setVoidConfirmId] = useState<number | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(today);

  const { data: transactions = [], isLoading, refetch } = useGetTransactions({
    date: dateFilter || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 500,
  });

  const voidTx = useVoidTransaction();

  const filtered = transactions.filter(tx => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return tx.invoiceNumber.toLowerCase().includes(q) ||
      (tx.cashierName?.toLowerCase().includes(q)) ||
      (tx.customerName?.toLowerCase().includes(q)) ||
      (tx.tableName?.toLowerCase().includes(q));
  });

  async function handleVoid(id: number) {
    try {
      await voidTx.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetRestaurantTablesQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast({ title: "Transaction voided" });
      setVoidConfirmId(null);
    } catch (err: any) {
      toast({ title: "Failed to void", description: err?.message, variant: "destructive" });
    }
  }

  const totalRevenue = filtered.filter(t => t.status === "paid").reduce((s, t) => s + t.totalAmount, 0);
  const paidCount = filtered.filter(t => t.status === "paid").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">View and manage POS transactions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 border-l-4 border-l-green-500">
          <p className="text-sm text-muted-foreground">Revenue</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 border-l-4 border-l-blue-500">
          <p className="text-sm text-muted-foreground">Paid Transactions</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{paidCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 border-l-4 border-l-slate-300">
          <p className="text-sm text-muted-foreground">Total Listed</p>
          <p className="text-2xl font-bold mt-1">{filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice, cashier, customer…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Input type="date" className="w-44" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Cashier</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Table</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={7} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No transactions found</p>
                  </td>
                </tr>
              ) : (
                filtered.map(tx => {
                  const date = new Date(tx.createdAt);
                  const dateStr = `${date.toLocaleDateString("id-ID")} ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
                  return (
                    <tr key={tx.id} className="border-t hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedId(tx.id)}>
                      <td className="p-3">
                        <div className="font-mono text-xs font-semibold">{tx.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground md:hidden">{dateStr}</div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{dateStr}</td>
                      <td className="p-3 text-xs hidden lg:table-cell">{tx.cashierName}</td>
                      <td className="p-3 text-xs hidden md:table-cell">{tx.tableName ?? <span className="text-muted-foreground capitalize">{tx.orderType.replace("_", " ")}</span>}</td>
                      <td className="p-3">
                        <Badge className={cn("border text-xs", STATUS_CONFIG[tx.status].className)}>{STATUS_CONFIG[tx.status].label}</Badge>
                      </td>
                      <td className="p-3 text-right font-semibold text-sm">{fmt(tx.totalAmount)}</td>
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedId(tx.id)}>
                            View
                          </Button>
                          {tx.status === "open" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setVoidConfirmId(tx.id)}>
                              Void
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={v => !v && setSelectedId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transaction Detail</DialogTitle></DialogHeader>
          {selectedId && <TransactionDetailView id={selectedId} onClose={() => setSelectedId(null)} />}
        </DialogContent>
      </Dialog>

      {/* Void Confirm */}
      <Dialog open={!!voidConfirmId} onOpenChange={v => !v && setVoidConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Void Transaction</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The transaction will be cancelled and the table will be freed.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setVoidConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => voidConfirmId && handleVoid(voidConfirmId)} disabled={voidTx.isPending}>
              {voidTx.isPending ? "Voiding…" : "Void"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
