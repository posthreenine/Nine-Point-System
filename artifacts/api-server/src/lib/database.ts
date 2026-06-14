import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");
export const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, "pos.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT NOT NULL DEFAULT 'THREE NINE COFFEE & EATERY',
      logo TEXT,
      address TEXT,
      phone_number TEXT,
      email TEXT,
      instagram TEXT,
      facebook TEXT,
      website TEXT,
      tax_percentage REAL NOT NULL DEFAULT 11,
      service_charge_percentage REAL NOT NULL DEFAULT 5,
      currency_code TEXT NOT NULL DEFAULT 'IDR',
      currency_symbol TEXT NOT NULL DEFAULT 'Rp',
      receipt_footer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed roles
  const roleCount = (db.prepare("SELECT COUNT(*) as count FROM roles").get() as { count: number }).count;
  if (roleCount === 0) {
    const insertRole = db.prepare(
      "INSERT INTO roles (name, description, is_system) VALUES (?, ?, ?)"
    );
    insertRole.run("Owner", "Full access to all features and settings", 1);
    insertRole.run("Manager", "Manage staff, view reports, and configure operations", 1);
    insertRole.run("Cashier", "Process transactions and handle customer orders", 1);
    insertRole.run("Kitchen", "View and update kitchen orders", 1);
    logger.info("Seeded default roles");
  }

  // Seed admin user
  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
  if (userCount === 0) {
    const ownerRole = db.prepare("SELECT id FROM roles WHERE name = 'Owner'").get() as { id: number } | undefined;
    if (ownerRole) {
      const hash = bcrypt.hashSync("admin123", 10);
      db.prepare(
        "INSERT INTO users (username, password_hash, full_name, role_id, is_active) VALUES (?, ?, ?, ?, ?)"
      ).run("admin", hash, "Administrator", ownerRole.id, 1);
      logger.info("Seeded default admin user");
    }
  }

  // Seed store settings
  const settingsCount = (db.prepare("SELECT COUNT(*) as count FROM store_settings").get() as { count: number }).count;
  if (settingsCount === 0) {
    db.prepare(`
      INSERT INTO store_settings (
        store_name, address, phone_number, instagram, website,
        tax_percentage, service_charge_percentage, currency_code, currency_symbol, receipt_footer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "THREE NINE COFFEE & EATERY",
      "Jl. Placeholder Address",
      "+62",
      "@threeninecoffee",
      "https://threeninecoffee.com",
      11,
      5,
      "IDR",
      "Rp",
      "Thank You For Visiting THREE NINE COFFEE & EATERY"
    );
    logger.info("Seeded default store settings");
  }
}

initDatabase();
