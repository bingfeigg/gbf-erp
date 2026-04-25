import { createHash } from "crypto";
import db from "../db";

export function bodyHash(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

export function loadIdempotency(
  organizationId: number,
  endpoint: string,
  idempotencyKey: string,
  requestHash: string
): { statusCode: number; response: unknown } | null {
  const row = db
    .prepare(
      `
      SELECT request_hash as requestHash, response_json as responseJson, status_code as statusCode
      FROM api_idempotency
      WHERE organization_id = ? AND endpoint = ? AND idempotency_key = ?
      `
    )
    .get(organizationId, endpoint, idempotencyKey) as
    | { requestHash: string; responseJson: string; statusCode: number }
    | undefined;
  if (!row) return null;
  if (row.requestHash !== requestHash) {
    throw new Error("Idempotency key already used with different payload");
  }
  return { statusCode: row.statusCode, response: JSON.parse(row.responseJson) };
}

export function saveIdempotency(args: {
  organizationId: number;
  endpoint: string;
  idempotencyKey: string;
  requestHash: string;
  statusCode: number;
  response: unknown;
}) {
  db.prepare(
    `
    INSERT OR REPLACE INTO api_idempotency
      (organization_id, endpoint, idempotency_key, request_hash, response_json, status_code)
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(
    args.organizationId,
    args.endpoint,
    args.idempotencyKey,
    args.requestHash,
    JSON.stringify(args.response),
    args.statusCode
  );
}
