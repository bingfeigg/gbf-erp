import { Express } from "express";
import db from "../db";
import { auth, requirePermission, getOrgId } from "../middleware/auth";

export function registerFinanceReportRoutes(app: Express): void {
  app.get("/api/finance/reports/trial-balance", auth, requirePermission("purchase:read"), (_req, res) => {
    const rows = db
      .prepare(
        `
      SELECT a.code, a.name, a.type,
        COALESCE(SUM(l.debit), 0) as debit,
        COALESCE(SUM(l.credit), 0) as credit,
        COALESCE(SUM(l.debit - l.credit), 0) as balance
      FROM accounts a
      LEFT JOIN journal_lines l ON l.account_code = a.code
      GROUP BY a.code, a.name, a.type
      ORDER BY a.code
      `
      )
      .all();
    res.json(rows);
  });

  app.get("/api/finance/reports/ar-aging", auth, requirePermission("sales:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT i.id, i.invoice_no as invoiceNo, c.name as customerName,
        (i.total_amount - i.received_amount) as openAmount,
        CAST((julianday('now') - julianday(i.created_at)) AS INTEGER) as ageDays,
        i.created_at as createdAt
      FROM ar_invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.organization_id = ? AND (i.total_amount - i.received_amount) > 0
      ORDER BY ageDays DESC
      `
      )
      .all(orgId);
    res.json(rows);
  });

  app.get("/api/finance/reports/ap-aging", auth, requirePermission("purchase:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT b.id, b.bill_no as billNo, s.name as supplierName,
        (b.total_amount - b.paid_amount) as openAmount,
        CAST((julianday('now') - julianday(b.created_at)) AS INTEGER) as ageDays,
        b.created_at as createdAt
      FROM ap_bills b
      JOIN suppliers s ON s.id = b.supplier_id
      WHERE b.organization_id = ? AND (b.total_amount - b.paid_amount) > 0
      ORDER BY ageDays DESC
      `
      )
      .all(orgId);
    res.json(rows);
  });

  app.get("/api/finance/reports/inventory-valuation", auth, requirePermission("stock:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.unit,
        p.cost_price as costPrice,
        COALESCE(SUM(l.qty_change), 0) as stockQty,
        COALESCE(SUM(l.qty_change), 0) * p.cost_price as stockValue
      FROM products p
      LEFT JOIN stock_ledger l ON l.product_id = p.id AND l.organization_id = p.organization_id
      WHERE p.organization_id = ?
      GROUP BY p.id
      ORDER BY p.id DESC
      `
      )
      .all(orgId);
    const summary = (rows as Array<{ stockQty: number; stockValue: number }>).reduce(
      (acc: { totalQty: number; totalValue: number }, row) => {
        const qty = Number((row as { stockQty: number }).stockQty || 0);
        const value = Number((row as { stockValue: number }).stockValue || 0);
        acc.totalQty += qty;
        acc.totalValue += value;
        return acc;
      },
      { totalQty: 0, totalValue: 0 }
    );
    res.json({ summary, rows });
  });

  app.get("/api/finance/reports/kpi-summary", auth, requirePermission("stock:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const ar = db
      .prepare(
        "SELECT COALESCE(SUM(total_amount - received_amount), 0) as amount FROM ar_invoices WHERE organization_id = ? AND total_amount > received_amount"
      )
      .get(orgId) as { amount: number };
    const ap = db
      .prepare(
        "SELECT COALESCE(SUM(total_amount - paid_amount), 0) as amount FROM ap_bills WHERE organization_id = ? AND total_amount > paid_amount"
      )
      .get(orgId) as { amount: number };
    const inventory = db
      .prepare(
        `
      SELECT COALESCE(SUM(q.qty * p.cost_price), 0) as value
      FROM (
        SELECT product_id, SUM(qty_change) as qty
        FROM stock_ledger
        WHERE organization_id = ?
        GROUP BY product_id
      ) q
      JOIN products p ON p.id = q.product_id
      WHERE p.organization_id = ?
      `
      )
      .get(orgId, orgId) as { value: number };
    /** 与 GET /api/products 各商品 stockQty 之和一致（总件数，非金额） */
    const inventoryQtyRow = db
      .prepare(
        `
      SELECT COALESCE(SUM(t.qty), 0) as qty
      FROM (
        SELECT COALESCE(SUM(s.qty_change), 0) as qty
        FROM products p
        LEFT JOIN stock_ledger s ON s.product_id = p.id AND s.organization_id = p.organization_id
        WHERE p.organization_id = ?
        GROUP BY p.id
      ) t
      `
      )
      .get(orgId) as { qty: number };
    const journals = db
      .prepare("SELECT COUNT(*) as count FROM journal_entries WHERE organization_id = ?")
      .get(orgId) as { count: number };
    res.json({
      openAr: Number(ar.amount || 0),
      openAp: Number(ap.amount || 0),
      inventoryValue: Number(inventory.value || 0),
      inventoryQty: Number(inventoryQtyRow.qty || 0),
      journalCount: journals.count
    });
  });

  app.get("/api/finance/reports/trend", auth, requirePermission("stock:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const days = Math.min(30, Math.max(7, Number(_req.query.days ?? 14)));
    const rows = db
      .prepare(
        `
      WITH RECURSIVE d(day, n) AS (
        SELECT date('now', '-' || (? - 1) || ' days'), 1
        UNION ALL
        SELECT date(day, '+1 day'), n + 1 FROM d WHERE n < ?
      )
      SELECT
        d.day as day,
        COALESCE((SELECT SUM(total_amount) FROM purchase_orders p WHERE p.organization_id = ? AND date(p.created_at) = d.day), 0) as purchaseAmount,
        COALESCE((SELECT SUM(total_amount) FROM sales_orders s WHERE s.organization_id = ? AND date(s.created_at) = d.day), 0) as salesAmount,
        COALESCE((SELECT SUM(amount) FROM cash_receipts r WHERE r.organization_id = ? AND date(r.created_at) = d.day), 0) as receiptAmount,
        COALESCE((SELECT SUM(amount) FROM cash_payments p WHERE p.organization_id = ? AND date(p.created_at) = d.day), 0) as paymentAmount
      FROM d
      ORDER BY d.day ASC
      `
      )
      .all(days, days, orgId, orgId, orgId, orgId);
    res.json(rows);
  });

  app.get("/api/finance/reports/approval-efficiency", auth, requirePermission("purchase:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT order_type as orderType,
             SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
             SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
             AVG(CASE
                   WHEN status = 'approved' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL
                   THEN (julianday(approved_at) - julianday(submitted_at)) * 24
                   ELSE NULL
                 END) as avgApproveHours
      FROM (
        SELECT 'purchase' as order_type, status, submitted_at, approved_at FROM purchase_orders WHERE organization_id = ?
        UNION ALL
        SELECT 'sales' as order_type, status, submitted_at, approved_at FROM sales_orders WHERE organization_id = ?
      ) t
      GROUP BY order_type
      `
      )
      .all(orgId, orgId) as Array<{
      orderType: string;
      approvedCount: number;
      rejectedCount: number;
      avgApproveHours: number | null;
    }>;
    res.json(rows.map((r) => ({ ...r, avgApproveHours: r.avgApproveHours == null ? null : Number(r.avgApproveHours.toFixed(2)) })));
  });
}
