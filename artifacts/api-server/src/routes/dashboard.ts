import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (_req, res): Promise<void> => {
  const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
  const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").get() as { count: number }).count;
  const totalRoles = (db.prepare("SELECT COUNT(*) as count FROM roles").get() as { count: number }).count;
  const totalProducts = (db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'active'").get() as { count: number }).count;
  const openTables = (db.prepare("SELECT COUNT(*) as count FROM restaurant_tables WHERE status = 'occupied'").get() as { count: number }).count;

  const usersByRole = db.prepare(`
    SELECT r.name as role_name, COUNT(u.id) as count
    FROM roles r LEFT JOIN users u ON u.role_id = r.id
    GROUP BY r.id, r.name ORDER BY count DESC
  `).all() as Array<{ role_name: string; count: number }>;

  const todayStats = db.prepare(`
    SELECT COUNT(*) as tx_count, COALESCE(SUM(total_amount), 0) as revenue
    FROM transactions
    WHERE status = 'paid' AND DATE(created_at) = DATE('now')
  `).get() as { tx_count: number; revenue: number };

  const bestSelling = db.prepare(`
    SELECT ti.product_id, ti.product_name,
      SUM(ti.quantity) as total_sold,
      SUM(ti.subtotal) as total_revenue
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE t.status = 'paid' AND DATE(t.created_at) = DATE('now')
    GROUP BY ti.product_id, ti.product_name
    ORDER BY total_sold DESC LIMIT 5
  `).all() as Array<{ product_id: number; product_name: string; total_sold: number; total_revenue: number }>;

  res.json({
    totalUsers,
    activeUsers,
    totalRoles,
    usersByRole: usersByRole.map(r => ({ roleName: r.role_name, count: r.count })),
    todaySales: todayStats.revenue,
    todayTransactions: todayStats.tx_count,
    totalProducts,
    openTables,
    bestSellingProducts: bestSelling.map(p => ({
      productId: p.product_id,
      productName: p.product_name,
      totalSold: p.total_sold,
      totalRevenue: p.total_revenue,
    })),
  });
});

export default router;
