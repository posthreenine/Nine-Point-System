import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/reports/profit-analysis", requireAuth, async (_req, res): Promise<void> => {
  const products = db.prepare(`
    SELECT p.id, p.name, p.code, p.selling_price, p.status, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.name ASC
  `).all() as any[];

  const result = products.map(p => {
    const recipe = db.prepare("SELECT id FROM recipes WHERE product_id = ?").get(p.id) as { id: number } | undefined;
    let hpp = 0;
    if (recipe) {
      const items = db.prepare(`
        SELECT ri.quantity, i.purchase_price
        FROM recipe_items ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
      `).all(recipe.id) as { quantity: number; purchase_price: number }[];
      hpp = items.reduce((s, it) => s + it.quantity * it.purchase_price, 0);
    }
    const profit = p.selling_price - hpp;
    const marginPercentage = p.selling_price > 0 ? (profit / p.selling_price) * 100 : 0;
    return {
      productId: p.id,
      productName: p.name,
      productCode: p.code,
      categoryName: p.category_name ?? null,
      sellingPrice: p.selling_price,
      hpp,
      profit,
      marginPercentage: Math.round(marginPercentage * 100) / 100,
      status: p.status,
    };
  });

  res.json(result);
});

export default router;
