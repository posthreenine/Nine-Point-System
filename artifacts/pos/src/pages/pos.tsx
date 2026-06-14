import { useState, useMemo } from "react";
import {
  useGetCategories, useGetProducts, useGetRestaurantTables,
  useCreateTransaction, usePayTransaction, useGetQrisSettings,
  getGetRestaurantTablesQueryKey, getGetTransactionsQueryKey, getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ReceiptModal } from "@/components/receipt-modal";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, QrCode, Building2, ChevronDown, Coffee, X,
  CheckCircle2,
} from "lucide-react";
import type { TransactionDetail, Product } from "@workspace/api-client-react";

type CartItem = {
  productId: number;
  name: string;
  code: string;
  price: number;
  quantity: number;
  notes: string;
  imageUrl: string | null;
};

type OrderType = "dine_in" | "take_away" | "delivery";
type PaymentMethod = "cash" | "debit" | "credit_card" | "bank_transfer" | "qris";

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "dine_in", label: "Dine In" },
  { value: "take_away", label: "Take Away" },
  { value: "delivery", label: "Delivery" },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "debit", label: "Debit", icon: CreditCard },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "bank_transfer", label: "Transfer", icon: Building2 },
  { value: "qris", label: "QRIS", icon: QrCode },
];

export default function POS() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { settings } = useStoreSettings();
  const { user } = useAuth();

  const { data: categories = [] } = useGetCategories();
  const { data: allProducts = [] } = useGetProducts();
  const { data: tables = [] } = useGetRestaurantTables();
  const { data: qrisSettings } = useGetQrisSettings();

  const createTx = useCreateTransaction();
  const payTx = usePayTransaction();

  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableId, setTableId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountInput, setDiscountInput] = useState("");

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [completedTx, setCompletedTx] = useState<TransactionDetail | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const sym = settings?.currencySymbol ?? "Rp";
  const taxPct = settings?.taxPercentage ?? 0;
  const svcPct = settings?.serviceChargePercentage ?? 0;

  const fmt = (n: number) => `${sym} ${Math.round(n).toLocaleString("id-ID")}`;

  const activeProducts = useMemo(() =>
    allProducts.filter(p => p.status === "active"),
    [allProducts]
  );

  const filtered = useMemo(() => {
    let list = activeProducts;
    if (selectedCat) list = list.filter(p => p.categoryId === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    return list;
  }, [activeProducts, selectedCat, search]);

  const availableTables = tables.filter(t => t.status === "available");
  const selectedTable = tables.find(t => t.id === tableId);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(taxableBase * taxPct / 100);
  const svcAmount = Math.round(taxableBase * svcPct / 100);
  const total = taxableBase + taxAmount + svcAmount;
  const cashAmt = parseFloat(cashReceived.replace(/\D/g, "")) || 0;
  const change = Math.max(0, cashAmt - total);

  function addToCart(product: Product) {
    setCartItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        code: product.code,
        price: product.sellingPrice,
        quantity: 1,
        notes: "",
        imageUrl: product.imageUrl ?? null,
      }];
    });
  }

  function updateQty(productId: number, delta: number) {
    setCartItems(prev => {
      const updated = prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i);
      return updated.filter(i => i.quantity > 0);
    });
  }

  function removeItem(productId: number) {
    setCartItems(prev => prev.filter(i => i.productId !== productId));
  }

  function updateNotes(productId: number, notes: string) {
    setCartItems(prev => prev.map(i => i.productId === productId ? { ...i, notes } : i));
  }

  function clearOrder() {
    setCartItems([]);
    setTableId(null);
    setCustomerName("");
    setDiscountAmount(0);
    setDiscountInput("");
    setCashReceived("");
    setPaymentMethod("cash");
  }

  async function handleConfirmPayment() {
    if (cartItems.length === 0) return;
    if (orderType === "dine_in" && !tableId) {
      toast({ title: "Please select a table", variant: "destructive" }); return;
    }
    if (paymentMethod === "cash" && cashAmt < total) {
      toast({ title: "Insufficient cash amount", variant: "destructive" }); return;
    }
    setIsProcessing(true);
    try {
      const tx = await createTx.mutateAsync({
        data: {
          orderType,
          tableId: tableId ?? undefined,
          customerName: customerName || undefined,
          discountAmount: discountAmount || undefined,
          items: cartItems.map(i => ({ productId: i.productId, quantity: i.quantity, notes: i.notes || undefined })),
        },
      });

      const paid = await payTx.mutateAsync({ id: tx.id, data: { paymentMethod, amountPaid: cashAmt || total } });

      await qc.invalidateQueries({ queryKey: getGetRestaurantTablesQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });

      setCompletedTx(paid);
      setIsPayOpen(false);
      setIsReceiptOpen(true);
      clearOrder();
      toast({ title: `Payment confirmed — ${paid.invoiceNumber}` });
    } catch (err: any) {
      toast({ title: "Payment failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden -m-5 md:-m-8">
      {/* Category Sidebar */}
      <aside className="hidden lg:flex flex-col w-44 bg-sidebar border-r border-sidebar-border overflow-y-auto shrink-0">
        <div className="p-3 border-b border-sidebar-border">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">Category</p>
        </div>
        <nav className="p-2 space-y-1">
          <button
            onClick={() => setSelectedCat(null)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              selectedCat === null
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Coffee className="h-4 w-4 inline mr-2 opacity-70" />
            All
          </button>
          {categories.filter(c => c.status === "active").map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                selectedCat === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              {cat.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Product Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="shrink-0 px-4 py-3 border-b bg-card flex flex-wrap gap-2 items-center">
          {/* Mobile categories */}
          <div className="flex gap-1 overflow-x-auto lg:hidden pb-1">
            <button onClick={() => setSelectedCat(null)} className={cn("shrink-0 px-3 py-1 rounded-full text-xs font-medium border", selectedCat === null ? "bg-primary text-primary-foreground border-primary" : "border-border")}>All</button>
            {categories.filter(c => c.status === "active").map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)} className={cn("shrink-0 px-3 py-1 rounded-full text-xs font-medium border", selectedCat === cat.id ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{cat.name}</button>
            ))}
          </div>

          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products…" className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="flex gap-1">
            {ORDER_TYPES.map(ot => (
              <button
                key={ot.value}
                onClick={() => { setOrderType(ot.value); if (ot.value !== "dine_in") setTableId(null); }}
                className={cn("px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors", orderType === ot.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}
              >
                {ot.label}
              </button>
            ))}
          </div>

          {orderType === "dine_in" && (
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={tableId ?? ""}
              onChange={e => setTableId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select table</option>
              {availableTables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map(product => {
                const inCart = cartItems.find(i => i.productId === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={cn(
                      "relative flex flex-col rounded-xl border bg-card text-left transition-all hover:shadow-md active:scale-95 overflow-hidden",
                      inCart && "ring-2 ring-primary"
                    )}
                  >
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                        <Coffee className="h-8 w-8 text-primary/30" />
                      </div>
                    )}
                    {inCart && (
                      <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {inCart.quantity}
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-semibold leading-tight line-clamp-2">{product.name}</p>
                      <p className="text-sm font-bold text-primary mt-1">{fmt(product.sellingPrice)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <aside className="w-72 xl:w-80 shrink-0 flex flex-col border-l bg-card overflow-hidden">
        <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-semibold">Order</span>
            {cartItems.length > 0 && <Badge variant="secondary" className="text-xs">{cartItems.length}</Badge>}
          </div>
          {cartItems.length > 0 && (
            <button onClick={clearOrder} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear</button>
          )}
        </div>

        {/* Customer info */}
        <div className="px-3 py-2 border-b bg-muted/30 shrink-0">
          <Input
            placeholder="Customer name (optional)"
            className="h-8 text-xs"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />
          {orderType === "dine_in" && selectedTable && (
            <p className="text-xs text-muted-foreground mt-1.5">📍 {selectedTable.name}</p>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1 opacity-70">Tap a product to add</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {cartItems.map(item => (
                <div key={item.productId} className="bg-background rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-primary font-medium">{fmt(item.price)}</p>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(item.productId, -1)} className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, 1)} className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-xs font-semibold">{fmt(item.price * item.quantity)}</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Notes…"
                    value={item.notes}
                    onChange={e => updateNotes(item.productId, e.target.value)}
                    className="mt-1.5 w-full text-xs border border-border rounded px-2 py-1 bg-muted/50 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="shrink-0 border-t p-3 space-y-2 bg-card">
          {/* Discount */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex-1">Discount</span>
            <Input
              type="text"
              inputMode="numeric"
              className="h-7 w-32 text-xs text-right"
              placeholder="0"
              value={discountInput}
              onChange={e => {
                setDiscountInput(e.target.value);
                const v = parseFloat(e.target.value.replace(/\D/g, "")) || 0;
                setDiscountAmount(v);
              }}
            />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>- {fmt(discountAmount)}</span></div>}
            <div className="flex justify-between"><span>Tax ({taxPct}%)</span><span>{fmt(taxAmount)}</span></div>
            <div className="flex justify-between"><span>Service ({svcPct}%)</span><span>{fmt(svcAmount)}</span></div>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Total</span><span className="text-primary">{fmt(total)}</span>
          </div>
          <Button
            className="w-full h-12 text-base font-bold"
            disabled={cartItems.length === 0}
            onClick={() => setIsPayOpen(true)}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Pay Now
          </Button>
        </div>
      </aside>

      {/* Payment Modal */}
      <Dialog open={isPayOpen} onOpenChange={v => !v && !isProcessing && setIsPayOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>{cartItems.length} item(s)</span>
                <span className="capitalize">{orderType.replace("_", " ")} {selectedTable ? `· ${selectedTable.name}` : ""}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>Total Due</span>
                <span className="text-primary">{fmt(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <p className="text-sm font-medium mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors",
                      paymentMethod === m.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                    )}
                  >
                    <m.icon className="h-5 w-5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash: amount input */}
            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Cash Received</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="text-lg font-bold text-right h-12"
                  placeholder={fmt(total)}
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value.replace(/[^0-9]/g, ""))}
                />
                {cashAmt > 0 && (
                  <div className={cn("flex justify-between text-sm font-semibold p-2 rounded-md", change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                    <span>Change</span>
                    <span>{fmt(change)}</span>
                  </div>
                )}
                {/* Quick amounts */}
                <div className="flex flex-wrap gap-1.5">
                  {[total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000].filter((v, i, a) => a.indexOf(v) === i).map(amt => (
                    <button
                      key={amt}
                      onClick={() => setCashReceived(String(amt))}
                      className="px-3 py-1 rounded-md border text-xs hover:bg-accent transition-colors"
                    >
                      {fmt(amt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* QRIS: show image */}
            {paymentMethod === "qris" && (
              <div className="text-center space-y-2">
                {qrisSettings?.qrisImageUrl ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{qrisSettings.merchantName}</p>
                    <img src={qrisSettings.qrisImageUrl} alt="QRIS" className="mx-auto max-h-56 rounded-lg border" />
                    <p className="text-xs text-muted-foreground mt-2">Ask customer to scan QR code, then confirm below</p>
                  </div>
                ) : (
                  <div className="p-8 bg-muted rounded-lg">
                    <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No QRIS image configured</p>
                    <p className="text-xs text-muted-foreground">Go to Admin → QRIS Settings to upload QR code</p>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-bold gap-2"
              onClick={handleConfirmPayment}
              disabled={isProcessing || (paymentMethod === "cash" && cashAmt < total)}
            >
              {isProcessing ? (
                <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-primary-foreground animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {isProcessing ? "Processing…" : "Confirm Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      {completedTx && (
        <ReceiptModal
          open={isReceiptOpen}
          onClose={() => { setIsReceiptOpen(false); setCompletedTx(null); }}
          transaction={completedTx}
        />
      )}
    </div>
  );
}
