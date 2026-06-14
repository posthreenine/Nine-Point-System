import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (_req, res): Promise<void> => {
  const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
  const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").get() as { count: number }).count;
  const totalRoles = (db.prepare("SELECT COUNT(*) as count FROM roles").get() as { count: number }).count;

  const usersByRole = db.prepare(`
    SELECT r.name as role_name, COUNT(u.id) as count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.id
    GROUP BY r.id, r.name
    ORDER BY count DESC
  `).all() as Array<{ role_name: string; count: number }>;

  res.json({
    totalUsers,
    activeUsers,
    totalRoles,
    usersByRole: usersByRole.map(r => ({ roleName: r.role_name, count: r.count })),
  });
});

export default router;
