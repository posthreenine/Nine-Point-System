import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { CreateCategoryBody, UpdateCategoryBody, UpdateCategoryParams, GetCategoryParams, DeleteCategoryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(r: { id: number; name: string; description: string | null; status: string; product_count: number; created_at: string; updated_at: string }) {
  return { id: r.id, name: r.name, description: r.description ?? null, status: r.status, productCount: r.product_count, createdAt: r.created_at, updatedAt: r.updated_at };
}

router.get("/categories", requireAuth, async (_req, res): Promise<void> => {
  const rows = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY c.name ASC
  `).all() as any[];
  res.json(rows.map(fmt));
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, description, status } = parsed.data;
  if (db.prepare("SELECT id FROM categories WHERE name = ?").get(name)) {
    res.status(400).json({ error: "Category name already exists" }); return;
  }
  const result = db.prepare("INSERT INTO categories (name, description, status) VALUES (?, ?, ?)").run(name, description ?? null, status ?? "active");
  const row = db.prepare(`SELECT c.*, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON p.category_id = c.id WHERE c.id = ? GROUP BY c.id`).get(result.lastInsertRowid) as any;
  res.status(201).json(fmt(row));
});

router.get("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = db.prepare(`SELECT c.*, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON p.category_id = c.id WHERE c.id = ? GROUP BY c.id`).get(params.data.id) as any;
  if (!row) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(fmt(row));
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(params.data.id)) {
    res.status(404).json({ error: "Category not found" }); return;
  }
  const { name, description, status } = parsed.data;
  if (name) {
    const conflict = db.prepare("SELECT id FROM categories WHERE name = ? AND id != ?").get(name, params.data.id);
    if (conflict) { res.status(400).json({ error: "Category name already taken" }); return; }
  }
  db.prepare("UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?")
    .run(name ?? null, description !== undefined ? description : null, status ?? null, params.data.id);
  const row = db.prepare(`SELECT c.*, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON p.category_id = c.id WHERE c.id = ? GROUP BY c.id`).get(params.data.id) as any;
  res.json(fmt(row));
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(params.data.id)) {
    res.status(404).json({ error: "Category not found" }); return;
  }
  const productCount = (db.prepare("SELECT COUNT(*) as c FROM products WHERE category_id = ?").get(params.data.id) as { c: number }).c;
  if (productCount > 0) { res.status(400).json({ error: "Cannot delete category with products" }); return; }
  db.prepare("DELETE FROM categories WHERE id = ?").run(params.data.id);
  res.json({ message: "Category deleted" });
});

export default router;
