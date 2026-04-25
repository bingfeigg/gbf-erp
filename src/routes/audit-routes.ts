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
}
