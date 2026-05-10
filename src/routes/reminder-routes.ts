import { Express } from "express";
import db from "../db";
import { auth, getOrgId, requirePermission } from "../middleware/auth";
import { paginateInMemory } from "../utils/pagination";

export function registerReminderRoutes(app: Express): void {
  // 催收货：已审批采购单且未完全收货
  app.get("/api/reminders/purchase-receipts", auth, requirePermission("purchase:read"), (req, res) => {
    const orgId = getOrgId(req);
    const rows = db
      .prepare(
        `
        SELECT
          po.id as orderId,
          po.order_no as orderNo,
          po.approved_at as approvedAt,
          CAST((julianday('now') - julianday(COALESCE(po.approved_at, po.created_at))) AS INTEGER) as ageDays,
          COALESCE(SUM(poi.qty - poi.received_qty), 0) as remainingQty
        FROM purchase_orders po
        LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
        WHERE po.organization_id = ?
          AND po.status = 'approved'
        GROUP BY po.id
        HAVING remainingQty > 0.0001
        ORDER BY ageDays DESC, po.id DESC
        LIMIT 300
        `
      )
      .all(orgId);
    res.json(paginateInMemory(req, rows as Array<Record<string, unknown>>, { maxPageSize: 300 }));
  });

  // 催发货：已审批销售单且未完全发货
  app.get("/api/reminders/sales-deliveries", auth, requirePermission("sales:read"), (req, res) => {
    const orgId = getOrgId(req);
    const rows = db
      .prepare(
        `
        SELECT
          so.id as orderId,
          so.order_no as orderNo,
          so.approved_at as approvedAt,
          CAST((julianday('now') - julianday(COALESCE(so.approved_at, so.created_at))) AS INTEGER) as ageDays,
          COALESCE(SUM(soi.qty - soi.delivered_qty), 0) as remainingQty
        FROM sales_orders so
        LEFT JOIN sales_order_items soi ON soi.order_id = so.id
        WHERE so.organization_id = ?
          AND so.status = 'approved'
        GROUP BY so.id
        HAVING remainingQty > 0.0001
        ORDER BY ageDays DESC, so.id DESC
        LIMIT 300
        `
      )
      .all(orgId);
    res.json(paginateInMemory(req, rows as Array<Record<string, unknown>>, { maxPageSize: 300 }));
  });
}

