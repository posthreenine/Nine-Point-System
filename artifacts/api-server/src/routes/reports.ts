import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function getHppMap(): Map<number, number> {
  const rows = db.prepare(`
    SELECT r.product_id, COALESCE(SUM(ri.quantity * i.purchase_price), 0) as hpp
    FROM recipes r
    JOIN recipe_items ri ON ri.recipe_id = r.id
    JOIN ingredients i ON i.id = ri.ingredient_id
    GROUP BY r.product_id
  `).all() as { product_id: number; hpp: number }[];
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.product_id, r.hpp);
  return map;
}

function calcProfit(startDate: string, endDate: string) {
  const hppMap = getHppMap();
  const items = db.prepare(`
    SELECT ti.product_id, ti.quantity, ti.subtotal
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE date(t.created_at) BETWEEN ? AND ? AND t.status = 'paid'
  `).all(startDate, endDate) as { product_id: number; quantity: number; subtotal: number }[];

  let totalRevenue = 0;
  let totalHpp = 0;
  for (const it of items) {
    const hpp = (hppMap.get(it.product_id) ?? 0) * it.quantity;
    totalRevenue += it.subtotal;
    totalHpp += hpp;
  }
  return { totalRevenue, totalHpp, grossProfit: totalRevenue - totalHpp };
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

router.get("/reports/profit-analysis", requireAuth, (_req, res): void => {
  const products = db.prepare(`
    SELECT p.id, p.name, p.code, p.selling_price, p.status, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.name ASC
  `).all() as any[];

  const result = products.map((p) => {
    const recipe = db.prepare("SELECT id FROM recipes WHERE product_id = ?").get(p.id) as { id: number } | undefined;
    let hpp = 0;
    if (recipe) {
      const recipeItems = db.prepare(`
        SELECT ri.quantity, i.purchase_price
        FROM recipe_items ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
      `).all(recipe.id) as { quantity: number; purchase_price: number }[];
      hpp = recipeItems.reduce((s, it) => s + it.quantity * it.purchase_price, 0);
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

router.get("/reports/daily", requireAuth, (req, res): void => {
  const date = (req.query.date as string) || todayStr();

  const summary = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(AVG(total_amount), 0) as avg_transaction,
      COALESCE(SUM(discount_amount), 0) as total_discount,
      COALESCE(SUM(tax_amount), 0) as total_tax,
      COALESCE(SUM(service_charge_amount), 0) as total_service_charge
    FROM transactions
    WHERE date(created_at) = ? AND status = 'paid'
  `).get(date) as any;

  const byHour = db.prepare(`
    SELECT
      CAST(strftime('%H', created_at) AS INTEGER) as hour,
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM transactions
    WHERE date(created_at) = ? AND status = 'paid'
    GROUP BY strftime('%H', created_at)
    ORDER BY hour
  `).all(date) as any[];

  const byPayment = db.prepare(`
    SELECT
      p.payment_method,
      COUNT(*) as count,
      COALESCE(SUM(t.total_amount), 0) as revenue
    FROM payments p
    JOIN transactions t ON t.id = p.transaction_id
    WHERE date(t.created_at) = ? AND t.status = 'paid'
    GROUP BY p.payment_method
    ORDER BY revenue DESC
  `).all(date) as any[];

  const topProducts = db.prepare(`
    SELECT
      ti.product_name,
      ti.product_code,
      SUM(ti.quantity) as total_qty,
      SUM(ti.subtotal) as total_revenue
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE date(t.created_at) = ? AND t.status = 'paid'
    GROUP BY ti.product_id
    ORDER BY total_qty DESC
    LIMIT 10
  `).all(date) as any[];

  const profit = calcProfit(date, date);

  res.json({
    date,
    summary: {
      transactionCount: summary.transaction_count,
      revenue: summary.revenue,
      avgTransaction: Math.round(summary.avg_transaction),
      totalDiscount: summary.total_discount,
      totalTax: summary.total_tax,
      totalServiceCharge: summary.total_service_charge,
      grossProfit: Math.round(profit.grossProfit),
      totalHpp: Math.round(profit.totalHpp),
    },
    byHour,
    byPayment,
    topProducts,
  });
});

router.get("/reports/weekly", requireAuth, (req, res): void => {
  const today = todayStr();
  const start = (req.query.start as string) || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  })();
  const end = (req.query.end as string) || today;

  const byDay = db.prepare(`
    SELECT
      date(created_at) as day,
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM transactions
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'paid'
    GROUP BY date(created_at)
    ORDER BY day
  `).all(start, end) as any[];

  const summary = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(AVG(total_amount), 0) as avg_transaction
    FROM transactions
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'paid'
  `).get(start, end) as any;

  const byPayment = db.prepare(`
    SELECT
      p.payment_method,
      COUNT(*) as count,
      COALESCE(SUM(t.total_amount), 0) as revenue
    FROM payments p
    JOIN transactions t ON t.id = p.transaction_id
    WHERE date(t.created_at) >= ? AND date(t.created_at) <= ? AND t.status = 'paid'
    GROUP BY p.payment_method
    ORDER BY revenue DESC
  `).all(start, end) as any[];

  const profit = calcProfit(start, end);

  res.json({
    start,
    end,
    summary: {
      transactionCount: summary.transaction_count,
      revenue: summary.revenue,
      avgTransaction: Math.round(summary.avg_transaction),
      grossProfit: Math.round(profit.grossProfit),
      totalHpp: Math.round(profit.totalHpp),
    },
    byDay,
    byPayment,
  });
});

router.get("/reports/monthly", requireAuth, (req, res): void => {
  const today = todayStr();
  const month = (req.query.month as string) || today.slice(0, 7);
  const startOfMonth = `${month}-01`;

  const byDay = db.prepare(`
    SELECT
      date(created_at) as day,
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM transactions
    WHERE strftime('%Y-%m', created_at) = ? AND status = 'paid'
    GROUP BY date(created_at)
    ORDER BY day
  `).all(month) as any[];

  const summary = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(AVG(total_amount), 0) as avg_transaction,
      COALESCE(SUM(discount_amount), 0) as total_discount
    FROM transactions
    WHERE strftime('%Y-%m', created_at) = ? AND status = 'paid'
  `).get(month) as any;

  const byPayment = db.prepare(`
    SELECT
      p.payment_method,
      COUNT(*) as count,
      COALESCE(SUM(t.total_amount), 0) as revenue
    FROM payments p
    JOIN transactions t ON t.id = p.transaction_id
    WHERE strftime('%Y-%m', t.created_at) = ? AND t.status = 'paid'
    GROUP BY p.payment_method
    ORDER BY revenue DESC
  `).all(month) as any[];

  const topProducts = db.prepare(`
    SELECT
      ti.product_name,
      SUM(ti.quantity) as total_qty,
      SUM(ti.subtotal) as total_revenue
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE strftime('%Y-%m', t.created_at) = ? AND t.status = 'paid'
    GROUP BY ti.product_id
    ORDER BY total_revenue DESC
    LIMIT 10
  `).all(month) as any[];

  const endOfMonth = new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0)
    .toISOString()
    .split("T")[0];
  const profit = calcProfit(startOfMonth, endOfMonth);

  res.json({
    month,
    summary: {
      transactionCount: summary.transaction_count,
      revenue: summary.revenue,
      avgTransaction: Math.round(summary.avg_transaction),
      totalDiscount: summary.total_discount,
      grossProfit: Math.round(profit.grossProfit),
      totalHpp: Math.round(profit.totalHpp),
    },
    byDay,
    byPayment,
    topProducts,
  });
});

router.get("/reports/products", requireAuth, (req, res): void => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const start = startDate || todayStr();
  const end = endDate || todayStr();

  const products = db.prepare(`
    SELECT
      ti.product_id,
      ti.product_name,
      ti.product_code,
      SUM(ti.quantity) as total_qty,
      SUM(ti.subtotal) as total_revenue,
      COUNT(DISTINCT ti.transaction_id) as transaction_count
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE date(t.created_at) BETWEEN ? AND ? AND t.status = 'paid'
    GROUP BY ti.product_id, ti.product_name
    ORDER BY total_revenue DESC
  `).all(start, end) as any[];

  const hppMap = getHppMap();

  const result = products.map((p) => {
    const hppPerUnit = hppMap.get(p.product_id) ?? 0;
    const totalHpp = hppPerUnit * p.total_qty;
    const grossProfit = p.total_revenue - totalHpp;
    const margin = p.total_revenue > 0 ? (grossProfit / p.total_revenue) * 100 : 0;
    return {
      productId: p.product_id,
      productName: p.product_name,
      productCode: p.product_code,
      totalQty: p.total_qty,
      totalRevenue: p.total_revenue,
      transactionCount: p.transaction_count,
      hppPerUnit: Math.round(hppPerUnit),
      totalHpp: Math.round(totalHpp),
      grossProfit: Math.round(grossProfit),
      marginPercentage: Math.round(margin * 100) / 100,
    };
  });

  res.json({ startDate: start, endDate: end, products: result });
});

router.get("/reports/profit", requireAuth, (req, res): void => {
  const today = todayStr();
  const startDate = (req.query.startDate as string) || today;
  const endDate = (req.query.endDate as string) || today;

  const summary = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(SUM(tax_amount), 0) as total_tax,
      COALESCE(SUM(service_charge_amount), 0) as total_service_charge,
      COALESCE(SUM(discount_amount), 0) as total_discount
    FROM transactions
    WHERE date(created_at) BETWEEN ? AND ? AND status = 'paid'
  `).get(startDate, endDate) as any;

  const hppMap = getHppMap();
  const items = db.prepare(`
    SELECT ti.product_id, ti.product_name, ti.product_code, ti.quantity, ti.subtotal
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE date(t.created_at) BETWEEN ? AND ? AND t.status = 'paid'
  `).all(startDate, endDate) as any[];

  const byProductMap = new Map<number, { name: string; code: string; qty: number; revenue: number; hpp: number }>();
  let totalHpp = 0;

  for (const it of items) {
    const hpp = (hppMap.get(it.product_id) ?? 0) * it.quantity;
    totalHpp += hpp;
    const ex = byProductMap.get(it.product_id) ?? { name: it.product_name, code: it.product_code, qty: 0, revenue: 0, hpp: 0 };
    byProductMap.set(it.product_id, { ...ex, qty: ex.qty + it.quantity, revenue: ex.revenue + it.subtotal, hpp: ex.hpp + hpp });
  }

  const byProduct = Array.from(byProductMap.entries()).map(([id, v]) => ({
    productId: id,
    productName: v.name,
    productCode: v.code,
    totalQty: v.qty,
    totalRevenue: Math.round(v.revenue),
    totalHpp: Math.round(v.hpp),
    grossProfit: Math.round(v.revenue - v.hpp),
    marginPercentage: v.revenue > 0 ? Math.round(((v.revenue - v.hpp) / v.revenue) * 10000) / 100 : 0,
  })).sort((a, b) => b.grossProfit - a.grossProfit);

  const grossProfit = summary.revenue - totalHpp;
  const netProfit = grossProfit;

  res.json({
    startDate,
    endDate,
    transactionCount: summary.transaction_count,
    revenue: Math.round(summary.revenue),
    totalDiscount: Math.round(summary.total_discount),
    totalTax: Math.round(summary.total_tax),
    totalServiceCharge: Math.round(summary.total_service_charge),
    totalHpp: Math.round(totalHpp),
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    marginPercentage: summary.revenue > 0 ? Math.round((grossProfit / summary.revenue) * 10000) / 100 : 0,
    byProduct,
  });
});

router.get("/reports/analytics", requireAuth, (_req, res): void => {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const lastMonth = prevMonthDate.toISOString().slice(0, 7);

  const todayStats = db.prepare(`
    SELECT COUNT(*) as tc, COALESCE(SUM(total_amount), 0) as rev
    FROM transactions WHERE date(created_at) = ? AND status = 'paid'
  `).get(today) as any;

  const monthStats = db.prepare(`
    SELECT COUNT(*) as tc, COALESCE(SUM(total_amount), 0) as rev
    FROM transactions WHERE strftime('%Y-%m', created_at) = ? AND status = 'paid'
  `).get(thisMonth) as any;

  const lastMonthStats = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as rev
    FROM transactions WHERE strftime('%Y-%m', created_at) = ? AND status = 'paid'
  `).get(lastMonth) as any;

  const trend = db.prepare(`
    SELECT
      date(created_at) as day,
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM transactions
    WHERE date(created_at) >= date('now', '-6 days') AND status = 'paid'
    GROUP BY date(created_at)
    ORDER BY day
  `).all() as any[];

  const topCategories = db.prepare(`
    SELECT
      c.name as category_name,
      SUM(ti.quantity) as total_qty,
      COALESCE(SUM(ti.subtotal), 0) as total_revenue
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN products p ON p.id = ti.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE strftime('%Y-%m', t.created_at) = ? AND t.status = 'paid'
    GROUP BY c.id, c.name
    ORDER BY total_revenue DESC
    LIMIT 6
  `).all(thisMonth) as any[];

  const topProducts = db.prepare(`
    SELECT
      ti.product_name,
      SUM(ti.quantity) as total_qty,
      COALESCE(SUM(ti.subtotal), 0) as total_revenue
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE strftime('%Y-%m', t.created_at) = ? AND t.status = 'paid'
    GROUP BY ti.product_id
    ORDER BY total_qty DESC
    LIMIT 5
  `).all(thisMonth) as any[];

  const paymentToday = db.prepare(`
    SELECT p.payment_method, COUNT(*) as cnt, COALESCE(SUM(t.total_amount), 0) as rev
    FROM payments p
    JOIN transactions t ON t.id = p.transaction_id
    WHERE date(t.created_at) = ? AND t.status = 'paid'
    GROUP BY p.payment_method
  `).all(today) as any[];

  const todayProfit = calcProfit(today, today);
  const startOfMonth = `${thisMonth}-01`;
  const endOfMonth = new Date(parseInt(thisMonth.split("-")[0]), parseInt(thisMonth.split("-")[1]), 0)
    .toISOString().split("T")[0];
  const monthProfit = calcProfit(startOfMonth, endOfMonth);

  res.json({
    today: {
      revenue: Math.round(todayStats.rev),
      transactionCount: todayStats.tc,
      grossProfit: Math.round(todayProfit.grossProfit),
    },
    thisMonth: {
      revenue: Math.round(monthStats.rev),
      transactionCount: monthStats.tc,
      grossProfit: Math.round(monthProfit.grossProfit),
    },
    lastMonth: {
      revenue: Math.round(lastMonthStats.rev),
    },
    trend,
    topCategories,
    topProducts,
    paymentToday,
  });
});

export default router;
