import db from "../db";

export function makeEntryNo(prefix: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${y}${m}${day}${rnd}`;
}

export function createJournalEntry(args: {
  organizationId: number;
  entryNo: string;
  refType: string;
  refId: number;
  memo?: string;
  lines: Array<{ accountCode: string; debit: number; credit: number }>;
}) {
  const debits = args.lines.reduce((s, l) => s + l.debit, 0);
  const credits = args.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(debits - credits) > 0.0001) {
    throw new Error(`Unbalanced journal entry: debit ${debits} != credit ${credits}`);
  }
  const entry = db
    .prepare("INSERT INTO journal_entries (organization_id, entry_no, ref_type, ref_id, memo) VALUES (?, ?, ?, ?, ?)")
    .run(args.organizationId, args.entryNo, args.refType, args.refId, args.memo ?? null);
  const entryId = Number(entry.lastInsertRowid);
  const insertLine = db.prepare(
    "INSERT INTO journal_lines (entry_id, account_code, debit, credit) VALUES (?, ?, ?, ?)"
  );
  for (const line of args.lines) {
    insertLine.run(entryId, line.accountCode, line.debit, line.credit);
  }
  return entryId;
}
