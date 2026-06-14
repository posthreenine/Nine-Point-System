import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTransactionsQueryKey,
  getGetDashboardStatsQueryKey,
  getGetRestaurantTablesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldAlert, Trash2, ReceiptText, CreditCard, PrinterIcon,
  ChefHat, BarChart3, AlertTriangle, RefreshCw, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MaintenanceStats {
  openTransactions: number;
  paidTransactions: number;
  voidTransactions: number;
  payments: number;
  printLogs: number;
  kdsOrders: number;
}

interface ResetOperation {
  id: string;
  label: string;
  description: string;
  deletes: string[];
  preserves: string[];
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  borderColor: string;
  impactLevel: "low" | "medium" | "high";
  statLine: (s: MaintenanceStats) => string;
  endpoint: string;
  invalidates: "transactions" | "payments" | "none";
}

const OPERATIONS: ResetOperation[] = [
  {
    id: "reset-test-transactions",
    label: "Reset Test Transactions",
    description: "Remove all OPEN (unpaid) transactions — useful to clear test orders before going live.",
    deletes: ["Open transactions", "Their order items", "Associated print logs & KDS entries", "Frees occupied tables"],
    preserves: ["Paid transactions", "Payment records", "Sales history"],
    icon: Trash2,
    iconColor: "text-orange-500",
    borderColor: "border-l-orange-400",
    impactLevel: "low",
    statLine: (s) => `${s.openTransactions} open transaction${s.openTransactions !== 1 ? "s" : ""} will be removed`,
    endpoint: "/api/maintenance/reset-test-transactions",
    invalidates: "transactions",
  },
  {
    id: "reset-sales-history",
    label: "Reset Sales History",
    description: "Permanently delete ALL transaction records — open, paid, and voided. Full history wipe.",
    deletes: ["All transactions (open, paid, void)", "All order items", "All payments", "All print logs", "All KDS orders", "Frees all tables"],
    preserves: ["Users", "Products & categories", "Ingredients & inventory", "Recipes", "Store settings", "Printer settings"],
    icon: ReceiptText,
    iconColor: "text-red-500",
    borderColor: "border-l-red-500",
    impactLevel: "high",
    statLine: (s) => `${s.openTransactions + s.paidTransactions + s.voidTransactions} transaction${s.openTransactions + s.paidTransactions + s.voidTransactions !== 1 ? "s" : ""} total will be permanently deleted`,
    endpoint: "/api/maintenance/reset-sales-history",
    invalidates: "transactions",
  },
  {
    id: "reset-payment-history",
    label: "Reset Payment History",
    description: "Delete payment records only. Paid transactions will revert to open status.",
    deletes: ["Payment records", "Reverts paid transactions to open"],
    preserves: ["Transactions (now open)", "Order items", "Table assignments"],
    icon: CreditCard,
    iconColor: "text-yellow-500",
    borderColor: "border-l-yellow-400",
    impactLevel: "medium",
    statLine: (s) => `${s.payments} payment record${s.payments !== 1 ? "s" : ""} will be removed`,
    endpoint: "/api/maintenance/reset-payment-history",
    invalidates: "transactions",
  },
  {
    id: "reset-print-logs",
    label: "Reset Print Logs",
    description: "Clear all print history records. Reprint counts reset to zero.",
    deletes: ["All print log entries", "Reprint count history"],
    preserves: ["Transactions", "Payments", "Products", "All other data"],
    icon: PrinterIcon,
    iconColor: "text-blue-500",
    borderColor: "border-l-blue-400",
    impactLevel: "low",
    statLine: (s) => `${s.printLogs} print log${s.printLogs !== 1 ? "s" : ""} will be cleared`,
    endpoint: "/api/maintenance/reset-print-logs",
    invalidates: "none",
  },
  {
    id: "reset-kds-orders",
    label: "Reset KDS Orders",
    description: "Clear the kitchen display system queue. All stations will show empty.",
    deletes: ["All KDS order queue entries"],
    preserves: ["Transactions", "Payments", "Products", "All other data"],
    icon: ChefHat,
    iconColor: "text-orange-500",
    borderColor: "border-l-orange-400",
    impactLevel: "low",
    statLine: (s) => `${s.kdsOrders} KDS order${s.kdsOrders !== 1 ? "s" : ""} will be cleared`,
    endpoint: "/api/maintenance/reset-kds-orders",
    invalidates: "none",
  },
  {
    id: "reset-dashboard-analytics",
    label: "Reset Dashboard Analytics",
    description: "Wipe all transaction data so the dashboard shows zero. Full analytics reset.",
    deletes: ["All transactions", "All order items", "All payments", "All print logs", "All KDS orders", "Frees all tables"],
    preserves: ["Users", "Products & categories", "Ingredients & inventory", "Recipes", "Store settings"],
    icon: BarChart3,
    iconColor: "text-red-500",
    borderColor: "border-l-red-500",
    impactLevel: "high",
    statLine: (s) => `Dashboard will reset to 0 — ${s.openTransactions + s.paidTransactions + s.voidTransactions} transaction${s.openTransactions + s.paidTransactions + s.voidTransactions !== 1 ? "s" : ""} will be deleted`,
    endpoint: "/api/maintenance/reset-dashboard-analytics",
    invalidates: "transactions",
  },
];

const IMPACT_CONFIG = {
  low: { label: "Low Impact", className: "bg-green-100 text-green-700 border-green-300 border" },
  medium: { label: "Medium Impact", className: "bg-yellow-100 text-yellow-700 border-yellow-300 border" },
  high: { label: "High Impact", className: "bg-red-100 text-red-700 border-red-300 border" },
};

function getToken() {
  return localStorage.getItem("pos_token") ?? "";
}

export default function Maintenance() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedOp, setSelectedOp] = useState<ResetOperation | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Owner-only guard
  useEffect(() => {
    if (user && user.roleName !== "Owner") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/maintenance/stats", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load stats");
      setStats(await res.json());
    } catch {
      toast({ variant: "destructive", title: "Could not load maintenance stats" });
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => { loadStats(); }, []);

  function openConfirm(op: ResetOperation) {
    setSelectedOp(op);
    setConfirmText("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function closeConfirm() {
    setSelectedOp(null);
    setConfirmText("");
  }

  async function handleReset() {
    if (!selectedOp || confirmText !== "RESET") return;
    setResetting(true);
    try {
      const res = await fetch(selectedOp.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");

      toast({ title: `✓ ${selectedOp.label}`, description: data.message });

      // Invalidate queries
      if (selectedOp.invalidates === "transactions") {
        await qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
        await qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        await qc.invalidateQueries({ queryKey: getGetRestaurantTablesQueryKey() });
      }

      closeConfirm();
      loadStats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Reset failed", description: err.message });
    } finally {
      setResetting(false);
    }
  }

  if (user && user.roleName !== "Owner") return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-destructive" />
            System Maintenance
          </h1>
          <p className="text-muted-foreground mt-1">Restricted to Owner role. All operations are permanent and cannot be undone.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats} disabled={loadingStats} className="gap-1.5 shrink-0">
          <RefreshCw className={cn("h-4 w-4", loadingStats && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Warning banner */}
      <div className="flex gap-3 bg-destructive/8 border border-destructive/30 rounded-lg px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <span className="font-semibold text-destructive">Caution:</span>
          <span className="text-foreground/80"> These operations permanently delete data from the database. They are designed for resetting test data before going live or clearing historical records. Users, products, categories, ingredients, inventory, recipes and store settings are never deleted.</span>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Open Tx", value: stats.openTransactions, color: "text-orange-600" },
            { label: "Paid Tx", value: stats.paidTransactions, color: "text-green-600" },
            { label: "Void Tx", value: stats.voidTransactions, color: "text-gray-500" },
            { label: "Payments", value: stats.payments, color: "text-blue-600" },
            { label: "Print Logs", value: stats.printLogs, color: "text-purple-600" },
            { label: "KDS Orders", value: stats.kdsOrders, color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="text-center py-3 px-2">
              <div className={cn("text-2xl font-bold tabular-nums", color)}>{value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Operations grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OPERATIONS.map(op => {
          const Icon = op.icon;
          const impact = IMPACT_CONFIG[op.impactLevel];
          return (
            <Card key={op.id} className={cn("border-l-4", op.borderColor)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-md bg-muted p-1.5">
                      <Icon className={cn("h-5 w-5", op.iconColor)} />
                    </div>
                    <CardTitle className="text-base leading-tight">{op.label}</CardTitle>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0", impact.className)}>{impact.label}</Badge>
                </div>
                <CardDescription className="mt-1.5">{op.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-destructive mb-1">Deletes:</p>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {op.deletes.map(d => <li key={d} className="flex gap-1"><span className="text-destructive">✕</span>{d}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-green-700 mb-1">Preserves:</p>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {op.preserves.map(p => <li key={p} className="flex gap-1"><span className="text-green-600">✓</span>{p}</li>)}
                    </ul>
                  </div>
                </div>
                {stats && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 font-medium">
                    {op.statLine(stats)}
                  </p>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => openConfirm(op)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!selectedOp} onOpenChange={v => !v && closeConfirm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Confirm: {selectedOp?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="bg-destructive/8 border border-destructive/25 rounded-lg p-3 text-sm">
              <p className="font-semibold text-destructive mb-1">This action cannot be undone.</p>
              <p className="text-foreground/80">{selectedOp?.description}</p>
            </div>

            {selectedOp && stats && (
              <div className="bg-muted/60 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80">
                {selectedOp.statLine(stats)}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">RESET</span> to confirm
              </label>
              <Input
                ref={inputRef}
                placeholder="Type RESET here…"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && confirmText === "RESET") handleReset(); }}
                className={cn(
                  "font-mono transition-colors",
                  confirmText === "RESET" && "border-destructive ring-1 ring-destructive/40"
                )}
                autoComplete="off"
              />
              {confirmText.length > 0 && confirmText !== "RESET" && (
                <p className="text-xs text-muted-foreground">Keep typing — must be exactly "RESET"</p>
              )}
              {confirmText === "RESET" && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Ready to execute — click Reset to proceed
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeConfirm} disabled={resetting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={confirmText !== "RESET" || resetting}
              className="gap-1.5 min-w-[100px]"
            >
              {resetting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {resetting ? "Resetting…" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
