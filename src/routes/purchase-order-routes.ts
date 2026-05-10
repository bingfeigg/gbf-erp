import { Express } from "express";
import db from "../db";
import { auth, requirePermission, getOrgId, hasPermission, AuthenticatedRequest } from "../middleware/auth";
import { purchaseOrderSchema, orderActionSchema } from "../schemas/api";
import { writeAuditLog } from "../services/audit";
import { bodyHash, loadIdempotency, saveIdempotency } from "../services/idempotency";
import { assertEntityExists, actionPermission, canTransitionOrder } from "../services/order-helpers";
import { paginateInMemory } from "../utils/pagination";

export function registerPurchaseOrderRoutes(app: Express): void {
  app.post("/api/purchase-orders", auth, requirePermission("purchase:write"), (req, res, next) => {
    const parsed = purchaseOrderSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { orderNo, supplierId, items } = parsed.data;
    const orgId = getOrgId(req);

    const trx = db.transaction(() => {
      assertEntityExists("SELECT id FROM suppliers WHERE id = ? AND organization_id = ?", [supplierId, orgId], "Supplier");
      const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const order = db
        .prepare("INSERT INTO purchase_orders (organization_id, order_no, supplier_id, status, total_amount) VALUES (?, ?, ?, ?, ?)")
        .run(orgId, orderNo, supplierId, "draft", total);
      const orderId = Number(order.lastInsertRowid);

      for (const item of items) {
        assertEntityExists("SELECT id FROM products WHERE id = ? AND organization_id = ?", [item.productId, orgId], "Product");
        const amount = item.qty * item.price;
        db.prepare(
          "INSERT INTO purchase_order_items (order_id, product_id, qty, price, amount) VALUES (?, ?, ?, ?, ?)"
        ).run(orderId, item.productId, item.qty, item.price, amount);
      }
      return { orderId, total };
    });

    const result = trx();
    writeAuditLog({
      req,
      action: "purchase_order.create",
      entityType: "purchase_order",
      entityId: result.orderId,
      detail: { orderNo, supplierId, totalAmount: result.total }
    });
    res.status(201).json({
      id: result.orderId,
      orderNo,
      supplierId,
      status: "draft",
      totalAmount: result.total
    });
  });

  app.get("/api/purchase-orders", auth, requirePermission("purchase:read"), (req, res) => {
    const orgId = getOrgId(req);
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const status = String(req.query.status ?? "all").trim().toLowerCase();
    const stage = String(req.query.stage ?? "all").trim();
    const actionableOnly = String(req.query.actionableOnly ?? "0") === "1";
    const rows = db
      .prepare(
        `
      SELECT
        po.id,
        po.order_no as orderNo,
        po.supplier_id as supplierId,
        po.status,
        po.total_amount as totalAmount,
        COALESCE(SUM(poi.qty), 0) as totalQty,
        COALESCE(SUM(poi.received_qty), 0) as receivedQty,
        COALESCE(SUM(poi.qty - poi.received_qty), 0) as remainingQty,
        po.created_at as createdAt,
        po.submitted_at as submittedAt,
        po.approved_at as approvedAt,
        po.rejected_at as rejectedAt,
        po.voided_at as voidedAt,
        po.approved_by as approvedBy
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
      WHERE po.organization_id = ?
      GROUP BY po.id
      ORDER BY po.id DESC
      `
      )
      .all(orgId) as Array<{
      id: number;
      status: string;
      totalAmount: number;
      totalQty: number;
      receivedQty: number;
      remainingQty: number;
    }>;
    const rowsWithPayment = rows.map((row) => {
      let paymentStatus: "no_bill" | "unpaid" | "partial_paid" | "paid" = "no_bill";
      let billOpenAmount = 0;
      const bill = db
        .prepare(
          `
          SELECT total_amount as totalAmount, paid_amount as paidAmount
          FROM ap_bills
          WHERE organization_id = ? AND ref_type = 'purchase_order' AND ref_id = ?
          ORDER BY id DESC
          LIMIT 1
          `
        )
        .get(orgId, row.id) as { totalAmount: number; paidAmount: number } | undefined;
      if (bill) {
        const total = Number(bill.totalAmount || 0);
        const paid = Number(bill.paidAmount || 0);
        billOpenAmount = Math.max(0, total - paid);
        if (paid <= 0.0001) paymentStatus = "unpaid";
        else if (paid + 0.0001 >= total) paymentStatus = "paid";
        else paymentStatus = "partial_paid";
      }
      return { ...row, paymentStatus, billOpenAmount };
    });
    const stageKey = (r: any) => {
      const st = String(r.status || "").toLowerCase();
      if (st !== "approved") return "other";
      const total = Number(r.totalQty || 0);
      const done = Number(r.receivedQty || 0);
      const f = total <= 0 || done <= 0 ? "none" : done + 0.0001 >= total ? "full" : "partial";
      const settlement = String(r.paymentStatus || "");
      if (f === "none" && (settlement === "unpaid" || settlement === "no_bill")) return "todo";
      if (f === "partial") return "doing";
      if (f === "full" && (settlement === "unpaid" || settlement === "no_bill")) return "wait_settle";
      if (f === "full" && settlement === "partial_paid") return "settling";
      if (f === "full" && settlement === "paid") return "done";
      return "abnormal";
    };
    const filtered = rowsWithPayment.filter((r: any) => {
      if (q) {
        const hay = `${r.id || ""} ${r.orderNo || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const st = String(r.status || "").toLowerCase();
      if (status !== "all" && st !== status) return false;
      if (actionableOnly) {
        const canSubmit = hasPermission((req as any).user, "purchase:submit");
        const canApprove = hasPermission((req as any).user, "purchase:approve");
        if (st === "draft" && !canSubmit) return false;
        if (st === "submitted" && !canApprove) return false;
        if (st !== "draft" && st !== "submitted") return false;
      }
      if (stage !== "all") {
        if (stageKey(r) !== stage) return false;
      }
      return true;
    });
    res.json(paginateInMemory(req, filtered, { maxPageSize: 200 }));
  });

  app.get("/api/purchase-orders/:id", auth, requirePermission("purchase:read"), (req, res, next) => {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const orgId = getOrgId(req);
    const order = db
      .prepare(
        `SELECT po.id, po.order_no as orderNo, po.supplier_id as supplierId, s.code as supplierCode, s.name as supplierName,
            po.status, po.total_amount as totalAmount, po.created_at as createdAt, po.submitted_at as submittedAt,
            po.approved_at as approvedAt, po.rejected_at as rejectedAt, po.voided_at as voidedAt, po.approved_by as approvedBy
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id AND s.organization_id = po.organization_id
         WHERE po.id = ? AND po.organization_id = ?`
      )
      .get(orderId, orgId) as Record<string, unknown> | undefined;
    if (!order) return next(new Error("Purchase order not found"));
    const items = db
      .prepare(
        `SELECT poi.id, poi.product_id as productId, p.sku, p.name as productName,
                poi.qty, poi.received_qty as receivedQty,
                (poi.qty - poi.received_qty) as remainingQty,
                poi.price, poi.amount
         FROM purchase_order_items poi
         JOIN products p ON p.id = poi.product_id AND p.organization_id = ?
         WHERE poi.order_id = ?
         ORDER BY poi.id`
      )
      .all(orgId, orderId);
    res.json({ order, items });
  });

  app.post("/api/purchase-orders/:id/action", auth, (req, res, next) => {
    const parsed = orderActionSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const { action, comment } = parsed.data;
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;
    if (!hasPermission(user, actionPermission("purchase", action))) return next(new Error("Forbidden: missing approval permission"));
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash({ orderId, ...parsed.data });
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, `purchase.action.${orderId}`, idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    const trx = db.transaction(() => {
      const order = db
        .prepare(
          "SELECT id, order_no as orderNo, supplier_id as supplierId, status, total_amount as totalAmount FROM purchase_orders WHERE id = ? AND organization_id = ?"
        )
        .get(orderId, orgId) as { id: number; orderNo: string; supplierId: number; status: string; totalAmount: number } | undefined;
      if (!order) throw new Error("Purchase order not found");
      if (order.status === "approved" && action === "approve") {
        const bill = db
          .prepare(
            "SELECT id, bill_no as billNo FROM ap_bills WHERE organization_id = ? AND ref_type = 'purchase_order' AND ref_id = ? LIMIT 1"
          )
          .get(orgId, order.id) as { id: number; billNo: string } | undefined;
        return { order, nextStatus: "approved", apBill: bill, idempotent: true };
      }
      if (!canTransitionOrder(order.status, action)) throw new Error(`Invalid action ${action} for status ${order.status}`);

      if (action === "reverse") {
        const bill = db
          .prepare(
            "SELECT id, bill_no as billNo, paid_amount as paidAmount FROM ap_bills WHERE organization_id = ? AND ref_type = 'purchase_order' AND ref_id = ? LIMIT 1"
          )
          .get(orgId, order.id) as { id: number; billNo: string; paidAmount: number } | undefined;
        if (!bill) throw new Error("AP bill not found for this purchase order");
        const paid = Number(bill.paidAmount || 0);
        if (paid > 0.0001) throw new Error("Cannot reverse: AP bill already paid (has settlement lines)");
        const paidLines = db
          .prepare("SELECT COUNT(*) as cnt FROM ap_payment_lines WHERE organization_id = ? AND ap_bill_id = ?")
          .get(orgId, bill.id) as { cnt: number };
        if (Number(paidLines.cnt || 0) > 0) throw new Error("Cannot reverse: AP bill already paid (has payment lines)");

        const receiptCount = db
          .prepare("SELECT COUNT(*) as cnt FROM purchase_receipts WHERE organization_id = ? AND order_id = ?")
          .get(orgId, order.id) as { cnt: number };
        if (Number(receiptCount.cnt || 0) > 0) throw new Error("Cannot reverse: purchase receipts already exist");

        db.prepare("UPDATE ap_bills SET status = 'voided' WHERE id = ? AND organization_id = ?").run(bill.id, orgId);

        db.prepare(
          `
        UPDATE purchase_orders
        SET status = 'reversed',
            reversed_at = CURRENT_TIMESTAMP,
            reversed_by = ?
        WHERE id = ? AND organization_id = ?
        `
        ).run(user.id, order.id, orgId);

        return { order, nextStatus: "reversed", apBill: { id: bill.id, billNo: bill.billNo } };
      }

      let nextStatus = order.status;
      if (action === "submit") nextStatus = "submitted";
      if (action === "reject") nextStatus = "rejected";
      if (action === "void") nextStatus = "voided";
      if (action === "approve") nextStatus = "approved";
      db.prepare(
        `
      UPDATE purchase_orders
      SET status = ?,
          submitted_at = CASE WHEN ? = 'submit' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
          approved_at = CASE WHEN ? = 'approve' THEN CURRENT_TIMESTAMP ELSE approved_at END,
          rejected_at = CASE WHEN ? = 'reject' THEN CURRENT_TIMESTAMP ELSE rejected_at END,
          voided_at = CASE WHEN ? = 'void' THEN CURRENT_TIMESTAMP ELSE voided_at END,
          approved_by = CASE WHEN ? = 'approve' THEN ? ELSE approved_by END
      WHERE id = ?
      `
      ).run(nextStatus, action, action, action, action, action, user.id, order.id);

      let apBill: { id: number; billNo: string } | undefined;
      if (action === "approve") {
        const existedBill = db
          .prepare(
            "SELECT id, bill_no as billNo FROM ap_bills WHERE organization_id = ? AND ref_type = 'purchase_order' AND ref_id = ? LIMIT 1"
          )
          .get(orgId, order.id) as { id: number; billNo: string } | undefined;
        if (existedBill) {
          apBill = existedBill;
          return { order, nextStatus, apBill };
        }
        const billNo = `AP-${order.orderNo}`;
        const ap = db
          .prepare(
            "INSERT INTO ap_bills (organization_id, bill_no, supplier_id, ref_type, ref_id, total_amount, paid_amount, status) VALUES (?, ?, ?, ?, ?, ?, 0, 'open')"
          )
          .run(orgId, billNo, order.supplierId, "purchase_order", order.id, order.totalAmount);
        apBill = { id: Number(ap.lastInsertRowid), billNo };
      }
      return { order, nextStatus, apBill };
    });

    const result = trx();
    writeAuditLog({
      req,
      action: `purchase_order.${action}`,
      entityType: "purchase_order",
      entityId: result.order.id,
      detail: { from: result.order.status, to: result.nextStatus, comment: comment ?? null }
    });
    const payload = { id: result.order.id, orderNo: result.order.orderNo, status: result.nextStatus, apBill: result.apBill };
    if (idempotencyKey) {
      saveIdempotency({
        organizationId: orgId,
        endpoint: `purchase.action.${orderId}`,
        idempotencyKey,
        requestHash,
        statusCode: 200,
        response: payload
      });
    }
    res.json(payload);
  });
}
