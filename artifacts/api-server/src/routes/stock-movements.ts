import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { CreateStockMovementBody } from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(r: any) {
  return {
    id: r.id,
    ingredientId: r.ingredient_id,
    ingredientName: r.ingredient_name,
    unit: r.unit,
    movementType: r.movement_type,
    quantity: r.quantity,
    previousStock: r.previous_stock,
    newStock: r.new_stock,
    notes: r.notes ?? null,
    userId: r.user_id,
    userName: r.user_name,
    createdAt: r.created_at,
  };
}

router.get("/stock-movements", requireAuth, async (_req, res): Promise<void> => {
  const rows = db.prepare(`
    SELECT sm.*, i.name as ingredient_name, i.unit, u.full_name as user_name
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id
    JOIN users u ON u.id = sm.user_id
    ORDER BY sm.created_at DESC
    LIMIT 500
  `).all() as any[];
  res.json(rows.map(fmt));
});

router.post("/stock-movements", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateStockMovementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { ingredientId, movementType, quantity, notes } = parsed.data;

  const ingredient = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(ingredientId) as any;
  if (!ingredient) { res.status(404).json({ error: "Ingredient not found" }); return; }

  const prevStock = ingredient.current_stock;
  let newStock: number;

  if (movementType === "in") {
    newStock = prevStock + quantity;
  } else if (movementType === "out") {
    newStock = prevStock - quantity;
    if (newStock < 0) { res.status(400).json({ error: "Insufficient stock" }); return; }
  } else {
    // adjustment or opname — set to the given quantity
    newStock = quantity;
  }

  db.prepare("UPDATE ingredients SET current_stock = ?, updated_at = datetime('now') WHERE id = ?").run(newStock, ingredientId);

  const result = db.prepare(
    "INSERT INTO stock_movements (ingredient_id, movement_type, quantity, previous_stock, new_stock, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(ingredientId, movementType, quantity, prevStock, newStock, notes ?? null, req.user!.userId);

  const row = db.prepare(`
    SELECT sm.*, i.name as ingredient_name, i.unit, u.full_name as user_name
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id
    JOIN users u ON u.id = sm.user_id
    WHERE sm.id = ?
  `).get(result.lastInsertRowid) as any;

  res.status(201).json(fmt(row));
});

export default router;
