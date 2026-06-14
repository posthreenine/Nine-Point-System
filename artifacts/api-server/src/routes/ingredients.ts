import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { CreateIngredientBody, UpdateIngredientBody, UpdateIngredientParams, GetIngredientParams, DeleteIngredientParams } from "@workspace/api-zod";

const router: IRouter = Router();

function stockStatus(current: number, minimum: number): string {
  if (current <= 0) return "out_of_stock";
  if (current <= minimum) return "low_stock";
  return "in_stock";
}

function fmt(r: { id: number; name: string; unit: string; purchase_price: number; current_stock: number; minimum_stock: number; created_at: string; updated_at: string }) {
  return {
    id: r.id, name: r.name, unit: r.unit,
    purchasePrice: r.purchase_price, currentStock: r.current_stock, minimumStock: r.minimum_stock,
    stockStatus: stockStatus(r.current_stock, r.minimum_stock),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

router.get("/ingredients", requireAuth, async (_req, res): Promise<void> => {
  const rows = db.prepare("SELECT * FROM ingredients ORDER BY name ASC").all() as any[];
  res.json(rows.map(fmt));
});

router.post("/ingredients", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateIngredientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, unit, purchasePrice, currentStock, minimumStock } = parsed.data;
  if (db.prepare("SELECT id FROM ingredients WHERE name = ?").get(name)) {
    res.status(400).json({ error: "Ingredient already exists" }); return;
  }
  const result = db.prepare("INSERT INTO ingredients (name, unit, purchase_price, current_stock, minimum_stock) VALUES (?, ?, ?, ?, ?)").run(name, unit, purchasePrice, currentStock ?? 0, minimumStock ?? 0);
  const row = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(fmt(row));
});

router.get("/ingredients/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetIngredientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(params.data.id) as any;
  if (!row) { res.status(404).json({ error: "Ingredient not found" }); return; }
  res.json(fmt(row));
});

router.patch("/ingredients/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateIngredientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateIngredientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!db.prepare("SELECT id FROM ingredients WHERE id = ?").get(params.data.id)) {
    res.status(404).json({ error: "Ingredient not found" }); return;
  }
  const { name, unit, purchasePrice, currentStock, minimumStock } = parsed.data;
  if (name) {
    const conflict = db.prepare("SELECT id FROM ingredients WHERE name = ? AND id != ?").get(name, params.data.id);
    if (conflict) { res.status(400).json({ error: "Ingredient name already taken" }); return; }
  }
  db.prepare(`UPDATE ingredients SET name = COALESCE(?, name), unit = COALESCE(?, unit), purchase_price = COALESCE(?, purchase_price), current_stock = COALESCE(?, current_stock), minimum_stock = COALESCE(?, minimum_stock), updated_at = datetime('now') WHERE id = ?`)
    .run(name ?? null, unit ?? null, purchasePrice ?? null, currentStock ?? null, minimumStock ?? null, params.data.id);
  const row = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(params.data.id) as any;
  res.json(fmt(row));
});

router.delete("/ingredients/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteIngredientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!db.prepare("SELECT id FROM ingredients WHERE id = ?").get(params.data.id)) {
    res.status(404).json({ error: "Ingredient not found" }); return;
  }
  const used = (db.prepare("SELECT COUNT(*) as c FROM recipe_items WHERE ingredient_id = ?").get(params.data.id) as { c: number }).c;
  if (used > 0) { res.status(400).json({ error: "Cannot delete ingredient used in recipes" }); return; }
  db.prepare("DELETE FROM ingredients WHERE id = ?").run(params.data.id);
  res.json({ message: "Ingredient deleted" });
});

export default router;
