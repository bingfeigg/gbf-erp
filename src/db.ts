import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { hashPassword, isHashedPassword, verifyPassword } from "./security";
import {
  ensureColumn,
  rebuildArInvoicesTable,
  rebuildPartnerTable,
  rebuildProductsTable
} from "./db/schema-evolution";
import { ERP_INITIAL_TABLES_DDL, ERP_INDEX_DDL } from "./db/initial-ddl";
import { ensureDeploymentId } from "./services/deployment-id";

const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? "data");
const dbPath = path.join(dataDir, "erp.db");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(ERP_INITIAL_TABLES_DDL);

  ensureColumn(db,"purchase_orders", "submitted_at", "TEXT");
  ensureColumn(db,"purchase_orders", "approved_at", "TEXT");
  ensureColumn(db,"purchase_orders", "rejected_at", "TEXT");
  ensureColumn(db,"purchase_orders", "voided_at", "TEXT");
  ensureColumn(db,"purchase_orders", "approved_by", "INTEGER");
  ensureColumn(db,"purchase_orders", "reversed_at", "TEXT");
  ensureColumn(db,"purchase_orders", "reversed_by", "INTEGER");
  ensureColumn(db,"sales_orders", "submitted_at", "TEXT");
  ensureColumn(db,"sales_orders", "approved_at", "TEXT");
  ensureColumn(db,"sales_orders", "rejected_at", "TEXT");
  ensureColumn(db,"sales_orders", "voided_at", "TEXT");
  ensureColumn(db,"sales_orders", "approved_by", "INTEGER");
  ensureColumn(db,"sales_orders", "reversed_at", "TEXT");
  ensureColumn(db,"sales_orders", "reversed_by", "INTEGER");

  // Backward-compat: legacy "reject" used to set status back to draft but kept rejected_at.
  // Promote those rows to explicit status='rejected' so UI/status filters are consistent.
  try {
    db.prepare("UPDATE purchase_orders SET status = 'rejected' WHERE status = 'draft' AND rejected_at IS NOT NULL").run();
    db.prepare("UPDATE sales_orders SET status = 'rejected' WHERE status = 'draft' AND rejected_at IS NOT NULL").run();
  } catch (_e) {
    // best-effort, never block boot
  }
  ensureColumn(db,"users", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"customers", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"suppliers", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"products", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"purchase_orders", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"sales_orders", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"journal_entries", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"stock_ledger", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"stock_ledger", "unit_cost", "REAL");
  ensureColumn(db,"stock_ledger", "warehouse_id", "INTEGER");
  ensureColumn(db,"stock_ledger", "location_id", "INTEGER");
  ensureColumn(db,"stock_ledger", "batch_no", "TEXT");
  ensureColumn(db,"ap_bills", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"ar_invoices", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"cash_receipts", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"cash_payments", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"audit_logs", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"alert_events", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"ar_receipt_lines", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"ap_payment_lines", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"webhook_endpoints", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"webhook_deliveries", "organization_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"purchase_order_items", "received_qty", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db,"sales_order_items", "delivered_qty", "REAL NOT NULL DEFAULT 0");

  // Make code/sku unique per organization (SQLite requires table rebuild to remove old UNIQUE(code/sku))
  // Keep ids stable to avoid breaking foreign keys.
  rebuildPartnerTable(db, { table: "customers", codeColumn: "code" });
  rebuildPartnerTable(db, { table: "suppliers", codeColumn: "code" });
  rebuildProductsTable(db);
  rebuildArInvoicesTable(db);

  db.exec(ERP_INDEX_DDL);

  const seedAdmin = db
    .prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)")
    .run("admin", hashPassword("admin"), "admin");
  const seedRoot = db
    .prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)")
    .run("root", hashPassword("root"), "admin");

  if (seedAdmin.changes > 0 || seedRoot.changes > 0) {
    // Default users for first boot (development/local use).
    console.log("Seeded default users: admin/admin, root/root");
  }

  const admin = db.prepare("SELECT id, password FROM users WHERE username = ?").get("admin") as
    | { id: number; password: string }
    | undefined;
  if (admin && !isHashedPassword(admin.password)) {
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword(admin.password), admin.id);
  } else if (admin && verifyPassword("admin123", admin.password)) {
    // Migrate legacy default password to the new default.
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword("admin"), admin.id);
  }

  const root = db.prepare("SELECT id, password FROM users WHERE username = ?").get("root") as
    | { id: number; password: string }
    | undefined;
  if (root && !isHashedPassword(root.password)) {
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword(root.password), root.id);
  }

  // Seed minimal chart of accounts (MVP).
  db.prepare("INSERT OR IGNORE INTO organizations (id, code, name) VALUES (1, 'ORG001', 'Default Organization')").run();
  const seedAccount = db.prepare("INSERT OR IGNORE INTO accounts (code, name, type) VALUES (?, ?, ?)");
  seedAccount.run("1001", "Cash", "asset");
  seedAccount.run("1122", "Accounts Receivable", "asset");
  seedAccount.run("1405", "Inventory", "asset");
  seedAccount.run("2202", "Accounts Payable", "liability");
  seedAccount.run("6001", "Revenue", "income");
  seedAccount.run("6401", "Cost Of Goods Sold", "expense");

  const seedApprovalRule = db.prepare(
    "INSERT OR IGNORE INTO approval_rules (organization_id, order_type, min_amount, approver_role) VALUES (?, ?, ?, ?)"
  );
  seedApprovalRule.run(1, "purchase", 0, "purchase");
  seedApprovalRule.run(1, "purchase", 5000, "finance");
  seedApprovalRule.run(1, "purchase", 20000, "admin");
  seedApprovalRule.run(1, "sales", 0, "sales");
  seedApprovalRule.run(1, "sales", 5000, "finance");
  seedApprovalRule.run(1, "sales", 20000, "admin");

  const seedAlertRule = db.prepare(
    "INSERT OR IGNORE INTO alert_rules (organization_id, rule_key, rule_value) VALUES (?, ?, ?)"
  );
  seedAlertRule.run(1, "approval_overdue_hours", "24");
  seedAlertRule.run(1, "approval_scan_interval_ms", "300000");
  db.prepare(
    `
    INSERT OR IGNORE INTO ar_invoice_no_rules (organization_id, source, prefix, date_segment, sequence_digits)
    VALUES (1, 'order_no', 'AR-', 'none', 4)
    `
  ).run();

  db.prepare("INSERT OR IGNORE INTO warehouses (organization_id, code, name) VALUES (1, 'MAIN', 'Main Warehouse')").run();
  const wh = db
    .prepare("SELECT id FROM warehouses WHERE organization_id = 1 AND code = 'MAIN'")
    .get() as { id: number } | undefined;
  if (wh) {
    db.prepare(
      "INSERT OR IGNORE INTO locations (organization_id, warehouse_id, code, name) VALUES (1, ?, 'A01', 'Default Location')"
    ).run(wh.id);
  }

  ensureDeploymentId();
}

export default db;
