import { Express } from "express";
import db from "../db";
import { auth, requirePermission, getOrgId } from "../middleware/auth";

export function registerAuditRoutes(app: Express): void {
  app.get("/api/audit-logs", auth, requirePermission("*"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT id, user_id as userId, username, action, entity_type as entityType, entity_id as entityId, detail, created_at as createdAt
      FROM audit_logs
      WHERE organization_id = ?
      ORDER BY id DESC
      LIMIT 500
      `
      )
      .all(orgId);
    res.json(rows);
  });

  app.get("/api/alerts/events", auth, requirePermission("*"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT id, level, event_type as eventType, entity_type as entityType, entity_id as entityId, message, created_at as createdAt
      FROM alert_events
      WHERE organization_id = ?
      ORDER BY id DESC
      LIMIT 500
      `
      )
      .all(orgId);
    res.json(rows);
  });

  /** 数据一致性检查（管理员）：帮助排查历史数据与新规则冲突 */
  app.get("/api/ops/data-checks", auth, requirePermission("*"), (_req, res) => {
    const orgId = getOrgId(_req);

    const purchasePaidButNotReceived = db
      .prepare(
        `
        SELECT
          po.id as orderId,
          po.order_no as orderNo,
          COALESCE(SUM(poi.qty - poi.received_qty), 0) as remainingQty,
          b.id as billId,
          b.bill_no as billNo,
          b.total_amount as billTotal,
          b.paid_amount as billPaid,
          (b.total_amount - b.paid_amount) as billOpen
        FROM ap_bills b
        JOIN purchase_orders po ON po.id = b.ref_id AND po.organization_id = b.organization_id
        LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
        WHERE b.organization_id = ?
          AND b.ref_type = 'purchase_order'
          AND b.paid_amount > 0
        GROUP BY po.id, b.id
        HAVING remainingQty > 0.0001
        ORDER BY po.id DESC
        LIMIT 200
        `
      )
      .all(orgId);

    const salesReceivedButNotShipped = db
      .prepare(
        `
        SELECT
          so.id as orderId,
          so.order_no as orderNo,
          COALESCE(SUM(soi.qty - soi.delivered_qty), 0) as remainingQty,
          i.id as invoiceId,
          i.invoice_no as invoiceNo,
          i.total_amount as invoiceTotal,
          i.received_amount as invoiceReceived,
          (i.total_amount - i.received_amount) as invoiceOpen
        FROM ar_invoices i
        JOIN sales_orders so ON so.id = i.ref_id AND so.organization_id = i.organization_id
        LEFT JOIN sales_order_items soi ON soi.order_id = so.id
        WHERE i.organization_id = ?
          AND i.ref_type = 'sales_order'
          AND i.received_amount > 0
        GROUP BY so.id, i.id
        HAVING remainingQty > 0.0001
        ORDER BY so.id DESC
        LIMIT 200
        `
      )
      .all(orgId);

    res.json({
      purchasePaidButNotReceived,
      salesReceivedButNotShipped
    });
  });
}
