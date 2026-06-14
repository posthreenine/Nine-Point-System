import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db, uploadsDir } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { UpdateQrisSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `qris-${Date.now()}${ext}`);
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

function fmt(r: any) {
  return {
    id: r.id,
    merchantName: r.merchant_name,
    qrisImageUrl: r.qris_image ? `/api/qris-settings/image-file/${r.qris_image}` : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function getOrCreate() {
  let row = db.prepare("SELECT * FROM qris_settings LIMIT 1").get() as any;
  if (!row) {
    db.prepare("INSERT INTO qris_settings (merchant_name) VALUES ('')").run();
    row = db.prepare("SELECT * FROM qris_settings LIMIT 1").get() as any;
  }
  return row;
}

router.get("/qris-settings", requireAuth, async (_req, res): Promise<void> => {
  res.json(fmt(getOrCreate()));
});

router.put("/qris-settings", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateQrisSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const row = getOrCreate();
  db.prepare("UPDATE qris_settings SET merchant_name = COALESCE(?, merchant_name), updated_at = datetime('now') WHERE id = ?")
    .run(parsed.data.merchantName ?? null, row.id);
  res.json(fmt(db.prepare("SELECT * FROM qris_settings WHERE id = ?").get(row.id) as any));
});

router.post("/qris-settings/image", requireAuth, upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const row = getOrCreate();
  if (row.qris_image) {
    const old = path.join(uploadsDir, row.qris_image);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  db.prepare("UPDATE qris_settings SET qris_image = ?, updated_at = datetime('now') WHERE id = ?").run(req.file.filename, row.id);
  res.json(fmt(db.prepare("SELECT * FROM qris_settings WHERE id = ?").get(row.id) as any));
});

router.delete("/qris-settings/image", requireAuth, async (_req, res): Promise<void> => {
  const row = getOrCreate();
  if (row.qris_image) {
    const imgPath = path.join(uploadsDir, row.qris_image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    db.prepare("UPDATE qris_settings SET qris_image = NULL, updated_at = datetime('now') WHERE id = ?").run(row.id);
  }
  res.json({ message: "QRIS image removed" });
});

router.get("/qris-settings/image-file/:filename", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const safeName = path.basename(raw);
  const filePath = path.join(uploadsDir, safeName);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
  res.sendFile(filePath);
});

export default router;
