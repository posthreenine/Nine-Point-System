import { useCallback } from "react";
import { useStoreSettings } from "@/hooks/use-store-settings";
import type { TransactionDetail } from "@workspace/api-client-react";

export type PrintType = "receipt" | "bar_ticket" | "kitchen_ticket" | "waiter_copy";

const TICKET_DIV_IDS: Record<PrintType, string> = {
  receipt: "print-receipt-content",
  bar_ticket: "print-bar-ticket-content",
  kitchen_ticket: "print-kitchen-ticket-content",
  waiter_copy: "print-waiter-copy-content",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", debit: "Debit Card", credit_card: "Credit Card",
  bank_transfer: "Bank Transfer", qris: "QRIS",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Dine In", take_away: "Take Away", delivery: "Delivery",
};

export function usePrintTicket() {
  const logPrint = useCallback(async (transactionId: number, invoiceNumber: string, printType: PrintType) => {
    try {
      const token = localStorage.getItem("pos_token");
      await fetch("/api/print-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ transactionId, invoiceNumber, printType }),
      });
    } catch (_) {}
  }, []);

  const printTicket = useCallback((printType: PrintType, transaction: TransactionDetail) => {
    const divId = TICKET_DIV_IDS[printType];
    const styleId = `print-style-${printType}`;

    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @media print {
        body > * { visibility: hidden !important; }
        #${divId}, #${divId} * { visibility: visible !important; }
        #${divId} {
          position: fixed !important; top: 0 !important; left: 0 !important;
          width: 80mm !important; background: white !important;
          font-size: 11px !important; padding: 6px !important;
          font-family: 'Courier New', monospace !important;
        }
      }
    `;

    window.print();

    setTimeout(() => {
      style?.remove();
      logPrint(transaction.id, transaction.invoiceNumber, printType);
    }, 500);
  }, [logPrint]);

  return { printTicket, logPrint };
}

interface TicketProps {
  transaction: TransactionDetail;
}

function TicketDivider() {
  return <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />;
}

export function ReceiptTicket({ transaction }: TicketProps) {
  const { settings } = useStoreSettings();
  if (!settings) return null;
  const sym = settings.currencySymbol;
  const fmt = (n: number) => `${sym} ${Math.round(n).toLocaleString("id-ID")}`;
  const date = new Date(transaction.createdAt);
  const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div id={TICKET_DIV_IDS.receipt} style={{ display: "none", fontFamily: "monospace", fontSize: 11, background: "white", padding: 8, width: "80mm" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        {settings.logoUrl && <img src={settings.logoUrl} alt="logo" style={{ height: 40, display: "block", margin: "0 auto 4px" }} />}
        <div style={{ fontWeight: "bold", fontSize: 13, textTransform: "uppercase" }}>{settings.storeName}</div>
        {settings.address && <div style={{ color: "#555" }}>{settings.address}</div>}
        {settings.phoneNumber && <div style={{ color: "#555" }}>{settings.phoneNumber}</div>}
      </div>
      <TicketDivider />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Invoice</span><span style={{ fontWeight: "bold" }}>{transaction.invoiceNumber}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Date</span><span>{dateStr}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Time</span><span>{timeStr}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cashier</span><span>{transaction.cashierName}</span></div>
        {transaction.tableName && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Table</span><span>{transaction.tableName}</span></div>}
        {transaction.customerName && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Customer</span><span>{transaction.customerName}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Type</span><span>{ORDER_TYPE_LABELS[transaction.orderType] ?? transaction.orderType}</span></div>
      </div>
      <TicketDivider />
      <div>
        {transaction.items.map(item => (
          <div key={item.id} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ flex: 1 }}>{item.productName}</span>
              <span style={{ marginLeft: 8 }}>{fmt(item.subtotal)}</span>
            </div>
            <div style={{ color: "#555", paddingLeft: 8 }}>
              {item.quantity} × {fmt(item.unitPrice)}
              {item.notes && <span> ({item.notes})</span>}
            </div>
          </div>
        ))}
      </div>
      <TicketDivider />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{fmt(transaction.subtotal)}</span></div>
        {transaction.discountAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "red" }}><span>Discount</span><span>- {fmt(transaction.discountAmount)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tax ({settings.taxPercentage}%)</span><span>{fmt(transaction.taxAmount)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Service ({settings.serviceChargePercentage}%)</span><span>{fmt(transaction.serviceChargeAmount)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderTop: "1px solid #999", paddingTop: 4 }}>
          <span>TOTAL</span><span>{fmt(transaction.totalAmount)}</span>
        </div>
      </div>
      {transaction.payment && (
        <>
          <TicketDivider />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Payment</span><span>{METHOD_LABELS[transaction.payment.paymentMethod] ?? transaction.payment.paymentMethod}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Amount Paid</span><span>{fmt(transaction.payment.amountPaid)}</span></div>
            {transaction.payment.changeAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Change</span><span>{fmt(transaction.payment.changeAmount)}</span></div>}
            {transaction.payment.reference && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Ref</span><span>{transaction.payment.reference}</span></div>}
          </div>
        </>
      )}
      <TicketDivider />
      <div style={{ textAlign: "center", color: "#555", marginTop: 6 }}>{settings.receiptFooter || "Thank you for your visit!"}</div>
    </div>
  );
}

export function BarTicket({ transaction }: TicketProps) {
  const barItems = transaction.items.filter(i => i.productionStation === "bar" || i.productionStation === "both");
  const date = new Date(transaction.createdAt);
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div id={TICKET_DIV_IDS.bar_ticket} style={{ display: "none", fontFamily: "monospace", fontSize: 12, background: "white", padding: 8, width: "80mm" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: "bold", fontSize: 16, letterSpacing: 2 }}>★ BAR ORDER ★</div>
      </div>
      <TicketDivider />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Invoice</span><span style={{ fontWeight: "bold" }}>{transaction.invoiceNumber}</span></div>
        {transaction.tableName && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Table</span><span style={{ fontWeight: "bold" }}>{transaction.tableName}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Type</span><span>{ORDER_TYPE_LABELS[transaction.orderType] ?? transaction.orderType}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Time</span><span>{timeStr}</span></div>
      </div>
      <TicketDivider />
      {barItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "8px 0", color: "#999" }}>No bar items</div>
      ) : (
        <div>
          {barItems.map(item => (
            <div key={item.id} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>{item.productName}</span>
                <span>x{item.quantity}</span>
              </div>
              {item.notes && <div style={{ color: "#555", paddingLeft: 8, fontSize: 11 }}>Note: {item.notes}</div>}
            </div>
          ))}
        </div>
      )}
      <TicketDivider />
      <div style={{ marginTop: 16 }}>
        <span>Prepared By: </span>
        <span style={{ borderBottom: "1px solid #000", display: "inline-block", width: 120 }}>&nbsp;</span>
      </div>
    </div>
  );
}

export function KitchenTicket({ transaction }: TicketProps) {
  const kitchenItems = transaction.items.filter(i => i.productionStation === "kitchen" || i.productionStation === "both");
  const date = new Date(transaction.createdAt);
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div id={TICKET_DIV_IDS.kitchen_ticket} style={{ display: "none", fontFamily: "monospace", fontSize: 12, background: "white", padding: 8, width: "80mm" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: "bold", fontSize: 16, letterSpacing: 2 }}>★ KITCHEN ORDER ★</div>
      </div>
      <TicketDivider />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Invoice</span><span style={{ fontWeight: "bold" }}>{transaction.invoiceNumber}</span></div>
        {transaction.tableName && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Table</span><span style={{ fontWeight: "bold" }}>{transaction.tableName}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Type</span><span>{ORDER_TYPE_LABELS[transaction.orderType] ?? transaction.orderType}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Time</span><span>{timeStr}</span></div>
      </div>
      <TicketDivider />
      {kitchenItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "8px 0", color: "#999" }}>No kitchen items</div>
      ) : (
        <div>
          {kitchenItems.map(item => (
            <div key={item.id} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>{item.productName}</span>
                <span>x{item.quantity}</span>
              </div>
              {item.notes && <div style={{ color: "#555", paddingLeft: 8, fontSize: 11 }}>Note: {item.notes}</div>}
            </div>
          ))}
        </div>
      )}
      <TicketDivider />
      <div style={{ marginTop: 16 }}>
        <span>Prepared By: </span>
        <span style={{ borderBottom: "1px solid #000", display: "inline-block", width: 120 }}>&nbsp;</span>
      </div>
    </div>
  );
}

export function WaiterCopyTicket({ transaction }: TicketProps) {
  const date = new Date(transaction.createdAt);
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div id={TICKET_DIV_IDS.waiter_copy} style={{ display: "none", fontFamily: "monospace", fontSize: 12, background: "white", padding: 8, width: "80mm" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: "bold", fontSize: 15, letterSpacing: 2 }}>WAITER COPY</div>
      </div>
      <TicketDivider />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Invoice</span><span style={{ fontWeight: "bold" }}>{transaction.invoiceNumber}</span></div>
        {transaction.tableName && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Table</span><span style={{ fontWeight: "bold" }}>{transaction.tableName}</span></div>}
        {transaction.customerName && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Customer</span><span>{transaction.customerName}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Type</span><span>{ORDER_TYPE_LABELS[transaction.orderType] ?? transaction.orderType}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cashier</span><span>{transaction.cashierName}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Time</span><span>{timeStr}</span></div>
      </div>
      <TicketDivider />
      <div>
        {transaction.items.map(item => (
          <div key={item.id} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ flex: 1 }}>{item.productName}</span>
              <span style={{ marginLeft: 8 }}>x{item.quantity}</span>
            </div>
            {item.notes && <div style={{ color: "#555", paddingLeft: 8, fontSize: 11 }}>Note: {item.notes}</div>}
          </div>
        ))}
      </div>
      <TicketDivider />
      <div style={{ marginTop: 8, color: "#555", fontSize: 11, textAlign: "center" }}>
        {transaction.notes && <div>Order Note: {transaction.notes}</div>}
      </div>
    </div>
  );
}

export function PrintTicketsContainer({ transaction }: TicketProps) {
  return (
    <>
      <ReceiptTicket transaction={transaction} />
      <BarTicket transaction={transaction} />
      <KitchenTicket transaction={transaction} />
      <WaiterCopyTicket transaction={transaction} />
    </>
  );
}
