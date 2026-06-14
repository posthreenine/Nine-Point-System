import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function fmt(r: any) {
  return {
    id: r.id,
    printerType: r.printer_type,
    name: r.name,
    deviceName: r.device_name ?? null,
    ipAddress: r.ip_address ?? null,
    port: r.port ?? null,
    isActive: r.is_active === 1,
    updatedAt: r.updated_at,
  };
}

router.get("/printer-settings", requireAuth, async (_req, res): Promise<void> => {
  const rows = db.prepare("SELECT * FROM printer_settings ORDER BY id ASC").all() as any[];
  res.json(rows.map(fmt));
});

router.put("/printer-settings/:type", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
  const type = raw as string;
  if (!["customer", "bar", "kitchen"].includes(type)) {
    res.status(400).json({ error: "Invalid printer type. Must be customer, bar, or kitchen" }); return;
  }
  const { name, deviceName, ipAddress, port, isActive } = req.body;
  db.prepare(`
    UPDATE printer_settings SET
      name = COALESCE(?, name),
      device_name = ?,
      ip_address = ?,
      port = ?,
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE printer_type = ?
  `).run(
    name ?? null,
    deviceName !== undefined ? deviceName : undefined,
    ipAddress !== undefined ? ipAddress : undefined,
    port !== undefined ? port : undefined,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    type,
  );
  const row = db.prepare("SELECT * FROM printer_settings WHERE printer_type = ?").get(type) as any;
  res.json(fmt(row));
});

export default router;
