import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db, uploadsDir } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/require-role";
import { UpdateStoreSettingsBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WEBP images are allowed"));
    }
  },
});

function getSettings() {
  const row = db.prepare("SELECT * FROM store_settings LIMIT 1").get() as {
    id: number; store_name: string; logo: string | null; address: string | null;
    phone_number: string | null; email: string | null; instagram: string | null;
    facebook: string | null; website: string | null; tax_percentage: number;
    service_charge_percentage: number; currency_code: string; currency_symbol: string;
    receipt_footer: string | null; created_at: string; updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    storeName: row.store_name,
    logoUrl: row.logo ? `/api/store-settings/logo-file/${row.logo}` : null,
    address: row.address ?? null,
    phoneNumber: row.phone_number ?? null,
    email: row.email ?? null,
    instagram: row.instagram ?? null,
    facebook: row.facebook ?? null,
    website: row.website ?? null,
    taxPercentage: row.tax_percentage,
    serviceChargePercentage: row.service_charge_percentage,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    receiptFooter: row.receipt_footer ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/store-settings", async (_req, res): Promise<void> => {
  const settings = getSettings();
  if (!settings) {
    res.status(404).json({ error: "Settings not found" });
    return;
  }
  res.json(settings);
});

router.put("/store-settings", requireAuth, requireRole("Owner"), async (req, res): Promise<void> => {
  const parsed = UpdateStoreSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;

  db.prepare(`
    UPDATE store_settings SET
      store_name = COALESCE(?, store_name),
      address = COALESCE(?, address),
      phone_number = COALESCE(?, phone_number),
      email = COALESCE(?, email),
      instagram = COALESCE(?, instagram),
      facebook = COALESCE(?, facebook),
      website = COALESCE(?, website),
      tax_percentage = COALESCE(?, tax_percentage),
      service_charge_percentage = COALESCE(?, service_charge_percentage),
      currency_code = COALESCE(?, currency_code),
      currency_symbol = COALESCE(?, currency_symbol),
      receipt_footer = COALESCE(?, receipt_footer),
      updated_at = datetime('now')
    WHERE id = 1
  `).run(
    d.storeName ?? null,
    d.address !== undefined ? d.address : null,
    d.phoneNumber !== undefined ? d.phoneNumber : null,
    d.email !== undefined ? d.email : null,
    d.instagram !== undefined ? d.instagram : null,
    d.facebook !== undefined ? d.facebook : null,
    d.website !== undefined ? d.website : null,
    d.taxPercentage ?? null,
    d.serviceChargePercentage ?? null,
    d.currencyCode ?? null,
    d.currencySymbol ?? null,
    d.receiptFooter !== undefined ? d.receiptFooter : null,
  );

  const settings = getSettings();
  res.json(settings);
});

router.post(
  "/store-settings/logo",
  requireAuth,
  requireRole("Owner"),
  upload.single("logo"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const existing = db.prepare("SELECT logo FROM store_settings LIMIT 1").get() as { logo: string | null } | undefined;
    if (existing?.logo) {
      const oldPath = path.join(uploadsDir, existing.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filename = req.file.filename;
    db.prepare("UPDATE store_settings SET logo = ?, updated_at = datetime('now') WHERE id = 1")
      .run(filename);

    logger.info({ filename }, "Logo uploaded");

    const settings = getSettings();
    res.json(settings);
  }
);

router.delete("/store-settings/logo", requireAuth, requireRole("Owner"), async (_req, res): Promise<void> => {
  const row = db.prepare("SELECT logo FROM store_settings LIMIT 1").get() as { logo: string | null } | undefined;
  if (row?.logo) {
    const logoPath = path.join(uploadsDir, row.logo);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
    db.prepare("UPDATE store_settings SET logo = NULL, updated_at = datetime('now') WHERE id = 1").run();
  }
  res.json({ message: "Logo removed" });
});

router.get("/store-settings/logo-file/:filename", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const safeName = path.basename(raw);
  const filePath = path.join(uploadsDir, safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.sendFile(filePath);
});

export default router;
