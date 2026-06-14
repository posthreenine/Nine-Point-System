import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function calculateExpectedCash(openingCash: number, startedAt: string, closedAt?: string | null): number {
  const timeFilter = closedAt
    ? `AND t.created_at >= ? AND t.created_at <= ?`
    : `AND t.created_at >= ?`;

  const params = closedAt ? [startedAt, closedAt] : [startedAt];

  const result = db.prepare(`
    SELECT COALESCE(SUM(p.amount_paid - p.change_amount), 0) as cash_in
    FROM payments p
    JOIN transactions t ON t.id = p.transaction_id
    WHERE p.payment_method = 'cash'
      AND t.status = 'paid'
      ${timeFilter}
  `).get(...params) as { cash_in: number };

  return openingCash + (result?.cash_in ?? 0);
}

router.get("/shifts", requireAuth, (req, res): void => {
  const user = req.user!;
  const isManager = user.roleName === "Owner" || user.roleName === "Manager";
  const statusFilter = req.query.status as string | undefined;

  let query = `
    SELECT s.*, u.full_name as cashier_name, u.username as cashier_username
    FROM cashier_shifts s
    JOIN users u ON u.id = s.cashier_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (!isManager) {
    query += " AND s.cashier_id = ?";
    params.push(user.userId);
  }
  if (statusFilter && statusFilter !== "all") {
    query += " AND s.status = ?";
    params.push(statusFilter);
  }

  query += " ORDER BY s.started_at DESC LIMIT 100";

  const shifts = db.prepare(query).all(...params) as any[];

  res.json(
    shifts.map((s) => ({
      id: s.id,
      cashierId: s.cashier_id,
      cashierName: s.cashier_name,
      cashierUsername: s.cashier_username,
      openingCash: s.opening_cash,
      closingCash: s.closing_cash ?? null,
      expectedCash: s.expected_cash ?? null,
      difference: s.difference ?? null,
      notes: s.notes ?? null,
      status: s.status,
      startedAt: s.started_at,
      closedAt: s.closed_at ?? null,
    }))
  );
});

router.get("/shifts/current", requireAuth, (req, res): void => {
  const user = req.user!;

  const shift = db.prepare(`
    SELECT s.*, u.full_name as cashier_name
    FROM cashier_shifts s
    JOIN users u ON u.id = s.cashier_id
    WHERE s.cashier_id = ? AND s.status = 'open'
    ORDER BY s.started_at DESC
    LIMIT 1
  `).get(user.userId) as any | undefined;

  if (!shift) {
    res.json(null);
    return;
  }

  const expectedCash = calculateExpectedCash(shift.opening_cash, shift.started_at);

  const stats = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(t.total_amount), 0) as revenue
    FROM transactions t
    WHERE t.cashier_id = ? AND t.status = 'paid' AND t.created_at >= ?
  `).get(user.userId, shift.started_at) as any;

  res.json({
    id: shift.id,
    cashierId: shift.cashier_id,
    cashierName: shift.cashier_name,
    openingCash: shift.opening_cash,
    expectedCash,
    notes: shift.notes ?? null,
    status: shift.status,
    startedAt: shift.started_at,
    stats: {
      transactionCount: stats.transaction_count,
      revenue: stats.revenue,
    },
  });
});

router.post("/shifts/open", requireAuth, (req, res): void => {
  const user = req.user!;
  const { openingCash = 0, notes } = req.body;

  const existing = db
    .prepare("SELECT id FROM cashier_shifts WHERE cashier_id = ? AND status = 'open'")
    .get(user.userId);

  if (existing) {
    res.status(400).json({ error: "You already have an open shift" });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO cashier_shifts (cashier_id, opening_cash, notes, status) VALUES (?, ?, ?, 'open')`
    )
    .run(user.userId, parseFloat(openingCash) || 0, notes || null);

  const shift = db.prepare(`
    SELECT s.*, u.full_name as cashier_name
    FROM cashier_shifts s JOIN users u ON u.id = s.cashier_id
    WHERE s.id = ?
  `).get(result.lastInsertRowid) as any;

  res.status(201).json({
    id: shift.id,
    cashierId: shift.cashier_id,
    cashierName: shift.cashier_name,
    openingCash: shift.opening_cash,
    status: shift.status,
    startedAt: shift.started_at,
  });
});

router.post("/shifts/:id/close", requireAuth, (req, res): void => {
  const user = req.user!;
  const shiftId = parseInt(req.params.id);
  const { closingCash = 0, notes } = req.body;

  const shift = db
    .prepare("SELECT * FROM cashier_shifts WHERE id = ? AND status = 'open'")
    .get(shiftId) as any | undefined;

  if (!shift) {
    res.status(404).json({ error: "Shift not found or already closed" });
    return;
  }

  const isManager = user.roleName === "Owner" || user.roleName === "Manager";
  if (!isManager && shift.cashier_id !== user.userId) {
    res.status(403).json({ error: "Not authorized to close this shift" });
    return;
  }

  const expectedCash = calculateExpectedCash(shift.opening_cash, shift.started_at);
  const actualClosing = parseFloat(closingCash) || 0;
  const difference = actualClosing - expectedCash;

  db.prepare(`
    UPDATE cashier_shifts
    SET closing_cash = ?, expected_cash = ?, difference = ?, notes = ?,
        status = 'closed', closed_at = datetime('now')
    WHERE id = ?
  `).run(actualClosing, expectedCash, difference, notes || shift.notes || null, shiftId);

  const updated = db.prepare(`
    SELECT s.*, u.full_name as cashier_name
    FROM cashier_shifts s JOIN users u ON u.id = s.cashier_id
    WHERE s.id = ?
  `).get(shiftId) as any;

  res.json({
    id: updated.id,
    cashierName: updated.cashier_name,
    openingCash: updated.opening_cash,
    closingCash: updated.closing_cash,
    expectedCash: updated.expected_cash,
    difference: updated.difference,
    status: updated.status,
    startedAt: updated.started_at,
    closedAt: updated.closed_at,
  });
});

export default router;
