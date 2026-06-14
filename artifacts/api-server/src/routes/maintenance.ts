import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function requireOwner(req: Request, res: Response): boolean {
  if (req.user?.roleName !== "Owner") {
    res.status(403).json({ error: "Forbidden — Owner role required" });
    return false;
  }
  return true;
}

/**
 * Reset open (test) transactions — deletes only unpaid/open transactions and their items.
 * Frees occupied tables. Does NOT affect paid transactions.
 */
router.post("/maintenance/reset-test-transactions", requireAuth, async (req, res): Promise<void> => {
  if (!requireOwner(req, res)) return;
  const openIds = (db.prepare("SELECT id FROM transactions WHERE status = 'open'").all() as { id: number }[]).map(r => r.id);
  if (openIds.length === 0) {
    res.json({ deleted: 0, message: "No open transactions found" }); return;
  }
  const placeholders = openIds.map(() => "?").join(",");
  db.prepare(`DELETE FROM transaction_items WHERE transaction_id IN (${placeholders})`).run(...openIds);
  db.prepare(`DELETE FROM kds_orders WHERE transaction_id IN (${placeholders})`).run(...openIds);
  db.prepare(`DELETE FROM print_logs WHERE transaction_id IN (${placeholders})`).run(...openIds);
  db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...openIds);
  db.prepare(
    "UPDATE restaurant_tables SET status = 'available', current_transaction_id = NULL, current_invoice_number = NULL WHERE status = 'occupied'"
  ).run();
  res.json({ deleted: openIds.length, message: `Deleted ${openIds.length} open transaction(s)` });
});

/**
 * Reset all sales history — deletes ALL transactions (open and paid), items, payments.
 * Frees all tables. Resets invoice counter effectively.
 */
router.post("/maintenance/reset-sales-history", requireAuth, async (req, res): Promise<void> => {
  if (!requireOwner(req, res)) return;
  const { count } = db.prepare("SELECT COUNT(*) as count FROM transactions").get() as { count: number };
  db.prepare("DELETE FROM print_logs").run();
  db.prepare("DELETE FROM kds_orders").run();
  db.prepare("DELETE FROM transaction_items").run();
  db.prepare("DELETE FROM payments").run();
  db.prepare("DELETE FROM transactions").run();
  db.prepare(
    "UPDATE restaurant_tables SET status = 'available', current_transaction_id = NULL, current_invoice_number = NULL"
  ).run();
  res.json({ deleted: count, message: `Deleted all ${count} transaction(s) and associated records` });
});

/**
 * Reset payment history only — removes payment records and reverts paid transactions back to open.
 * Transactions remain; paid status is reversed.
 */
router.post("/maintenance/reset-payment-history", requireAuth, async (req, res): Promise<void> => {
  if (!requireOwner(req, res)) return;
  const { count } = db.prepare("SELECT COUNT(*) as count FROM payments").get() as { count: number };
  db.prepare("DELETE FROM payments").run();
  db.prepare("UPDATE transactions SET status = 'open', updated_at = datetime('now') WHERE status = 'paid'").run();
  res.json({ deleted: count, message: `Deleted ${count} payment record(s); paid transactions reverted to open` });
});

/**
 * Reset print logs — clears all print history.
 */
router.post("/maintenance/reset-print-logs", requireAuth, async (req, res): Promise<void> => {
  if (!requireOwner(req, res)) return;
  const { count } = db.prepare("SELECT COUNT(*) as count FROM print_logs").get() as { count: number };
  db.prepare("DELETE FROM print_logs").run();
  res.json({ deleted: count, message: `Deleted ${count} print log(s)` });
});

/**
 * Reset KDS orders — clears all kitchen display system queue entries.
 */
router.post("/maintenance/reset-kds-orders", requireAuth, async (req, res): Promise<void> => {
  if (!requireOwner(req, res)) return;
  const { count } = db.prepare("SELECT COUNT(*) as count FROM kds_orders").get() as { count: number };
  db.prepare("DELETE FROM kds_orders").run();
  res.json({ deleted: count, message: `Deleted ${count} KDS order(s)` });
});

/**
 * Reset dashboard analytics — same as full sales history reset; dashboard will recalculate to zero.
 */
router.post("/maintenance/reset-dashboard-analytics", requireAuth, async (req, res): Promise<void> => {
  if (!requireOwner(req, res)) return;
  const { count } = db.prepare("SELECT COUNT(*) as count FROM transactions").get() as { count: number };
  db.prepare("DELETE FROM print_logs").run();
  db.prepare("DELETE FROM kds_orders").run();
  db.prepare("DELETE FROM transaction_items").run();
  db.prepare("DELETE FROM payments").run();
  db.prepare("DELETE FROM transactions").run();
  db.prepare(
    "UPDATE restaurant_tables SET status = 'available', current_transaction_id = NULL, current_invoice_number = NULL"
  ).run();
  res.json({ deleted: count, message: `Dashboard analytics reset — deleted all ${count} transaction(s)` });
});

/**
 * GET /maintenance/stats — show current record counts so user knows what will be deleted
 */
router.get("/maintenance/stats", requireAuth, async (req, res): Promise<void> => {
  if (!requireOwner(req, res)) return;
  const get = (sql: string) => (db.prepare(sql).get() as { count: number }).count;
  res.json({
    openTransactions: get("SELECT COUNT(*) as count FROM transactions WHERE status = 'open'"),
    paidTransactions: get("SELECT COUNT(*) as count FROM transactions WHERE status = 'paid'"),
    voidTransactions: get("SELECT COUNT(*) as count FROM transactions WHERE status = 'void'"),
    payments: get("SELECT COUNT(*) as count FROM payments"),
    printLogs: get("SELECT COUNT(*) as count FROM print_logs"),
    kdsOrders: get("SELECT COUNT(*) as count FROM kds_orders"),
  });
});

export default router;
