import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");

import fs from "fs";
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
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
  `);

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
}

initDatabase();
