import { Express } from "express";
import db from "../db";
import { auth, requirePermission, getOrgId } from "../middleware/auth";
import { receiptSchema, paymentSchema } from "../schemas/api";
import { makeEntryNo, createJournalEntry } from "../services/journal";
import { writeAuditLog } from "../services/audit";
import { bodyHash, loadIdempotency, saveIdempotency } from "../services/idempotency";

export function registerFinanceRoutes(app: Express): void {
  const maybePaginate = <T>(req: { query: Record<string, unknown> }, rows: T[]) => {
    const rawPageSize = Number(req.query.pageSize);
    if (!Number.isFinite(rawPageSize) || rawPageSize <= 0) return rows;
    const pageSize = Math.max(1, Math.min(200, rawPageSize));
    const page = Math.max(1, Number(req.query.page || 1));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
  };

  app.get("/api/finance/accounts", auth, requirePermission("purchase:read"), (_req, res) => {
    const rows = db.prepare("SELECT id, code, name, type FROM accounts ORDER BY code").all();
    res.json(rows);
  });

  app.get("/api/finance/journals", auth, requirePermission("purchase:read"), (_req, res) => {
    const entries = db
      .prepare(
        "SELECT id, entry_no as entryNo, ref_type as refType, ref_id as refId, memo, created_at as createdAt FROM journal_entries ORDER BY id DESC"
      )
      .all() as Array<{ id: number; entryNo: string }>;
    const getLines = db.prepare(
      "SELECT id, account_code as accountCode, debit, credit FROM journal_lines WHERE entry_id = ? ORDER BY id"
    );
    const rows = entries.map((e) => ({
      ...e,
      lines: getLines.all(e.id)
    }));
    res.json(rows);
  });

  app.get("/api/ar/invoices", auth, requirePermission("sales:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT i.id, i.invoice_no as invoiceNo, i.customer_id as customerId, c.name as customerName,
        i.ref_type as refType, i.ref_id as refId,
        i.total_amount as totalAmount, i.received_amount as receivedAmount, i.status, i.created_at as createdAt
      FROM ar_invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.organization_id = ?
      ORDER BY i.id DESC
      `
      )
      .all(orgId) as Array<{
      id: number;
      refType: string;
      refId: number;
      totalAmount: number;
      receivedAmount: number;
    }>;
    const rowsWithFulfillment = rows.map((row) => {
      let fulfillmentStatus: "unknown" | "not_shipped" | "partially_shipped" | "fully_shipped" = "unknown";
      if (row.refType === "sales_order" && row.refId) {
        const shipping = db
          .prepare(
            `
            SELECT
              COALESCE(SUM(qty), 0) as totalQty,
              COALESCE(SUM(delivered_qty), 0) as deliveredQty
            FROM sales_order_items
            WHERE order_id = ?
            `
          )
          .get(row.refId) as { totalQty: number; deliveredQty: number };
        const totalQty = Number(shipping.totalQty || 0);
        const deliveredQty = Number(shipping.deliveredQty || 0);
        if (totalQty <= 0 || deliveredQty <= 0) fulfillmentStatus = "not_shipped";
        else if (deliveredQty + 0.0001 >= totalQty) fulfillmentStatus = "fully_shipped";
        else fulfillmentStatus = "partially_shipped";
      }
      return { ...row, fulfillmentStatus };
    });
    res.json(maybePaginate(_req, rowsWithFulfillment));
  });

  app.get("/api/ap/bills", auth, requirePermission("purchase:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        `
      SELECT b.id, b.bill_no as billNo, b.supplier_id as supplierId, s.name as supplierName,
        b.ref_type as refType, b.ref_id as refId,
        b.total_amount as totalAmount, b.paid_amount as paidAmount, b.status, b.created_at as createdAt
      FROM ap_bills b
      JOIN suppliers s ON s.id = b.supplier_id
      WHERE b.organization_id = ?
      ORDER BY b.id DESC
      `
      )
      .all(orgId) as Array<{ id: number; refType: string; refId: number }>;
    const rowsWithFulfillment = rows.map((row) => {
      let fulfillmentStatus: "unknown" | "not_received" | "partially_received" | "fully_received" = "unknown";
      if (row.refType === "purchase_order" && row.refId) {
        const receiving = db
          .prepare(
            `
            SELECT
              COALESCE(SUM(qty), 0) as totalQty,
              COALESCE(SUM(received_qty), 0) as receivedQty
            FROM purchase_order_items
            WHERE order_id = ?
            `
          )
          .get(row.refId) as { totalQty: number; receivedQty: number };
        const totalQty = Number(receiving.totalQty || 0);
        const receivedQty = Number(receiving.receivedQty || 0);
        if (totalQty <= 0 || receivedQty <= 0) fulfillmentStatus = "not_received";
        else if (receivedQty + 0.0001 >= totalQty) fulfillmentStatus = "fully_received";
        else fulfillmentStatus = "partially_received";
      }
      return { ...row, fulfillmentStatus };
    });
    res.json(maybePaginate(_req, rowsWithFulfillment));
  });

  app.post("/api/finance/receipts", auth, requirePermission("sales:write"), (req, res, next) => {
    const parsed = receiptSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { receiptNo, customerId, arInvoiceId, amount } = parsed.data;
    const orgId = getOrgId(req);
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash(parsed.data);
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, "finance.receipt", idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    const trx = db.transaction(() => {
      let targetInvoiceId: number | null = arInvoiceId ?? null;
      if (targetInvoiceId == null) {
        const inv = db
          .prepare(
            "SELECT id FROM ar_invoices WHERE customer_id = ? AND organization_id = ? AND status = 'open' ORDER BY id ASC LIMIT 1"
          )
          .get(customerId, orgId) as { id: number } | undefined;
        if (!inv) throw new Error("No open AR invoice to apply");
        targetInvoiceId = inv.id;
      }

      const inv = db
        .prepare(
          "SELECT id, total_amount as totalAmount, received_amount as receivedAmount FROM ar_invoices WHERE id = ? AND organization_id = ?"
        )
        .get(targetInvoiceId, orgId) as { id: number; totalAmount: number; receivedAmount: number } | undefined;
      if (!inv) throw new Error("AR invoice not found");
      const remaining = inv.totalAmount - inv.receivedAmount;
      if (amount > remaining + 0.0001) throw new Error(`Receipt exceeds remaining AR: ${amount} > ${remaining}`);

      const receipt = db
        .prepare(
          "INSERT INTO cash_receipts (organization_id, receipt_no, customer_id, ar_invoice_id, amount) VALUES (?, ?, ?, ?, ?)"
        )
        .run(orgId, receiptNo, customerId, targetInvoiceId, amount);
      const receiptId = Number(receipt.lastInsertRowid);
      db.prepare(
        "INSERT INTO ar_receipt_lines (organization_id, receipt_id, ar_invoice_id, amount) VALUES (?, ?, ?, ?)"
      ).run(orgId, receiptId, targetInvoiceId, amount);

      const newReceived = inv.receivedAmount + amount;
      const status = newReceived >= inv.totalAmount - 0.0001 ? "paid" : "open";
      db.prepare("UPDATE ar_invoices SET received_amount = ?, status = ? WHERE id = ?").run(newReceived, status, inv.id);

      createJournalEntry({
        organizationId: orgId,
        entryNo: makeEntryNo("JE-RC-"),
        refType: "cash_receipt",
        refId: receiptId,
        memo: `Receipt ${receiptNo}`,
        lines: [
          { accountCode: "1001", debit: amount, credit: 0 },
          { accountCode: "1122", debit: 0, credit: amount }
        ]
      });

      return { receiptId, targetInvoiceId, status, newReceived };
    });

    const result = trx();
    writeAuditLog({
      req,
      action: "receipt.create",
      entityType: "cash_receipt",
      entityId: result.receiptId,
      detail: { receiptNo, customerId, amount }
    });
    const payload = {
      id: result.receiptId,
      receiptNo,
      customerId,
      arInvoiceId: result.targetInvoiceId,
      amount,
      invoiceStatus: result.status,
      invoiceReceivedAmount: result.newReceived
    };
    if (idempotencyKey) {
      saveIdempotency({
        organizationId: orgId,
        endpoint: "finance.receipt",
        idempotencyKey,
        requestHash,
        statusCode: 201,
        response: payload
      });
    }
    res.status(201).json(payload);
  });

  app.post("/api/finance/payments", auth, requirePermission("purchase:write"), (req, res, next) => {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { paymentNo, supplierId, apBillId, amount } = parsed.data;
    const orgId = getOrgId(req);
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash(parsed.data);
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, "finance.payment", idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    const trx = db.transaction(() => {
      let targetBillId: number | null = apBillId ?? null;
      if (targetBillId == null) {
        const bill = db
          .prepare(
            "SELECT id FROM ap_bills WHERE supplier_id = ? AND organization_id = ? AND status = 'open' ORDER BY id ASC LIMIT 1"
          )
          .get(supplierId, orgId) as { id: number } | undefined;
        if (!bill) throw new Error("No open AP bill to apply");
        targetBillId = bill.id;
      }

      const bill = db
        .prepare("SELECT id, total_amount as totalAmount, paid_amount as paidAmount FROM ap_bills WHERE id = ? AND organization_id = ?")
        .get(targetBillId, orgId) as { id: number; totalAmount: number; paidAmount: number } | undefined;
      if (!bill) throw new Error("AP bill not found");

      // 业务约束：采购单未收货完成时禁止付款（避免“先付后收”造成执行与资金脱节）。
      const linkedPurchase = db
        .prepare(
          `
          SELECT ref_id as orderId
          FROM ap_bills
          WHERE id = ? AND organization_id = ? AND ref_type = 'purchase_order'
          `
        )
        .get(targetBillId, orgId) as { orderId: number } | undefined;
      if (linkedPurchase?.orderId) {
        const remaining = db
          .prepare(
            `
            SELECT COALESCE(SUM(qty - received_qty), 0) as remainingQty
            FROM purchase_order_items
            WHERE order_id = ?
            `
          )
          .get(linkedPurchase.orderId) as { remainingQty: number };
        if (Number(remaining.remainingQty || 0) > 0.0001) {
          throw new Error("Cannot pay: purchase order not fully received yet");
        }
      }

      const remaining = bill.totalAmount - bill.paidAmount;
      if (amount > remaining + 0.0001) throw new Error(`Payment exceeds remaining AP: ${amount} > ${remaining}`);

      const payment = db
        .prepare(
          "INSERT INTO cash_payments (organization_id, payment_no, supplier_id, ap_bill_id, amount) VALUES (?, ?, ?, ?, ?)"
        )
        .run(orgId, paymentNo, supplierId, targetBillId, amount);
      const paymentId = Number(payment.lastInsertRowid);
      db.prepare(
        "INSERT INTO ap_payment_lines (organization_id, payment_id, ap_bill_id, amount) VALUES (?, ?, ?, ?)"
      ).run(orgId, paymentId, targetBillId, amount);

      const newPaid = bill.paidAmount + amount;
      const status = newPaid >= bill.totalAmount - 0.0001 ? "paid" : "open";
      db.prepare("UPDATE ap_bills SET paid_amount = ?, status = ? WHERE id = ?").run(newPaid, status, bill.id);

      createJournalEntry({
        organizationId: orgId,
        entryNo: makeEntryNo("JE-PY-"),
        refType: "cash_payment",
        refId: paymentId,
        memo: `Payment ${paymentNo}`,
        lines: [
          { accountCode: "2202", debit: amount, credit: 0 },
          { accountCode: "1001", debit: 0, credit: amount }
        ]
      });

      return { paymentId, targetBillId, status, newPaid };
    });

    const result = trx();
    writeAuditLog({
      req,
      action: "payment.create",
      entityType: "cash_payment",
      entityId: result.paymentId,
      detail: { paymentNo, supplierId, amount }
    });
    const payload = {
      id: result.paymentId,
      paymentNo,
      supplierId,
      apBillId: result.targetBillId,
      amount,
      billStatus: result.status,
      billPaidAmount: result.newPaid
    };
    if (idempotencyKey) {
      saveIdempotency({
        organizationId: orgId,
        endpoint: "finance.payment",
        idempotencyKey,
        requestHash,
        statusCode: 201,
        response: payload
      });
    }
    res.status(201).json(payload);
  });
}
