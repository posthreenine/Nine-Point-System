import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchReport, postReport, formatRp } from "@/lib/report-api";
import { Clock, DollarSign, TrendingUp, Users, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Shift {
  id: number;
  cashierId: number;
  cashierName: string;
  cashierUsername: string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  notes: string | null;
  status: string;
  startedAt: string;
  closedAt: string | null;
}

interface CurrentShift {
  id: number;
  cashierName: string;
  openingCash: number;
  expectedCash: number;
  status: string;
  startedAt: string;
  stats: { transactionCount: number; revenue: number };
}

export default function ShiftsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openCash, setOpenCash] = useState("");
  const [closeCash, setCloseCash] = useState("");
  const [notes, setNotes] = useState("");

  const { data: current, isLoading: loadingCurrent } = useQuery<CurrentShift | null>({
    queryKey: ["shifts", "current"],
    queryFn: () => fetchReport<CurrentShift | null>("/shifts/current"),
    refetchInterval: 30000,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<Shift[]>({
    queryKey: ["shifts", "history"],
    queryFn: () => fetchReport<Shift[]>("/shifts"),
  });

  const openMutation = useMutation({
    mutationFn: (data: { openingCash: number; notes?: string }) =>
      postReport("/shifts/open", data),
    onSuccess: () => {
      toast({ title: "Shift opened successfully" });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setOpenDialog(false);
      setOpenCash("");
      setNotes("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: (data: { closingCash: number; notes?: string }) =>
      postReport(`/shifts/${current?.id}/close`, data),
    onSuccess: () => {
      toast({ title: "Shift closed successfully" });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setCloseDialog(false);
      setCloseCash("");
      setNotes("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleOpen() {
    openMutation.mutate({ openingCash: parseFloat(openCash) || 0, notes: notes || undefined });
  }

  function handleClose() {
    closeMutation.mutate({ closingCash: parseFloat(closeCash) || 0, notes: notes || undefined });
  }

  const diff = current && closeCash
    ? (parseFloat(closeCash) || 0) - current.expectedCash
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Shift Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage cashier shifts and cash balances</p>
        </div>
        <Button onClick={() => qc.invalidateQueries({ queryKey: ["shifts"] })} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loadingCurrent ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : current ? (
        <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                Active Shift
              </CardTitle>
              <Button onClick={() => { setNotes(""); setCloseCash(""); setCloseDialog(true); }} variant="destructive" size="sm">
                Close Shift
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Cashier</p>
                <p className="font-semibold">{current.cashierName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="font-semibold text-sm">{format(new Date(current.startedAt), "HH:mm, dd MMM")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Opening Cash</p>
                <p className="font-semibold">{formatRp(current.openingCash)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expected Cash</p>
                <p className="font-semibold text-green-700 dark:text-green-400">{formatRp(current.expectedCash)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="font-semibold">{current.stats.transactionCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="font-semibold">{formatRp(current.stats.revenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground font-medium">No active shift</p>
            <Button onClick={() => { setOpenCash(""); setNotes(""); setOpenDialog(true); }}>
              Open Shift
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Shift History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No shift history yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3 font-medium">Cashier</th>
                    <th className="text-left py-2 pr-3 font-medium">Started</th>
                    <th className="text-left py-2 pr-3 font-medium">Closed</th>
                    <th className="text-right py-2 pr-3 font-medium">Opening</th>
                    <th className="text-right py-2 pr-3 font-medium">Expected</th>
                    <th className="text-right py-2 pr-3 font-medium">Closing</th>
                    <th className="text-right py-2 pr-3 font-medium">Difference</th>
                    <th className="text-center py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{s.cashierName}</p>
                        <p className="text-xs text-muted-foreground">@{s.cashierUsername}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-sm">{format(new Date(s.startedAt), "dd MMM HH:mm")}</td>
                      <td className="py-2.5 pr-3 text-sm">{s.closedAt ? format(new Date(s.closedAt), "dd MMM HH:mm") : "—"}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs">{formatRp(s.openingCash)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs">{s.expectedCash != null ? formatRp(s.expectedCash) : "—"}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs">{s.closingCash != null ? formatRp(s.closingCash) : "—"}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs">
                        {s.difference != null ? (
                          <span className={s.difference >= 0 ? "text-green-600" : "text-red-500"}>
                            {s.difference >= 0 ? "+" : ""}{formatRp(s.difference)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge variant={s.status === "open" ? "default" : "secondary"} className="text-xs">
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open New Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Opening Cash (Rp)</Label>
              <Input
                type="number"
                placeholder="0"
                value={openCash}
                onChange={e => setOpenCash(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="Any notes..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleOpen} disabled={openMutation.isPending}>
              {openMutation.isPending ? "Opening..." : "Open Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {current && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opening Cash</span>
                  <span className="font-medium">{formatRp(current.openingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Cash</span>
                  <span className="font-medium text-green-600">{formatRp(current.expectedCash)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Actual Closing Cash (Rp)</Label>
              <Input
                type="number"
                placeholder="0"
                value={closeCash}
                onChange={e => setCloseCash(e.target.value)}
                autoFocus
              />
            </div>
            {diff !== null && (
              <div className={`rounded-lg p-3 text-sm font-medium flex justify-between ${diff >= 0 ? "bg-green-50 text-green-700 dark:bg-green-950/30" : "bg-red-50 text-red-600 dark:bg-red-950/30"}`}>
                <span>Difference</span>
                <span>{diff >= 0 ? "+" : ""}{formatRp(diff)}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="Any notes..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClose} disabled={closeMutation.isPending}>
              {closeMutation.isPending ? "Closing..." : "Close Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
