import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { UpdateRestaurantTableBody, UpdateRestaurantTableParams } from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(r: any) {
  const invoiceNum = r.current_transaction_id
    ? (db.prepare("SELECT invoice_number FROM transactions WHERE id = ?").get(r.current_transaction_id) as any)?.invoice_number ?? null
    : null;
  return {
    id: r.id,
    tableNumber: r.table_number,
    name: r.name,
    capacity: r.capacity,
    status: r.status,
    currentTransactionId: r.current_transaction_id ?? null,
    currentInvoiceNumber: invoiceNum,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.get("/tables", requireAuth, async (_req, res): Promise<void> => {
  const rows = db.prepare("SELECT * FROM restaurant_tables ORDER BY table_number ASC").all() as any[];
  res.json(rows.map(fmt));
});

router.patch("/tables/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateRestaurantTableParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateRestaurantTableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = db.prepare("SELECT * FROM restaurant_tables WHERE id = ?").get(params.data.id) as any;
  if (!existing) { res.status(404).json({ error: "Table not found" }); return; }
  const { name, capacity, status } = parsed.data;
  db.prepare("UPDATE restaurant_tables SET name = COALESCE(?, name), capacity = COALESCE(?, capacity), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?")
    .run(name ?? null, capacity ?? null, status ?? null, params.data.id);
  const row = db.prepare("SELECT * FROM restaurant_tables WHERE id = ?").get(params.data.id) as any;
  res.json(fmt(row));
});

export default router;
