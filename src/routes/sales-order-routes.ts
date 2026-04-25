import { Express } from "express";
import db from "../db";
import { auth, requirePermission, getOrgId, hasPermission, AuthenticatedRequest } from "../middleware/auth";
import { salesOrderSchema, orderActionSchema } from "../schemas/api";
import { makeEntryNo, createJournalEntry } from "../services/journal";
import { writeAuditLog } from "../services/audit";
import { bodyHash, loadIdempotency, saveIdempotency } from "../services/idempotency";
import { assertEntityExists, actionPermission, canTransitionOrder } from "../services/order-helpers";

export function registerSalesOrderRoutes(app: Express): void {
  app.post("/api/sales-orders", auth, requirePermission("sales:write"), (req, res, next) => {
    const parsed = salesOrderSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { orderNo, customerId, items } = parsed.data;
    const orgId = getOrgId(req);

    const trx = db.transaction(() => {
      assertEntityExists("SELECT id FROM customers WHERE id = ? AND organization_id = ?", [customerId, orgId], "Customer");
      for (const item of items) {
        assertEntityExists<{ id: number }>(
          "SELECT id FROM products WHERE id = ? AND organization_id = ?",
          [item.productId, orgId],
          "Product"
        );
      }

      const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const order = db
        .prepare("INSERT INTO sales_orders (organization_id, order_no, customer_id, status, total_amount) VALUES (?, ?, ?, ?, ?)")
        .run(orgId, orderNo, customerId, "draft", total);
      const orderId = Number(order.lastInsertRowid);

      for (const item of items) {
        const amount = item.qty * item.price;
        db.prepare(
          "INSERT INTO sales_order_items (order_id, product_id, qty, price, amount) VALUES (?, ?, ?, ?, ?)"
        ).run(orderId, item.productId, item.qty, item.price, amount);
      }
      return { orderId, total };
    });

    const result = trx();
    writeAuditLog({
      req,
      action: "sales_order.create",
      entityType: "sales_order",
      entityId: result.orderId,
      detail: { orderNo, customerId, totalAmount: result.total }
    });
    res.status(201).json({
      id: result.orderId,
      orderNo,
      customerId,
      status: "draft",
      totalAmount: result.total
    });
  });

  app.get("/api/sales-orders", auth, requirePermission("sales:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db
      .prepare(
        "SELECT id, order_no as orderNo, customer_id as customerId, status, total_amount as totalAmount, created_at as createdAt, submitted_at as submittedAt, approved_at as approvedAt, rejected_at as rejectedAt, voided_at as voidedAt, approved_by as approvedBy FROM sales_orders WHERE organization_id = ? ORDER BY id DESC"
      )
      .all(orgId);
    res.json(rows);
  });

  app.get("/api/sales-orders/:id", auth, requirePermission("sales:read"), (req, res, next) => {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const orgId = getOrgId(req);
    const order = db
      .prepare(
        `SELECT so.id, so.order_no as orderNo, so.customer_id as customerId, c.code as customerCode, c.name as customerName,
            so.status, so.total_amount as totalAmount, so.created_at as createdAt, so.submitted_at as submittedAt,
            so.approved_at as approvedAt, so.rejected_at as rejectedAt, so.voided_at as voidedAt, so.approved_by as approvedBy
         FROM sales_orders so
         JOIN customers c ON c.id = so.customer_id AND c.organization_id = so.organization_id
         WHERE so.id = ? AND so.organization_id = ?`
      )
      .get(orderId, orgId) as Record<string, unknown> | undefined;
    if (!order) return next(new Error("Sales order not found"));
    const items = db
      .prepare(
        `SELECT soi.id, soi.product_id as productId, p.sku, p.name as productName, soi.qty, soi.price, soi.amount
         FROM sales_order_items soi
         JOIN products p ON p.id = soi.product_id AND p.organization_id = ?
         WHERE soi.order_id = ?
         ORDER BY soi.id`
      )
      .all(orgId, orderId);
    res.json({ order, items });
  });

  app.post("/api/sales-orders/:id/action", auth, (req, res, next) => {
    const parsed = orderActionSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const { action, comment } = parsed.data;
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;
    if (!hasPermission(user, actionPermission("sales", action))) return next(new Error("Forbidden: missing approval permission"));
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash({ orderId, ...parsed.data });
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, `sales.action.${orderId}`, idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    const trx = db.transaction(() => {
      const order = db
        .prepare(
          "SELECT id, order_no as orderNo, customer_id as customerId, status, total_amount as totalAmount FROM sales_orders WHERE id = ? AND organization_id = ?"
        )
        .get(orderId, orgId) as { id: number; orderNo: string; customerId: number; status: string; totalAmount: number } | undefined;
      if (!order) throw new Error("Sales order not found");
      if (order.status === "approved" && action === "approve") {
        const invoice = db
          .prepare(
            "SELECT id, invoice_no as invoiceNo FROM ar_invoices WHERE organization_id = ? AND ref_type = 'sales_order' AND ref_id = ? LIMIT 1"
          )
          .get(orgId, order.id) as { id: number; invoiceNo: string } | undefined;
        return { order, nextStatus: "approved", arInvoice: invoice, idempotent: true };
      }
      if (!canTransitionOrder(order.status, action)) throw new Error(`Invalid action ${action} for status ${order.status}`);

      if (action === "reverse") {
        const invoice = db
          .prepare(
            "SELECT id, invoice_no as invoiceNo, received_amount as receivedAmount FROM ar_invoices WHERE organization_id = ? AND ref_type = 'sales_order' AND ref_id = ? LIMIT 1"
          )
          .get(orgId, order.id) as { id: number; invoiceNo: string; receivedAmount: number } | undefined;
        if (!invoice) throw new Error("AR invoice not found for this sales order");
        const received = Number(invoice.receivedAmount || 0);
        if (received > 0.0001) throw new Error("Cannot reverse: AR invoice already received (has settlement lines)");
        const receiptLines = db
          .prepare("SELECT COUNT(*) as cnt FROM ar_receipt_lines WHERE organization_id = ? AND ar_invoice_id = ?")
          .get(orgId, invoice.id) as { cnt: number };
        if (Number(receiptLines.cnt || 0) > 0) throw new Error("Cannot reverse: AR invoice already received (has receipt lines)");

        const items = db
          .prepare("SELECT product_id as productId, qty, price FROM sales_order_items WHERE order_id = ? ORDER BY id")
          .all(order.id) as Array<{ productId: number; qty: number; price: number }>;
        let totalCogs = 0;
        for (const item of items) {
          const product = db
            .prepare("SELECT id, cost_price as costPrice FROM products WHERE id = ? AND organization_id = ?")
            .get(item.productId, orgId) as { id: number; costPrice: number } | undefined;
          if (!product) throw new Error(`Product not found: ${item.productId}`);
          totalCogs += item.qty * Number(product.costPrice || 0);
        }
        for (const item of items) {
          db.prepare(
            "INSERT INTO stock_ledger (organization_id, product_id, qty_change, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)"
          ).run(orgId, item.productId, item.qty, "sales_order_reverse", order.id);
        }

        db.prepare("UPDATE ar_invoices SET status = 'voided' WHERE id = ? AND organization_id = ?").run(invoice.id, orgId);

        createJournalEntry({
          organizationId: orgId,
          entryNo: makeEntryNo("JE-SO-RV-"),
          refType: "sales_order_reverse",
          refId: order.id,
          memo: `Sales reversed ${order.orderNo}`,
          lines: [
            { accountCode: "6001", debit: order.totalAmount, credit: 0 },
            { accountCode: "1122", debit: 0, credit: order.totalAmount },
            { accountCode: "1405", debit: totalCogs, credit: 0 },
            { accountCode: "6401", debit: 0, credit: totalCogs }
          ]
        });

        db.prepare(
          `
        UPDATE sales_orders
        SET status = 'reversed',
            reversed_at = CURRENT_TIMESTAMP,
            reversed_by = ?
        WHERE id = ? AND organization_id = ?
        `
        ).run(user.id, order.id, orgId);

        return { order, nextStatus: "reversed", arInvoice: { id: invoice.id, invoiceNo: invoice.invoiceNo } };
      }

      let nextStatus = order.status;
      if (action === "submit") nextStatus = "submitted";
      if (action === "reject") nextStatus = "draft";
      if (action === "void") nextStatus = "voided";
      if (action === "approve") nextStatus = "approved";
      db.prepare(
        `
      UPDATE sales_orders
      SET status = ?,
          submitted_at = CASE WHEN ? = 'submit' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
          approved_at = CASE WHEN ? = 'approve' THEN CURRENT_TIMESTAMP ELSE approved_at END,
          rejected_at = CASE WHEN ? = 'reject' THEN CURRENT_TIMESTAMP ELSE rejected_at END,
          voided_at = CASE WHEN ? = 'void' THEN CURRENT_TIMESTAMP ELSE voided_at END,
          approved_by = CASE WHEN ? = 'approve' THEN ? ELSE approved_by END
      WHERE id = ?
      `
      ).run(nextStatus, action, action, action, action, action, user.id, order.id);

      let arInvoice: { id: number; invoiceNo: string } | undefined;
      if (action === "approve") {
        const existedInvoice = db
          .prepare(
            "SELECT id, invoice_no as invoiceNo FROM ar_invoices WHERE organization_id = ? AND ref_type = 'sales_order' AND ref_id = ? LIMIT 1"
          )
          .get(orgId, order.id) as { id: number; invoiceNo: string } | undefined;
        if (existedInvoice) {
          arInvoice = existedInvoice;
          return { order, nextStatus, arInvoice };
        }
        const items = db
          .prepare("SELECT product_id as productId, qty, price FROM sales_order_items WHERE order_id = ? ORDER BY id")
          .all(order.id) as Array<{ productId: number; qty: number; price: number }>;
        let totalCogs = 0;
        for (const item of items) {
          const product = db
            .prepare("SELECT id, cost_price as costPrice FROM products WHERE id = ? AND organization_id = ?")
            .get(item.productId, orgId) as { id: number; costPrice: number } | undefined;
          if (!product) throw new Error(`Product not found: ${item.productId}`);
          const stock = db
            .prepare("SELECT COALESCE(SUM(qty_change), 0) as qty FROM stock_ledger WHERE product_id = ? AND organization_id = ?")
            .get(item.productId, orgId) as { qty: number };
          if (stock.qty < item.qty) throw new Error(`Insufficient stock for product ${item.productId}: ${stock.qty} < ${item.qty}`);
          totalCogs += item.qty * product.costPrice;
        }
        for (const item of items) {
          db.prepare(
            "INSERT INTO stock_ledger (organization_id, product_id, qty_change, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)"
          ).run(orgId, item.productId, -item.qty, "sales_order", order.id);
        }
        const invoiceNo = `AR-${order.orderNo}`;
        const ar = db
          .prepare(
            "INSERT INTO ar_invoices (organization_id, invoice_no, customer_id, ref_type, ref_id, total_amount, received_amount, status) VALUES (?, ?, ?, ?, ?, ?, 0, 'open')"
          )
          .run(orgId, invoiceNo, order.customerId, "sales_order", order.id, order.totalAmount);
        arInvoice = { id: Number(ar.lastInsertRowid), invoiceNo };
        createJournalEntry({
          organizationId: orgId,
          entryNo: makeEntryNo("JE-SO-"),
          refType: "sales_order",
          refId: order.id,
          memo: `Sales approved ${order.orderNo}`,
          lines: [
            { accountCode: "1122", debit: order.totalAmount, credit: 0 },
            { accountCode: "6001", debit: 0, credit: order.totalAmount },
            { accountCode: "6401", debit: totalCogs, credit: 0 },
            { accountCode: "1405", debit: 0, credit: totalCogs }
          ]
        });
      }
      return { order, nextStatus, arInvoice };
    });

    const result = trx();
    writeAuditLog({
      req,
      action: `sales_order.${action}`,
      entityType: "sales_order",
      entityId: result.order.id,
      detail: { from: result.order.status, to: result.nextStatus, comment: comment ?? null }
    });
    const payload = { id: result.order.id, orderNo: result.order.orderNo, status: result.nextStatus, arInvoice: result.arInvoice };
    if (idempotencyKey) {
      saveIdempotency({
        organizationId: orgId,
        endpoint: `sales.action.${orderId}`,
        idempotencyKey,
        requestHash,
        statusCode: 200,
        response: payload
      });
    }
    res.json(payload);
  });
}
