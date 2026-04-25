import { Express } from "express";
import db from "../db";
import { auth, AuthenticatedRequest } from "../middleware/auth";

export function registerNotificationRoutes(app: Express): void {
  app.get("/api/notifications/recent", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const sinceId = Number(req.query.sinceId ?? 0);
    const rows = db
      .prepare(
        `
      SELECT id, level, event_type as eventType, message, created_at as createdAt
      FROM alert_events
      WHERE organization_id = ? AND id > ?
      ORDER BY id DESC
      LIMIT 20
      `
      )
      .all(user.organizationId, Number.isFinite(sinceId) ? sinceId : 0) as Array<{
      id: number;
      level: string;
      eventType: string;
      message: string;
      createdAt: string;
    }>;
    const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id || 0)), 0);
    res.json({ maxId, rows });
  });
}
