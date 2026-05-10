import Database from "better-sqlite3";

/** better-sqlite3 数据库实例类型 */
export type SqliteDb = InstanceType<typeof Database>;

export function ensureColumn(db: SqliteDb, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function hasUniqueIndexOn(db: SqliteDb, table: string, columns: string[]): boolean {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string; unique: number }>;
  for (const idx of indexes) {
    if (!idx.unique) continue;
    const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    if (names.length === columns.length && names.every((n, i) => n === columns[i])) return true;
  }
  return false;
}

export function rebuildPartnerTable(
  db: SqliteDb,
  args: {
    table: "customers" | "suppliers";
    codeColumn: "code";
  }
) {
  const { table } = args;
  if (hasUniqueIndexOn(db, table, ["organization_id", "code"])) return;

  db.exec("BEGIN");
  try {
    db.exec(`ALTER TABLE ${table} RENAME TO ${table}_old;`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        contact TEXT,
        phone TEXT,
        UNIQUE (organization_id, code)
      );
    `);
    db.exec(`
      INSERT INTO ${table} (id, organization_id, code, name, contact, phone)
      SELECT id, COALESCE(organization_id, 1), code, name, contact, phone
      FROM ${table}_old;
    `);
    db.exec(`DROP TABLE ${table}_old;`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function rebuildProductsTable(db: SqliteDb) {
  if (hasUniqueIndexOn(db, "products", ["organization_id", "sku"])) return;

  db.exec("BEGIN");
  try {
    db.exec(`ALTER TABLE products RENAME TO products_old;`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        cost_price REAL NOT NULL DEFAULT 0,
        sale_price REAL NOT NULL DEFAULT 0,
        UNIQUE (organization_id, sku)
      );
    `);
    db.exec(`
      INSERT INTO products (id, organization_id, sku, name, unit, cost_price, sale_price)
      SELECT id, COALESCE(organization_id, 1), sku, name, unit, cost_price, sale_price
      FROM products_old;
    `);
    db.exec(`DROP TABLE products_old;`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function rebuildArInvoicesTable(db: SqliteDb) {
  if (hasUniqueIndexOn(db, "ar_invoices", ["organization_id", "invoice_no"])) return;

  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ar_invoices_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL DEFAULT 1,
        invoice_no TEXT NOT NULL,
        customer_id INTEGER NOT NULL,
        ref_type TEXT NOT NULL,
        ref_id INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        received_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customer_id) REFERENCES customers(id),
        UNIQUE (organization_id, invoice_no)
      );
    `);
    db.exec(`
      INSERT INTO ar_invoices_new (id, organization_id, invoice_no, customer_id, ref_type, ref_id, total_amount, received_amount, status, created_at)
      SELECT id, COALESCE(organization_id, 1), invoice_no, customer_id, ref_type, ref_id, total_amount, received_amount, status, created_at
      FROM ar_invoices;
    `);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec("DROP TABLE ar_invoices;");
    db.exec("ALTER TABLE ar_invoices_new RENAME TO ar_invoices;");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    try {
      db.exec("DROP TABLE IF EXISTS ar_invoices_new;");
    } catch (_ignore) {
      // no-op
    }
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}
