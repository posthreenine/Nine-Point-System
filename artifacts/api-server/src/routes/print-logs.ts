import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/print-logs", requireAuth, async (req, res): Promise<void> => {
  const { transactionId, invoiceNumber, printType, printerName } = req.body;
  if (!transactionId || !invoiceNumber || !printType) {
    res.status(400).json({ error: "transactionId, invoiceNumber, and printType are required" }); return;
  }

  const validTypes = ["receipt", "bar_ticket", "kitchen_ticket", "waiter_copy"];
  if (!validTypes.includes(printType)) {
    res.status(400).json({ error: `printType must be one of: ${validTypes.join(", ")}` }); return;
  }

  const tx = db.prepare("SELECT id FROM transactions WHERE id = ?").get(transactionId) as any;
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

  const existing = (db.prepare(
    "SELECT COUNT(*) as c FROM print_logs WHERE transaction_id = ? AND print_type = ?"
  ).get(transactionId, printType) as { c: number }).c;

  const result = db.prepare(`
    INSERT INTO print_logs (transaction_id, invoice_number, print_type, printer_name, user_id, reprint_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(transactionId, invoiceNumber, printType, printerName ?? null, req.user!.userId, existing);

  const log = db.prepare("SELECT * FROM print_logs WHERE id = ?").get(result.lastInsertRowid) as any;

  // KDS integration: when bar or kitchen ticket is printed, create/update kds_orders
  if (printType === "bar_ticket" || printType === "kitchen_ticket") {
    const station = printType === "bar_ticket" ? "bar" : "kitchen";
    const existing = db.prepare(
      "SELECT id FROM kds_orders WHERE transaction_id = ? AND station = ?"
    ).get(transactionId, station) as any;
    if (existing) {
      db.prepare("UPDATE kds_orders SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(existing.id);
    } else {
      db.prepare("INSERT INTO kds_orders (transaction_id, invoice_number, station) VALUES (?, ?, ?)")
        .run(transactionId, invoiceNumber, station);
    }
  }

  res.status(201).json({
    id: log.id,
    transactionId: log.transaction_id,
    invoiceNumber: log.invoice_number,
    printType: log.print_type,
    printerName: log.printer_name ?? null,
    userId: log.user_id,
    printedAt: log.printed_at,
    reprintCount: log.reprint_count,
    isReprint: log.reprint_count > 0,
  });
});

router.get("/print-logs", requireAuth, async (req, res): Promise<void> => {
  const { transactionId } = req.query as { transactionId?: string };
  if (!transactionId) {
    res.status(400).json({ error: "transactionId query param is required" }); return;
  }
  const types = ["receipt", "bar_ticket", "kitchen_ticket", "waiter_copy"];
  const summary: Record<string, { count: number; lastPrintedAt: string | null; reprintCount: number }> = {};
  for (const type of types) {
    const rows = db.prepare(
      "SELECT printed_at FROM print_logs WHERE transaction_id = ? AND print_type = ? ORDER BY printed_at DESC"
    ).all(Number(transactionId), type) as { printed_at: string }[];
    summary[type] = {
      count: rows.length,
      lastPrintedAt: rows[0]?.printed_at ?? null,
      reprintCount: Math.max(0, rows.length - 1),
    };
  }
  res.json(summary);
});

export default router;
