import db from "../db";

export type ArInvoiceNoRule = {
  source: "order_no" | "sequence";
  prefix: string;
  dateSegment: "none" | "yyyymm" | "yyyymmdd";
  sequenceDigits: number;
};

const DEFAULT_RULE: ArInvoiceNoRule = {
  source: "order_no",
  prefix: "AR-",
  dateSegment: "none",
  sequenceDigits: 4
};

function normalizeRule(row: Partial<ArInvoiceNoRule> | undefined): ArInvoiceNoRule {
  const source = row?.source === "sequence" ? "sequence" : "order_no";
  const dateSegment = row?.dateSegment === "yyyymmdd" || row?.dateSegment === "yyyymm" ? row.dateSegment : "none";
  const prefix = String(row?.prefix ?? DEFAULT_RULE.prefix);
  const digits = Number(row?.sequenceDigits ?? DEFAULT_RULE.sequenceDigits);
  return {
    source,
    prefix,
    dateSegment,
    sequenceDigits: Number.isFinite(digits) ? Math.max(1, Math.min(12, Math.floor(digits))) : DEFAULT_RULE.sequenceDigits
  };
}

function datePart(kind: ArInvoiceNoRule["dateSegment"]): string {
  if (kind === "none") return "";
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  if (kind === "yyyymm") return `${y}${m}`;
  return `${y}${m}${d}`;
}

export function getArInvoiceNoRule(organizationId: number): ArInvoiceNoRule {
  const row = db
    .prepare(
      `
      SELECT source, prefix, date_segment as dateSegment, sequence_digits as sequenceDigits
      FROM ar_invoice_no_rules
      WHERE organization_id = ?
      `
    )
    .get(organizationId) as Partial<ArInvoiceNoRule> | undefined;
  return normalizeRule(row);
}

export function saveArInvoiceNoRule(organizationId: number, input: ArInvoiceNoRule): ArInvoiceNoRule {
  const rule = normalizeRule(input);
  db.prepare(
    `
    INSERT INTO ar_invoice_no_rules (organization_id, source, prefix, date_segment, sequence_digits, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(organization_id)
    DO UPDATE SET
      source = excluded.source,
      prefix = excluded.prefix,
      date_segment = excluded.date_segment,
      sequence_digits = excluded.sequence_digits,
      updated_at = CURRENT_TIMESTAMP
    `
  ).run(organizationId, rule.source, rule.prefix, rule.dateSegment, rule.sequenceDigits);
  return rule;
}

export function makeArInvoiceNo(args: { organizationId: number; orderNo: string }): string {
  const rule = getArInvoiceNoRule(args.organizationId);
  if (rule.source === "order_no") {
    return `${rule.prefix}${args.orderNo}`;
  }

  const period = datePart(rule.dateSegment);
  const key = period || "";
  const existing = db
    .prepare(
      `
      SELECT id, current_value as currentValue
      FROM document_sequences
      WHERE organization_id = ? AND doc_type = 'ar_invoice' AND period_key = ?
      `
    )
    .get(args.organizationId, key) as { id: number; currentValue: number } | undefined;

  let nextValue = 1;
  if (existing) {
    nextValue = Number(existing.currentValue || 0) + 1;
    db.prepare(
      `
      UPDATE document_sequences
      SET current_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    ).run(nextValue, existing.id);
  } else {
    db.prepare(
      `
      INSERT INTO document_sequences (organization_id, doc_type, period_key, current_value, updated_at)
      VALUES (?, 'ar_invoice', ?, 1, CURRENT_TIMESTAMP)
      `
    ).run(args.organizationId, key);
  }

  const serial = String(nextValue).padStart(rule.sequenceDigits, "0");
  return `${rule.prefix}${period}${serial}`;
}
