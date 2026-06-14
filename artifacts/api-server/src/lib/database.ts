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

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.resolve(dataDir, "pos.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initDatabase(): void {
  // Migrations for new columns
  try { db.exec("ALTER TABLE products ADD COLUMN production_station TEXT NOT NULL DEFAULT 'none'"); } catch (_) { /* already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS printer_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_type TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      device_name TEXT,
      ip_address TEXT,
      port INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS print_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      invoice_number TEXT NOT NULL,
      print_type TEXT NOT NULL,
      printer_name TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      printed_at TEXT NOT NULL DEFAULT (datetime('now')),
      reprint_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kds_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      invoice_number TEXT NOT NULL,
      station TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      description TEXT,
      selling_price REAL NOT NULL DEFAULT 0,
      image TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      current_stock REAL NOT NULL DEFAULT 0,
      minimum_stock REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      quantity REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      notes TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'available',
      current_transaction_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      order_type TEXT NOT NULL DEFAULT 'dine_in',
      status TEXT NOT NULL DEFAULT 'open',
      table_id INTEGER REFERENCES restaurant_tables(id),
      customer_name TEXT,
      notes TEXT,
      cashier_id INTEGER NOT NULL REFERENCES users(id),
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      service_charge_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      product_code TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      payment_method TEXT NOT NULL,
      amount_paid REAL NOT NULL,
      change_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'paid',
      reference TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS qris_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_name TEXT NOT NULL DEFAULT '',
      qris_image TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cashier_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL REFERENCES users(id),
      opening_cash REAL NOT NULL DEFAULT 0,
      closing_cash REAL,
      expected_cash REAL,
      difference REAL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT
    );
  `);

  seedRoles();
  seedUsers();
  seedStoreSettings();
  seedCategories();
  seedProducts();
  seedIngredients();
  seedRecipes();
  seedTables();
  seedQrisSettings();
  seedPrinterSettings();
}

function seedRoles() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM roles").get() as { c: number }).c;
  if (count > 0) return;
  const ins = db.prepare("INSERT INTO roles (name, description, is_system) VALUES (?, ?, ?)");
  ins.run("Owner", "Full access to all features and settings", 1);
  ins.run("Manager", "Manage staff, view reports, and configure operations", 1);
  ins.run("Cashier", "Process transactions and handle customer orders", 1);
  ins.run("Kitchen", "View and update kitchen orders", 1);
  logger.info("Seeded default roles");
}

function seedUsers() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (count > 0) return;
  const role = db.prepare("SELECT id FROM roles WHERE name = 'Owner'").get() as { id: number } | undefined;
  if (!role) return;
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)").run("admin", hash, "Administrator", role.id);
  logger.info("Seeded default admin user");
}

function seedStoreSettings() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM store_settings").get() as { c: number }).c;
  if (count > 0) return;
  db.prepare(`INSERT INTO store_settings (store_name, address, phone_number, instagram, website, tax_percentage, service_charge_percentage, currency_code, currency_symbol, receipt_footer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "THREE NINE COFFEE & EATERY", "Jl. Placeholder Address", "+62", "@threeninecoffee",
    "https://threeninecoffee.com", 11, 5, "IDR", "Rp", "Thank You For Visiting THREE NINE COFFEE & EATERY"
  );
  logger.info("Seeded default store settings");
}

function seedCategories() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;
  if (count > 0) return;
  const ins = db.prepare("INSERT INTO categories (name) VALUES (?)");
  ["Coffee", "Non Coffee", "Tea", "Pizza", "Food", "Dessert", "Mocktail"].forEach(n => ins.run(n));
  logger.info("Seeded default categories");
}

function seedProducts() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c;
  if (count > 0) return;

  const catId = (name: string) =>
    (db.prepare("SELECT id FROM categories WHERE name = ?").get(name) as { id: number } | undefined)?.id;

  const ins = db.prepare("INSERT INTO products (name, code, category_id, selling_price) VALUES (?, ?, ?, ?)");

  const coffeeId = catId("Coffee");
  const pizzaId = catId("Pizza");
  const foodId = catId("Food");
  const dessertId = catId("Dessert");
  const mocktailId = catId("Mocktail");

  if (coffeeId) {
    ins.run("Espresso", "COFFEE-001", coffeeId, 28000);
    ins.run("Americano", "COFFEE-002", coffeeId, 30000);
    ins.run("Cappuccino", "COFFEE-003", coffeeId, 35000);
    ins.run("Cafe Latte", "COFFEE-004", coffeeId, 38000);
  }
  if (pizzaId) {
    ins.run("All Cheese Pizza", "PIZZA-001", pizzaId, 85000);
    ins.run("Bacon Crushed Egg Pizza", "PIZZA-002", pizzaId, 95000);
    ins.run("Mushroom Delight Pizza", "PIZZA-003", pizzaId, 90000);
    ins.run("Tropical Chicken Pizza", "PIZZA-004", pizzaId, 95000);
    ins.run("Sei Beef Pizza", "PIZZA-005", pizzaId, 100000);
  }
  if (foodId) {
    ins.run("Soto Betawi", "FOOD-001", foodId, 55000);
    ins.run("Soup Iga", "FOOD-002", foodId, 85000);
    ins.run("Soup Iga Bakar", "FOOD-003", foodId, 90000);
  }
  if (dessertId) {
    ins.run("Churros", "DESSERT-001", dessertId, 45000);
  }
  if (mocktailId) {
    ins.run("Mojito", "MOCKTAIL-001", mocktailId, 35000);
  }
  logger.info("Seeded sample products");
}

function seedIngredients() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM ingredients").get() as { c: number }).c;
  if (count > 0) return;
  const ins = db.prepare("INSERT INTO ingredients (name, unit, purchase_price, current_stock, minimum_stock) VALUES (?, ?, ?, ?, ?)");
  ins.run("Coffee Beans", "Gram", 150, 2000, 500);
  ins.run("Milk", "Ml", 15, 5000, 1000);
  ins.run("Mint Leaves", "Gram", 50, 500, 100);
  ins.run("Lime", "Pcs", 2000, 50, 10);
  ins.run("Simple Syrup", "Ml", 10, 1000, 200);
  ins.run("Soda Water", "Ml", 5, 3000, 500);
  ins.run("Sugar", "Gram", 20, 2000, 500);
  ins.run("Pizza Dough", "Gram", 30, 5000, 1000);
  ins.run("Mozzarella Cheese", "Gram", 80, 3000, 500);
  ins.run("Tomato Sauce", "Ml", 25, 2000, 400);
  logger.info("Seeded default ingredients");
}

function seedRecipes() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM recipes").get() as { c: number }).c;
  if (count > 0) return;

  const productId = (code: string) =>
    (db.prepare("SELECT id FROM products WHERE code = ?").get(code) as { id: number } | undefined)?.id;
  const ingId = (name: string) =>
    (db.prepare("SELECT id FROM ingredients WHERE name = ?").get(name) as { id: number } | undefined)?.id;

  const insRecipe = db.prepare("INSERT INTO recipes (product_id) VALUES (?)");
  const insItem = db.prepare("INSERT INTO recipe_items (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)");

  const addRecipe = (productCode: string, items: [string, number][]) => {
    const pid = productId(productCode);
    if (!pid) return;
    const rec = insRecipe.run(pid);
    const rid = rec.lastInsertRowid;
    for (const [name, qty] of items) {
      const iid = ingId(name);
      if (iid) insItem.run(rid, iid, qty);
    }
  };

  addRecipe("COFFEE-001", [["Coffee Beans", 18]]);
  addRecipe("COFFEE-002", [["Coffee Beans", 18], ["Milk", 50]]);
  addRecipe("COFFEE-003", [["Coffee Beans", 18], ["Milk", 120]]);
  addRecipe("COFFEE-004", [["Coffee Beans", 18], ["Milk", 150]]);
  addRecipe("MOCKTAIL-001", [["Mint Leaves", 10], ["Lime", 1], ["Simple Syrup", 20], ["Soda Water", 150]]);
  addRecipe("PIZZA-001", [["Pizza Dough", 200], ["Mozzarella Cheese", 150], ["Tomato Sauce", 80]]);

  logger.info("Seeded sample recipes");
}

function seedTables() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM restaurant_tables").get() as { c: number }).c;
  if (count > 0) return;
  const ins = db.prepare("INSERT INTO restaurant_tables (table_number, name, capacity) VALUES (?, ?, ?)");
  for (let i = 1; i <= 20; i++) {
    ins.run(i, `Table ${i}`, 4);
  }
  logger.info("Seeded 20 restaurant tables");
}

function seedQrisSettings() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM qris_settings").get() as { c: number }).c;
  if (count > 0) return;
  db.prepare("INSERT INTO qris_settings (merchant_name) VALUES (?)").run("THREE NINE COFFEE & EATERY");
  logger.info("Seeded QRIS settings");
}

function seedPrinterSettings() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM printer_settings").get() as { c: number }).c;
  if (count > 0) return;
  const ins = db.prepare("INSERT INTO printer_settings (printer_type, name) VALUES (?, ?)");
  ins.run("customer", "Customer Printer");
  ins.run("bar", "Bar Printer");
  ins.run("kitchen", "Kitchen Printer");
  logger.info("Seeded default printer settings");
}

initDatabase();
