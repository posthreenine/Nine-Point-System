import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { UpsertRecipeBody, GetRecipeParams, UpsertRecipeParams } from "@workspace/api-zod";

const router: IRouter = Router();

function buildRecipe(productId: number) {
  const product = db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId) as { id: number; name: string } | undefined;
  if (!product) return null;

  const recipe = db.prepare("SELECT id FROM recipes WHERE product_id = ?").get(productId) as { id: number } | undefined;
  if (!recipe) {
    return { productId: product.id, productName: product.name, items: [], totalHpp: 0 };
  }

  const items = db.prepare(`
    SELECT ri.ingredient_id, i.name as ingredient_name, i.unit, ri.quantity, i.purchase_price
    FROM recipe_items ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = ?
  `).all(recipe.id) as any[];

  const fmtItems = items.map(it => ({
    ingredientId: it.ingredient_id,
    ingredientName: it.ingredient_name,
    unit: it.unit,
    quantity: it.quantity,
    cost: it.purchase_price * it.quantity,
  }));

  const totalHpp = fmtItems.reduce((s, it) => s + it.cost, 0);

  return { productId: product.id, productName: product.name, items: fmtItems, totalHpp };
}

router.get("/recipes", requireAuth, async (_req, res): Promise<void> => {
  const products = db.prepare("SELECT id FROM products ORDER BY name ASC").all() as { id: number }[];
  const recipes = products.map(p => buildRecipe(p.id)).filter(Boolean);
  res.json(recipes);
});

router.get("/recipes/:productId", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const recipe = buildRecipe(params.data.productId);
  if (!recipe) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(recipe);
});

router.put("/recipes/:productId", requireAuth, async (req, res): Promise<void> => {
  const params = UpsertRecipeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpsertRecipeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(params.data.productId);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  // validate all ingredients exist
  for (const item of parsed.data.items) {
    if (!db.prepare("SELECT id FROM ingredients WHERE id = ?").get(item.ingredientId)) {
      res.status(400).json({ error: `Ingredient ${item.ingredientId} not found` }); return;
    }
  }

  // upsert recipe
  let recipe = db.prepare("SELECT id FROM recipes WHERE product_id = ?").get(params.data.productId) as { id: number } | undefined;
  if (!recipe) {
    const r = db.prepare("INSERT INTO recipes (product_id) VALUES (?)").run(params.data.productId);
    recipe = { id: Number(r.lastInsertRowid) };
  } else {
    db.prepare("UPDATE recipes SET updated_at = datetime('now') WHERE id = ?").run(recipe.id);
  }

  // replace items
  db.prepare("DELETE FROM recipe_items WHERE recipe_id = ?").run(recipe.id);
  const insItem = db.prepare("INSERT INTO recipe_items (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)");
  for (const item of parsed.data.items) {
    insItem.run(recipe.id, item.ingredientId, item.quantity);
  }

  res.json(buildRecipe(params.data.productId));
});

export default router;
