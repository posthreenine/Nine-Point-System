import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStoreSettings } from "@/hooks/use-store-settings";
import {
  CheckCircle2, Printer, X, ChefHat, Coffee, Users, FileText, PrinterIcon,
} from "lucide-react";
import type { TransactionDetail } from "@workspace/api-client-react";
import {
  PrintTicketsContainer, usePrintTicket, type PrintType,
} from "@/components/print-tickets";
import { cn } from "@/lib/utils";

interface PaymentSuccessModalProps {
  open: boolean;
  onClose: () => void;
  transaction: TransactionDetail;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", debit: "Debit Card", credit_card: "Credit Card",
  bank_transfer: "Bank Transfer", qris: "QRIS",
};

export function PaymentSuccessModal({ open, onClose, transaction }: PaymentSuccessModalProps) {
  const { settings } = useStoreSettings();
  const { printTicket } = usePrintTicket();
  const [printing, setPrinting] = useState<string | null>(null);

  const sym = settings?.currencySymbol ?? "Rp";
  const fmt = (n: number) => `${sym} ${Math.round(n).toLocaleString("id-ID")}`;

  const hasBarItems = transaction.items.some(i => i.productionStation === "bar" || i.productionStation === "both");
  const hasKitchenItems = transaction.items.some(i => i.productionStation === "kitchen" || i.productionStation === "both");

  async function doPrint(type: PrintType) {
    setPrinting(type);
    printTicket(type, transaction);
    await new Promise(r => setTimeout(r, 800));
    setPrinting(null);
  }

  async function doPrintProduction() {
    if (hasBarItems) { await doPrint("bar_ticket"); await new Promise(r => setTimeout(r, 600)); }
    if (hasKitchenItems) { await doPrint("kitchen_ticket"); }
  }

  async function doPrintAll() {
    await doPrint("receipt");
    await new Promise(r => setTimeout(r, 600));
    if (hasBarItems) { await doPrint("bar_ticket"); await new Promise(r => setTimeout(r, 600)); }
    if (hasKitchenItems) { await doPrint("kitchen_ticket"); await new Promise(r => setTimeout(r, 600)); }
    await doPrint("waiter_copy");
  }

  const PrintBtn = ({
    onClick, icon: Icon, label, sublabel, variant = "outline", disabled = false, className = "",
  }: {
    onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; sublabel?: string;
    variant?: "outline" | "default" | "secondary"; disabled?: boolean; className?: string;
  }) => (
    <Button
      variant={variant}
      className={cn("h-auto py-3 px-4 flex flex-col items-center gap-1 text-center", className)}
      onClick={onClick}
      disabled={disabled || printing !== null}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-semibold leading-tight">{label}</span>
      {sublabel && <span className="text-[10px] text-muted-foreground leading-tight">{sublabel}</span>}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">Payment Successful</DialogTitle>
        {/* Success Header */}
        <div className="bg-green-50 px-6 pt-6 pb-5 text-center border-b">
          <div className="flex items-center justify-center mb-3">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-green-800">Payment Successful</h2>
          <p className="text-sm text-green-600 mt-1 font-mono font-semibold">{transaction.invoiceNumber}</p>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 space-y-2 border-b bg-card">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Paid</span>
            <span className="font-bold text-base text-primary">{fmt(transaction.totalAmount)}</span>
          </div>
          {transaction.payment && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Method</span>
                <span>{METHOD_LABELS[transaction.payment.paymentMethod] ?? transaction.payment.paymentMethod}</span>
              </div>
              {transaction.payment.changeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Change</span>
                  <span className="font-semibold">{fmt(transaction.payment.changeAmount)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 flex-wrap pt-1">
            {hasBarItems && <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50"><Coffee className="h-3 w-3 mr-1" />Bar Items</Badge>}
            {hasKitchenItems && <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50"><ChefHat className="h-3 w-3 mr-1" />Kitchen Items</Badge>}
          </div>
        </div>

        {/* Print Actions */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Print Options</p>
          <div className="grid grid-cols-3 gap-2">
            <PrintBtn onClick={() => doPrint("receipt")} icon={FileText} label="Receipt" sublabel="Customer copy" />
            <PrintBtn
              onClick={() => doPrint("bar_ticket")} icon={Coffee} label="Bar Ticket"
              sublabel={hasBarItems ? `${transaction.items.filter(i => i.productionStation === "bar" || i.productionStation === "both").length} items` : "No bar items"}
              disabled={!hasBarItems}
            />
            <PrintBtn
              onClick={() => doPrint("kitchen_ticket")} icon={ChefHat} label="Kitchen Ticket"
              sublabel={hasKitchenItems ? `${transaction.items.filter(i => i.productionStation === "kitchen" || i.productionStation === "both").length} items` : "No kitchen items"}
              disabled={!hasKitchenItems}
            />
            <PrintBtn onClick={() => doPrint("waiter_copy")} icon={Users} label="Waiter Copy" sublabel="All items" />
            <PrintBtn
              onClick={doPrintProduction} icon={PrinterIcon} label="Production" sublabel="Bar + Kitchen"
              disabled={!hasBarItems && !hasKitchenItems}
            />
            <PrintBtn onClick={doPrintAll} icon={Printer} label="Print All" sublabel="All tickets" variant="default" className="text-primary-foreground" />
          </div>
        </div>

        {/* Close */}
        <div className="px-6 pb-4">
          <Button variant="ghost" className="w-full gap-2" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        {/* Hidden ticket content — always in DOM when open */}
        {open && <PrintTicketsContainer transaction={transaction} />}
      </DialogContent>
    </Dialog>
  );
}
