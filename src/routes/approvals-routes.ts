import { Express } from "express";
import db from "../db";
import { auth, hasPermission, AuthenticatedRequest } from "../middleware/auth";

export function registerApprovalsRoutes(app: Express): void {
  app.get("/api/approvals/pending", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;
    const rows: Array<Record<string, unknown>> = [];
    if (hasPermission(user, "purchase:approve")) {
      const po = db
        .prepare(
          `
        SELECT 'purchase' as orderType, id, order_no as orderNo, status, total_amount as totalAmount, submitted_at as submittedAt, created_at as createdAt
        FROM purchase_orders
        WHERE status = 'submitted' AND organization_id = ?
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      rows.push(...po);
    }
    if (hasPermission(user, "sales:approve")) {
      const so = db
        .prepare(
          `
        SELECT 'sales' as orderType, id, order_no as orderNo, status, total_amount as totalAmount, submitted_at as submittedAt, created_at as createdAt
        FROM sales_orders
        WHERE status = 'submitted' AND organization_id = ?
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      rows.push(...so);
    }
    rows.sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    res.json(rows);
  });

  app.get("/api/approvals/overdue", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;
    const hours = Number(req.query.hours ?? 24);
    const sinceExpr = `datetime('now', '-${Math.max(1, Math.floor(hours))} hours')`;
    const rows: Array<Record<string, unknown>> = [];
    if (hasPermission(user, "purchase:approve")) {
      const po = db
        .prepare(
          `
        SELECT 'purchase' as orderType, id, order_no as orderNo, total_amount as totalAmount, submitted_at as submittedAt
        FROM purchase_orders
        WHERE status = 'submitted' AND organization_id = ? AND submitted_at IS NOT NULL AND submitted_at <= ${sinceExpr}
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      rows.push(...po);
    }
    if (hasPermission(user, "sales:approve")) {
      const so = db
        .prepare(
          `
        SELECT 'sales' as orderType, id, order_no as orderNo, total_amount as totalAmount, submitted_at as submittedAt
        FROM sales_orders
        WHERE status = 'submitted' AND organization_id = ? AND submitted_at IS NOT NULL AND submitted_at <= ${sinceExpr}
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      rows.push(...so);
    }
    rows.sort((a, b) => String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")));
    res.json(rows);
  });

  app.get("/api/approvals/sla-dashboard", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;

    const makeStats = (table: "purchase_orders" | "sales_orders") => {
      const result = db
        .prepare(
          `
        SELECT
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as pendingCount,
          SUM(CASE WHEN status = 'submitted' AND submitted_at IS NOT NULL AND submitted_at <= datetime('now', '-24 hours') THEN 1 ELSE 0 END) as overdue24hCount,
          AVG(CASE
            WHEN status = 'approved' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL
            THEN (julianday(approved_at) - julianday(submitted_at)) * 24
            ELSE NULL
          END) as avgApproveHours
        FROM ${table}
        WHERE organization_id = ?
        `
        )
        .get(orgId) as { pendingCount: number; overdue24hCount: number; avgApproveHours: number | null };
      return {
        pendingCount: Number(result.pendingCount || 0),
        overdue24hCount: Number(result.overdue24hCount || 0),
        avgApproveHours: result.avgApproveHours == null ? null : Number(result.avgApproveHours.toFixed(2))
      };
    };

    const data: Record<string, unknown> = {};
    if (hasPermission(user, "purchase:approve")) data.purchase = makeStats("purchase_orders");
    if (hasPermission(user, "sales:approve")) data.sales = makeStats("sales_orders");
    res.json(data);
  });

  app.get("/api/approvals/:orderType/:id/timeline", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orderType = String(req.params.orderType);
    const id = String(req.params.id);
    if (!["purchase", "sales"].includes(orderType)) return next(new Error("Invalid order type"));
    const entityType = orderType === "purchase" ? "purchase_order" : "sales_order";

    if (orderType === "purchase" && !hasPermission(user, "purchase:read") && !hasPermission(user, "purchase:approve")) {
      return next(new Error("Forbidden: missing read permission"));
    }
    if (orderType === "sales" && !hasPermission(user, "sales:read") && !hasPermission(user, "sales:approve")) {
      return next(new Error("Forbidden: missing read permission"));
    }

    const logs = db
      .prepare(
        `
      SELECT id, username, action, detail, created_at as createdAt
      FROM audit_logs
      WHERE organization_id = ? AND entity_type = ? AND entity_id = ?
      ORDER BY id ASC
      `
      )
      .all(user.organizationId, entityType, id);
    res.json(logs);
  });
}
