import { Express } from "express";
import db from "../db";
import { auth, requirePermission, getOrgId } from "../middleware/auth";
import { configApprovalRuleSchema, configAlertRuleSchema, configWebhookEndpointSchema } from "../schemas/api";

export function registerConfigRoutes(app: Express): void {
  app.get("/api/config/approval-rules", auth, requirePermission("*"), (req, res) => {
    const orgId = getOrgId(req);
    const rows = db
      .prepare(
        `
      SELECT id, order_type as orderType, min_amount as minAmount, approver_role as approverRole
      FROM approval_rules
      WHERE organization_id = ?
      ORDER BY order_type, min_amount ASC
      `
      )
      .all(orgId);
    res.json(rows);
  });

  app.post("/api/config/approval-rules", auth, requirePermission("*"), (req, res, next) => {
    const parsed = configApprovalRuleSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orgId = getOrgId(req);
    const { orderType, minAmount, approverRole } = parsed.data;
    db.prepare(
      `
    INSERT INTO approval_rules (organization_id, order_type, min_amount, approver_role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(organization_id, order_type, min_amount)
    DO UPDATE SET approver_role = excluded.approver_role
    `
    ).run(orgId, orderType, minAmount, approverRole);
    res.json({ ok: true });
  });

  app.get("/api/config/alert-rules", auth, requirePermission("*"), (req, res) => {
    const orgId = getOrgId(req);
    const rows = db
      .prepare("SELECT id, rule_key as ruleKey, rule_value as ruleValue FROM alert_rules WHERE organization_id = ? ORDER BY rule_key")
      .all(orgId);
    res.json(rows);
  });

  app.post("/api/config/alert-rules", auth, requirePermission("*"), (req, res, next) => {
    const parsed = configAlertRuleSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orgId = getOrgId(req);
    const { ruleKey, ruleValue } = parsed.data;
    db.prepare(
      `
    INSERT INTO alert_rules (organization_id, rule_key, rule_value)
    VALUES (?, ?, ?)
    ON CONFLICT(organization_id, rule_key)
    DO UPDATE SET rule_value = excluded.rule_value
    `
    ).run(orgId, ruleKey, ruleValue);
    res.json({ ok: true });
  });

  app.get("/api/config/webhooks", auth, requirePermission("*"), (req, res) => {
    const orgId = getOrgId(req);
    const rows = db
      .prepare(
        `
      SELECT id, url, event_type as eventType, enabled, created_at as createdAt
      FROM webhook_endpoints
      WHERE organization_id = ?
      ORDER BY id DESC
      `
      )
      .all(orgId);
    res.json(rows);
  });

  app.post("/api/config/webhooks", auth, requirePermission("*"), (req, res, next) => {
    const parsed = configWebhookEndpointSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orgId = getOrgId(req);
    const { id, url, eventType, secret, enabled } = parsed.data;
    if (id) {
      db.prepare(
        `
      UPDATE webhook_endpoints
      SET url = ?, event_type = ?, secret = COALESCE(?, secret), enabled = ?
      WHERE id = ? AND organization_id = ?
      `
      ).run(url, eventType, secret ?? null, enabled ? 1 : 0, id, orgId);
      return res.json({ ok: true, id });
    }
    const info = db
      .prepare("INSERT INTO webhook_endpoints (organization_id, url, event_type, secret, enabled) VALUES (?, ?, ?, ?, ?)")
      .run(orgId, url, eventType, secret ?? null, enabled ? 1 : 0);
    res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
  });

  app.delete("/api/config/webhooks/:id", auth, requirePermission("*"), (req, res, next) => {
    const orgId = getOrgId(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new Error("Invalid webhook id"));
    db.prepare("DELETE FROM webhook_endpoints WHERE id = ? AND organization_id = ?").run(id, orgId);
    res.json({ ok: true });
  });
}
