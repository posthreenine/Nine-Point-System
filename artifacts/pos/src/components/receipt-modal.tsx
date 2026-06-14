import { useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { useStoreSettings } from "@/hooks/use-store-settings";
import type { TransactionDetail } from "@workspace/api-client-react";

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  transaction: TransactionDetail;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  debit: "Debit Card",
  credit_card: "Credit Card",
  bank_transfer: "Bank Transfer",
  qris: "QRIS",
};

export function ReceiptModal({ open, onClose, transaction }: ReceiptModalProps) {
  const { settings } = useStoreSettings();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const style = document.createElement("style");
    style.id = "receipt-print-style";
    style.textContent = `
      @media print {
        body > * { visibility: hidden !important; }
        #receipt-content, #receipt-content * { visibility: visible !important; }
        #receipt-content {
          position: fixed !important; top: 0 !important; left: 0 !important;
          width: 80mm !important; background: white !important;
          font-size: 12px !important; padding: 8px !important;
        }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("receipt-print-style")?.remove(); };
  }, [open]);

  if (!settings) return null;

  const sym = settings.currencySymbol;
  const fmt = (n: number) => `${sym} ${n.toLocaleString("id-ID")}`;
  const date = new Date(transaction.createdAt);
  const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="no-print flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <span className="font-semibold text-gray-700">Receipt</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div id="receipt-content" ref={printRef} className="p-5 font-mono text-xs bg-white">
          <div className="text-center mb-4">
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="logo" className="h-12 w-12 mx-auto mb-2 object-contain" />
            )}
            <div className="font-bold text-sm uppercase">{settings.storeName}</div>
            {settings.address && <div className="text-gray-500">{settings.address}</div>}
            {settings.phoneNumber && <div className="text-gray-500">{settings.phoneNumber}</div>}
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-1 mb-2">
            <div className="flex justify-between">
              <span>Invoice</span><span className="font-semibold">{transaction.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date</span><span>{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span>Time</span><span>{timeStr}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier</span><span>{transaction.cashierName}</span>
            </div>
            {transaction.tableName && (
              <div className="flex justify-between">
                <span>Table</span><span>{transaction.tableName}</span>
              </div>
            )}
            {transaction.customerName && (
              <div className="flex justify-between">
                <span>Customer</span><span>{transaction.customerName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Type</span>
              <span className="capitalize">{transaction.orderType.replace("_", " ")}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-1 mb-2">
            {transaction.items.map(item => (
              <div key={item.id}>
                <div className="flex justify-between">
                  <span className="flex-1 truncate">{item.productName}</span>
                  <span className="ml-2">{fmt(item.subtotal)}</span>
                </div>
                <div className="text-gray-500 pl-2">
                  {item.quantity} × {fmt(item.unitPrice)}
                  {item.notes && <span> ({item.notes})</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-1 mb-2">
            <div className="flex justify-between">
              <span>Subtotal</span><span>{fmt(transaction.subtotal)}</span>
            </div>
            {transaction.discountAmount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span><span>- {fmt(transaction.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax ({settings.taxPercentage}%)</span><span>{fmt(transaction.taxAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Service ({settings.serviceChargePercentage}%)</span><span>{fmt(transaction.serviceChargeAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-1">
              <span>TOTAL</span><span>{fmt(transaction.totalAmount)}</span>
            </div>
          </div>

          {transaction.payment && (
            <div className="space-y-1 mb-2 border-t border-dashed border-gray-300 pt-2">
              <div className="flex justify-between">
                <span>Payment</span><span>{METHOD_LABELS[transaction.payment.paymentMethod] ?? transaction.payment.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid</span><span>{fmt(transaction.payment.amountPaid)}</span>
              </div>
              {transaction.payment.changeAmount > 0 && (
                <div className="flex justify-between">
                  <span>Change</span><span>{fmt(transaction.payment.changeAmount)}</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="text-center text-gray-500 mt-3">
            {settings.receiptFooter || "Thank you for your visit!"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
