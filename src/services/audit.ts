import { Request } from "express";
import db from "../db";
import type { AuthenticatedRequest } from "../middleware/auth";

export function writeAuditLog(args: {
  req?: Request;
  action: string;
  entityType: string;
  entityId?: string | number;
  detail?: unknown;
}) {
  const user = args.req ? (args.req as AuthenticatedRequest).user : undefined;
  db.prepare(
    "INSERT INTO audit_logs (organization_id, user_id, username, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    user?.organizationId ?? 1,
    user?.id ?? null,
    user?.username ?? null,
    args.action,
    args.entityType,
    args.entityId != null ? String(args.entityId) : null,
    args.detail != null ? JSON.stringify(args.detail) : null
  );
}
