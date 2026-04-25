import { createHmac } from "crypto";
import db from "../db";
import { APPROVAL_OVERDUE_HOURS } from "../constants";

export function getAlertRuleNumber(organizationId: number, ruleKey: string, fallback: number): number {
  const row = db
    .prepare("SELECT rule_value as ruleValue FROM alert_rules WHERE organization_id = ? AND rule_key = ?")
    .get(organizationId, ruleKey) as { ruleValue: string } | undefined;
  const num = Number(row?.ruleValue ?? fallback);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

export function enqueueWebhookEvent(organizationId: number, eventType: string, payload: unknown) {
  const endpoints = db
    .prepare(
      `
      SELECT id
      FROM webhook_endpoints
      WHERE organization_id = ? AND enabled = 1 AND (event_type = '*' OR event_type = ?)
      `
    )
    .all(organizationId, eventType) as Array<{ id: number }>;
  const now = Date.now();
  const insert = db.prepare(
    `
    INSERT INTO webhook_deliveries
      (organization_id, endpoint_id, event_type, payload, status, attempt_count, next_attempt_at)
    VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `
  );
  for (const ep of endpoints) {
    insert.run(organizationId, ep.id, eventType, JSON.stringify(payload), now);
  }
}

export function writeAlertEvent(args: {
  organizationId?: number;
  level: "info" | "warning" | "critical";
  eventType: string;
  entityType: string;
  entityId?: string | number;
  message: string;
}) {
  db.prepare(
    "INSERT INTO alert_events (organization_id, level, event_type, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(args.organizationId ?? 1, args.level, args.eventType, args.entityType, args.entityId != null ? String(args.entityId) : null, args.message);
  enqueueWebhookEvent(args.organizationId ?? 1, args.eventType, {
    level: args.level,
    eventType: args.eventType,
    entityType: args.entityType,
    entityId: args.entityId ?? null,
    message: args.message,
    at: new Date().toISOString()
  });
}

export function scanOverdueApprovals() {
  const orgs = db.prepare("SELECT id FROM organizations").all() as Array<{ id: number }>;
  for (const org of orgs) {
    const thresholdHours = Math.max(1, Math.floor(getAlertRuleNumber(org.id, "approval_overdue_hours", APPROVAL_OVERDUE_HOURS)));
    const thresholdExpr = `datetime('now', '-${thresholdHours} hours')`;
    const rows = db
      .prepare(
        `
        SELECT orderType, id, orderNo, submittedAt
        FROM (
          SELECT 'purchase' as orderType, id, order_no as orderNo, submitted_at as submittedAt
          FROM purchase_orders
          WHERE organization_id = ? AND status = 'submitted' AND submitted_at IS NOT NULL AND submitted_at <= ${thresholdExpr}
          UNION ALL
          SELECT 'sales' as orderType, id, order_no as orderNo, submitted_at as submittedAt
          FROM sales_orders
          WHERE organization_id = ? AND status = 'submitted' AND submitted_at IS NOT NULL AND submitted_at <= ${thresholdExpr}
        )
        `
      )
      .all(org.id, org.id) as Array<{ orderType: string; id: number; orderNo: string; submittedAt: string }>;
    for (const row of rows) {
      const exists = db
        .prepare(
          `
          SELECT id
          FROM alert_events
          WHERE event_type = 'approval.overdue'
            AND organization_id = ?
            AND entity_type = ?
            AND entity_id = ?
            AND created_at >= datetime('now', '-24 hours')
          LIMIT 1
          `
        )
        .get(org.id, row.orderType, String(row.id)) as { id: number } | undefined;
      if (!exists) {
        writeAlertEvent({
          organizationId: org.id,
          level: "warning",
          eventType: "approval.overdue",
          entityType: row.orderType,
          entityId: row.id,
          message: `${row.orderType.toUpperCase()} ${row.orderNo} pending since ${row.submittedAt}`
        });
      }
    }
  }
}

export async function processWebhookDeliveries() {
  const now = Date.now();
  const jobs = db
    .prepare(
      `
      SELECT d.id, d.organization_id as organizationId, d.endpoint_id as endpointId, d.event_type as eventType,
             d.payload, d.attempt_count as attemptCount,
             e.url, e.secret
      FROM webhook_deliveries d
      JOIN webhook_endpoints e ON e.id = d.endpoint_id
      WHERE d.status IN ('pending', 'retry')
        AND d.next_attempt_at <= ?
        AND e.enabled = 1
      ORDER BY d.id ASC
      LIMIT 20
      `
    )
    .all(now) as Array<{
    id: number;
    organizationId: number;
    endpointId: number;
    eventType: string;
    payload: string;
    attemptCount: number;
    url: string;
    secret?: string;
  }>;

  for (const job of jobs) {
    const nextAttemptCount = Number(job.attemptCount || 0) + 1;
    try {
      const body = job.payload;
      const headers: Record<string, string> = { "content-type": "application/json", "x-webhook-event": job.eventType };
      if (job.secret) {
        headers["x-webhook-signature"] = createHmac("sha256", job.secret).update(body).digest("hex");
      }
      const resp = await fetch(job.url, { method: "POST", headers, body });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      db.prepare(
        "UPDATE webhook_deliveries SET status = 'delivered', attempt_count = ?, delivered_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?"
      ).run(nextAttemptCount, job.id);
    } catch (e) {
      const maxAttempts = 5;
      const backoffMs = Math.min(5 * 60 * 1000, 10_000 * Math.pow(2, Math.max(0, nextAttemptCount - 1)));
      const status = nextAttemptCount >= maxAttempts ? "failed" : "retry";
      db.prepare(
        "UPDATE webhook_deliveries SET status = ?, attempt_count = ?, next_attempt_at = ?, last_error = ? WHERE id = ?"
      ).run(status, nextAttemptCount, Date.now() + backoffMs, e instanceof Error ? e.message : String(e), job.id);
    }
  }
}
