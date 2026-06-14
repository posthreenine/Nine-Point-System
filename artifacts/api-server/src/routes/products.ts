import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db, uploadsDir } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { CreateProductBody, UpdateProductBody, UpdateProductParams, GetProductParams, DeleteProductParams, DeleteProductImageParams } from "@workspace/api-zod";

const router: IRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP allowed"));
  },
});

function computeHpp(productId: number): number {
  const recipe = db.prepare("SELECT id FROM recipes WHERE product_id = ?").get(productId) as { id: number } | undefined;
  if (!recipe) return 0;
  const items = db.prepare(`
    SELECT ri.quantity, i.purchase_price FROM recipe_items ri
    JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.recipe_id = ?
  `).all(recipe.id) as { quantity: number; purchase_price: number }[];
  return items.reduce((s, it) => s + it.quantity * it.purchase_price, 0);
}

function fmt(r: any) {
  return {
    id: r.id, name: r.name, code: r.code,
    categoryId: r.category_id, categoryName: r.category_name ?? null,
    description: r.description ?? null, sellingPrice: r.selling_price,
    imageUrl: r.image ? `/api/products/image-file/${r.image}` : null,
    status: r.status, hpp: computeHpp(r.id),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

router.get("/products", requireAuth, async (_req, res): Promise<void> => {
  const rows = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.name ASC
  `).all() as any[];
  res.json(rows.map(fmt));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, code, categoryId, description, sellingPrice, status } = parsed.data;
  if (db.prepare("SELECT id FROM products WHERE code = ?").get(code)) {
    res.status(400).json({ error: "Product code already exists" }); return;
  }
  if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId)) {
    res.status(400).json({ error: "Category not found" }); return;
  }
  const result = db.prepare("INSERT INTO products (name, code, category_id, description, selling_price, status) VALUES (?, ?, ?, ?, ?, ?)").run(name, code, categoryId, description ?? null, sellingPrice, status ?? "active");
  const row = db.prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(fmt(row));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = db.prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?").get(params.data.id) as any;
  if (!row) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(fmt(row));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!db.prepare("SELECT id FROM products WHERE id = ?").get(params.data.id)) {
    res.status(404).json({ error: "Product not found" }); return;
  }
  const { name, code, categoryId, description, sellingPrice, status } = parsed.data;
  if (code) {
    const conflict = db.prepare("SELECT id FROM products WHERE code = ? AND id != ?").get(code, params.data.id);
    if (conflict) { res.status(400).json({ error: "Product code already taken" }); return; }
  }
  db.prepare(`UPDATE products SET name = COALESCE(?, name), code = COALESCE(?, code), category_id = COALESCE(?, category_id), description = COALESCE(?, description), selling_price = COALESCE(?, selling_price), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?`)
    .run(name ?? null, code ?? null, categoryId ?? null, description !== undefined ? description : null, sellingPrice ?? null, status ?? null, params.data.id);
  const row = db.prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?").get(params.data.id) as any;
  res.json(fmt(row));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(params.data.id) as any;
  if (!row) { res.status(404).json({ error: "Product not found" }); return; }
  if (row.image) {
    const imgPath = path.join(uploadsDir, row.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  db.prepare("DELETE FROM products WHERE id = ?").run(params.data.id);
  res.json({ message: "Product deleted" });
});

router.post("/products/:id/image", requireAuth, upload.single("image"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!existing) { res.status(404).json({ error: "Product not found" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  if (existing.image) {
    const old = path.join(uploadsDir, existing.image);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  db.prepare("UPDATE products SET image = ?, updated_at = datetime('now') WHERE id = ?").run(req.file.filename, id);
  const row = db.prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?").get(id) as any;
  res.json(fmt(row));
});

router.delete("/products/:id/image", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductImageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(params.data.id) as any;
  if (!row) { res.status(404).json({ error: "Product not found" }); return; }
  if (row.image) {
    const imgPath = path.join(uploadsDir, row.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    db.prepare("UPDATE products SET image = NULL, updated_at = datetime('now') WHERE id = ?").run(params.data.id);
  }
  res.json({ message: "Image removed" });
});

router.get("/products/image-file/:filename", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const safeName = path.basename(raw);
  const filePath = path.join(uploadsDir, safeName);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
  res.sendFile(filePath);
});

export default router;
