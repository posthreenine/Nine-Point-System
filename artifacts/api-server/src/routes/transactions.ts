import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { CreateTransactionBody, PayTransactionBody, GetTransactionParams, PayTransactionParams, VoidTransactionParams } from "@workspace/api-zod";

const router: IRouter = Router();

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `TN-${year}-`;
  const last = db.prepare(`
    SELECT invoice_number FROM transactions
    WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`) as { invoice_number: string } | undefined;

  let seq = 1;
  if (last) {
    const parts = last.invoice_number.split("-");
    seq = parseInt(parts[parts.length - 1] || "0", 10) + 1;
  }
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

function getStoreSettings() {
  return db.prepare("SELECT tax_percentage, service_charge_percentage FROM store_settings LIMIT 1").get() as
    { tax_percentage: number; service_charge_percentage: number };
}

function fmtTransaction(t: any) {
  const cashier = db.prepare("SELECT full_name FROM users WHERE id = ?").get(t.cashier_id) as { full_name: string } | undefined;
  const table = t.table_id ? db.prepare("SELECT name FROM restaurant_tables WHERE id = ?").get(t.table_id) as { name: string } | undefined : null;
  const itemCount = (db.prepare("SELECT COUNT(*) as c FROM transaction_items WHERE transaction_id = ?").get(t.id) as { c: number }).c;
  return {
    id: t.id,
    invoiceNumber: t.invoice_number,
    orderType: t.order_type,
    status: t.status,
    tableId: t.table_id ?? null,
    tableName: table?.name ?? null,
    customerName: t.customer_name ?? null,
    notes: t.notes ?? null,
    cashierId: t.cashier_id,
    cashierName: cashier?.full_name ?? "Unknown",
    subtotal: t.subtotal,
    discountAmount: t.discount_amount,
    taxAmount: t.tax_amount,
    serviceChargeAmount: t.service_charge_amount,
    totalAmount: t.total_amount,
    itemCount,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function fmtTransactionDetail(t: any) {
  const base = fmtTransaction(t);
  const items = db.prepare("SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC").all(t.id) as any[];
  const payment = db.prepare("SELECT * FROM payments WHERE transaction_id = ? LIMIT 1").get(t.id) as any | undefined;

  return {
    ...base,
    items: items.map(i => {
      const prod = db.prepare("SELECT production_station FROM products WHERE id = ?").get(i.product_id) as { production_station: string } | undefined;
      return {
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        productCode: i.product_code,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        subtotal: i.subtotal,
        notes: i.notes ?? null,
        productionStation: prod?.production_station ?? "none",
      };
    }),
    payment: payment ? {
      id: payment.id,
      paymentMethod: payment.payment_method,
      amountPaid: payment.amount_paid,
      changeAmount: payment.change_amount,
      status: payment.status,
      reference: payment.reference ?? null,
      createdAt: payment.created_at,
    } : null,
  };
}

function deductStock(transactionId: number, cashierId: number) {
  const items = db.prepare("SELECT * FROM transaction_items WHERE transaction_id = ?").all(transactionId) as any[];
  const insMovement = db.prepare("INSERT INTO stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)");

  for (const item of items) {
    const recipe = db.prepare("SELECT id FROM recipes WHERE product_id = ?").get(item.product_id) as { id: number } | undefined;
    if (!recipe) continue;

    const recipeItems = db.prepare(`
      SELECT ri.ingredient_id, ri.quantity FROM recipe_items ri WHERE ri.recipe_id = ?
    `).all(recipe.id) as { ingredient_id: number; quantity: number }[];

    for (const ri of recipeItems) {
      const ing = db.prepare("SELECT id, current_stock FROM ingredients WHERE id = ?").get(ri.ingredient_id) as { id: number; current_stock: number } | undefined;
      if (!ing) continue;

      const deductQty = ri.quantity * item.quantity;
      const newStock = Math.max(0, ing.current_stock - deductQty);
      db.prepare("UPDATE ingredients SET current_stock = ?, updated_at = datetime('now') WHERE id = ?").run(newStock, ing.id);
      insMovement.run(ing.id, "out", deductQty, ing.current_stock, newStock, `Auto: ${item.product_name} x${item.quantity} [${item.transaction_id ?? transactionId}]`, cashierId);
    }
  }
}

// GET /api/transactions
router.get("/transactions", requireAuth, async (req, res): Promise<void> => {
  const { status, date, limit } = req.query as { status?: string; date?: string; limit?: string };

  let sql = "SELECT * FROM transactions WHERE 1=1";
  const params: any[] = [];

  if (status) { sql += " AND status = ?"; params.push(status); }
  if (date) { sql += " AND DATE(created_at) = ?"; params.push(date); }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Number(limit) > 0 ? Number(limit) : 500);

  const rows = db.prepare(sql).all(...params) as any[];
  res.json(rows.map(fmtTransaction));
});

// POST /api/transactions
router.post("/transactions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { orderType, tableId, customerName, notes, discountAmount, items } = parsed.data;

  // Validate items
  if (!items || items.length === 0) { res.status(400).json({ error: "At least one item required" }); return; }

  const productRows: Array<{ id: number; name: string; code: string; selling_price: number }> = [];
  for (const item of items) {
    const p = db.prepare("SELECT id, name, code, selling_price FROM products WHERE id = ? AND status = 'active'").get(item.productId) as any;
    if (!p) { res.status(400).json({ error: `Product ${item.productId} not found or inactive` }); return; }
    productRows.push(p);
  }

  // Validate table for dine_in
  if (orderType === "dine_in" && tableId) {
    const table = db.prepare("SELECT * FROM restaurant_tables WHERE id = ?").get(tableId) as any;
    if (!table) { res.status(400).json({ error: "Table not found" }); return; }
    if (table.status === "occupied") { res.status(400).json({ error: "Table is already occupied" }); return; }
  }

  // Calculate totals
  const settings = getStoreSettings();
  let subtotal = 0;
  const itemsWithPrice = items.map((item, idx) => {
    const p = productRows[idx];
    const itemSubtotal = p.selling_price * item.quantity;
    subtotal += itemSubtotal;
    return { ...item, product: p, subtotal: itemSubtotal };
  });

  const discount = discountAmount ?? 0;
  const taxableAmount = subtotal - discount;
  const taxAmount = Math.round(taxableAmount * settings.tax_percentage / 100);
  const serviceChargeAmount = Math.round(taxableAmount * settings.service_charge_percentage / 100);
  const totalAmount = taxableAmount + taxAmount + serviceChargeAmount;

  const invoiceNumber = generateInvoiceNumber();

  // Insert transaction
  const txResult = db.prepare(`
    INSERT INTO transactions (invoice_number, order_type, status, table_id, customer_name, notes, cashier_id, subtotal, discount_amount, tax_amount, service_charge_amount, total_amount)
    VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(invoiceNumber, orderType, tableId ?? null, customerName ?? null, notes ?? null, req.user!.userId, subtotal, discount, taxAmount, serviceChargeAmount, totalAmount);

  const transactionId = Number(txResult.lastInsertRowid);

  // Insert items
  const insItem = db.prepare("INSERT INTO transaction_items (transaction_id, product_id, product_name, product_code, quantity, unit_price, subtotal, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of itemsWithPrice) {
    insItem.run(transactionId, item.productId, item.product.name, item.product.code, item.quantity, item.product.selling_price, item.subtotal, item.notes ?? null);
  }

  // Mark table occupied
  if (orderType === "dine_in" && tableId) {
    db.prepare("UPDATE restaurant_tables SET status = 'occupied', current_transaction_id = ?, updated_at = datetime('now') WHERE id = ?").run(transactionId, tableId);
  }

  const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(transactionId) as any;
  res.status(201).json(fmtTransactionDetail(tx));
});

// GET /api/transactions/:id
router.get("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(params.data.id) as any;
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(fmtTransactionDetail(tx));
});

// POST /api/transactions/:id/pay
router.post("/transactions/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const params = PayTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = PayTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(params.data.id) as any;
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (tx.status !== "open") { res.status(400).json({ error: `Transaction is already ${tx.status}` }); return; }

  const { paymentMethod, amountPaid, reference } = parsed.data;

  if (amountPaid < tx.total_amount && paymentMethod === "cash") {
    res.status(400).json({ error: `Amount paid (${amountPaid}) is less than total (${tx.total_amount})` }); return;
  }

  const changeAmount = Math.max(0, amountPaid - tx.total_amount);

  // Create payment record
  db.prepare("INSERT INTO payments (transaction_id, payment_method, amount_paid, change_amount, status, reference) VALUES (?, ?, ?, ?, 'paid', ?)")
    .run(tx.id, paymentMethod, amountPaid, changeAmount, reference ?? null);

  // Update transaction status
  db.prepare("UPDATE transactions SET status = 'paid', updated_at = datetime('now') WHERE id = ?").run(tx.id);

  // Free table
  if (tx.table_id) {
    db.prepare("UPDATE restaurant_tables SET status = 'available', current_transaction_id = NULL, updated_at = datetime('now') WHERE id = ?").run(tx.table_id);
  }

  // Deduct stock
  deductStock(tx.id, req.user!.userId);

  const updated = db.prepare("SELECT * FROM transactions WHERE id = ?").get(tx.id) as any;
  res.json(fmtTransactionDetail(updated));
});

// POST /api/transactions/:id/void
router.post("/transactions/:id/void", requireAuth, async (req, res): Promise<void> => {
  const params = VoidTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(params.data.id) as any;
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (tx.status === "void") { res.status(400).json({ error: "Transaction is already voided" }); return; }
  if (tx.status === "paid") { res.status(400).json({ error: "Cannot void a paid transaction" }); return; }

  db.prepare("UPDATE transactions SET status = 'void', updated_at = datetime('now') WHERE id = ?").run(tx.id);

  if (tx.table_id) {
    db.prepare("UPDATE restaurant_tables SET status = 'available', current_transaction_id = NULL, updated_at = datetime('now') WHERE id = ?").run(tx.table_id);
  }

  res.json({ message: "Transaction voided" });
});

export default router;
