import { Express } from "express";
import db from "../db";
import { auth, hasPermission, AuthenticatedRequest } from "../middleware/auth";
import { canTransitionOrder } from "../services/order-helpers";

export function registerApprovalsRoutes(app: Express): void {
  const maybePaginate = <T>(req: AuthenticatedRequest, rows: T[]) => {
    const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize || 0)));
    const page = Math.max(1, Number(req.query.page || 1));
    if (!(pageSize > 0)) return rows;
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
  };

  app.get("/api/approvals/pending", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;
    const q = String((req.query.q ?? "") as string).trim().toLowerCase();
    const stage = String((req.query.stage ?? "all") as string).trim();
    const status = String((req.query.status ?? "all") as string).trim().toLowerCase();

    const stageKey = (args: {
      orderType: "purchase" | "sales";
      status: string;
      totalQty: number;
      doneQty: number;
      settlement: string;
      totalAmount: number;
      settledAmount: number;
    }) => {
      const st = String(args.status || "").toLowerCase();
      if (st !== "approved") return "other";
      const total = Number(args.totalQty || 0);
      const done = Number(args.doneQty || 0);
      const f = total <= 0 || done <= 0 ? "none" : done + 0.0001 >= total ? "full" : "partial";
      const totalAmt = Number(args.totalAmount || 0);
      const settledAmt = Number(args.settledAmount || 0);
      const unsettled = settledAmt <= 0.0001;
      const settled = totalAmt > 0 && settledAmt + 0.0001 >= totalAmt;
      const partial = settledAmt > 0.0001 && settledAmt + 0.0001 < totalAmt;
      if (f === "none" && unsettled) return "todo";
      if (f === "partial") return "doing";
      if (f === "full" && unsettled) return "wait_settle";
      if (f === "full" && partial) return "settling";
      if (f === "full" && settled) return "done";
      return "abnormal";
    };

    const rows: Array<Record<string, unknown>> = [];
    if (hasPermission(user, "purchase:approve")) {
      const po = db
        .prepare(
          `
        SELECT
          'purchase' as orderType,
          po.id,
          po.order_no as orderNo,
          po.supplier_id as supplierId,
          po.status,
          po.total_amount as totalAmount,
          COALESCE(SUM(poi.qty), 0) as totalQty,
          COALESCE(SUM(poi.received_qty), 0) as receivedQty,
          po.submitted_at as submittedAt,
          po.created_at as createdAt
        FROM purchase_orders po
        LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
        WHERE po.organization_id = ? AND po.status = 'submitted'
        GROUP BY po.id
        ORDER BY po.id DESC
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      po.forEach((r) => {
        const bill = db
          .prepare(
            `SELECT total_amount as totalAmount, paid_amount as paidAmount
             FROM ap_bills WHERE organization_id = ? AND ref_type = 'purchase_order' AND ref_id = ? ORDER BY id DESC LIMIT 1`
          )
          .get(orgId, r.id) as { totalAmount: number; paidAmount: number } | undefined;
        const total = Number(bill?.totalAmount || 0);
        const paid = Number(bill?.paidAmount || 0);
        let paymentStatus = "no_bill";
        let billOpenAmount = 0;
        if (bill) {
          billOpenAmount = Math.max(0, total - paid);
          if (paid <= 0.0001) paymentStatus = "unpaid";
          else if (paid + 0.0001 >= total) paymentStatus = "paid";
          else paymentStatus = "partial_paid";
        }
        rows.push({ ...r, paymentStatus, billOpenAmount });
      });
    }
    if (hasPermission(user, "sales:approve")) {
      const so = db
        .prepare(
          `
        SELECT
          'sales' as orderType,
          so.id,
          so.order_no as orderNo,
          so.customer_id as customerId,
          so.status,
          so.total_amount as totalAmount,
          COALESCE(SUM(soi.qty), 0) as totalQty,
          COALESCE(SUM(soi.delivered_qty), 0) as deliveredQty,
          so.submitted_at as submittedAt,
          so.created_at as createdAt
        FROM sales_orders so
        LEFT JOIN sales_order_items soi ON soi.order_id = so.id
        WHERE so.organization_id = ? AND so.status = 'submitted'
        GROUP BY so.id
        ORDER BY so.id DESC
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      so.forEach((r) => {
        const inv = db
          .prepare(
            `SELECT total_amount as totalAmount, received_amount as receivedAmount
             FROM ar_invoices WHERE organization_id = ? AND ref_type = 'sales_order' AND ref_id = ? ORDER BY id DESC LIMIT 1`
          )
          .get(orgId, r.id) as { totalAmount: number; receivedAmount: number } | undefined;
        const total = Number(inv?.totalAmount || 0);
        const rec = Number(inv?.receivedAmount || 0);
        let receiptStatus = "no_invoice";
        let invoiceOpenAmount = 0;
        if (inv) {
          invoiceOpenAmount = Math.max(0, total - rec);
          if (rec <= 0.0001) receiptStatus = "unreceived";
          else if (rec + 0.0001 >= total) receiptStatus = "received";
          else receiptStatus = "partial_received";
        }
        rows.push({ ...r, receiptStatus, invoiceOpenAmount });
      });
    }
    rows.sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    const filtered = rows.filter((r) => {
      const orderNo = String(r.orderNo || "").toLowerCase();
      if (q && !orderNo.includes(q) && !String(r.id || "").includes(q)) return false;
      const st = String(r.status || "").toLowerCase();
      if (status !== "all" && st !== status) return false;
      if (stage && stage !== "all") {
        const isSales = String(r.orderType) === "sales";
        const k = stageKey({
          orderType: isSales ? "sales" : "purchase",
          status: String(r.status || ""),
          totalQty: Number(r.totalQty || 0),
          doneQty: Number(isSales ? r.deliveredQty || 0 : r.receivedQty || 0),
          settlement: String(isSales ? r.receiptStatus || "" : r.paymentStatus || ""),
          totalAmount: Number(r.totalAmount || 0),
          settledAmount: isSales
            ? Number(r.totalAmount || 0) - Number(r.invoiceOpenAmount || 0)
            : Number(r.totalAmount || 0) - Number(r.billOpenAmount || 0)
        });
        if (k !== stage) return false;
      }
      return true;
    });
    res.json(maybePaginate(req as AuthenticatedRequest, filtered));
  });

  app.get("/api/approvals/overdue", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;
    const hours = Number(req.query.hours ?? 24);
    const sinceExpr = `datetime('now', '-${Math.max(1, Math.floor(hours))} hours')`;
    const rows: Array<Record<string, unknown>> = [];
    if (hasPermission(user, "purchase:approve")) {
      const po = db
        .prepare(
          `
        SELECT 'purchase' as orderType, id, order_no as orderNo, total_amount as totalAmount, submitted_at as submittedAt
        FROM purchase_orders
        WHERE status = 'submitted' AND organization_id = ? AND submitted_at IS NOT NULL AND submitted_at <= ${sinceExpr}
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      rows.push(...po);
    }
    if (hasPermission(user, "sales:approve")) {
      const so = db
        .prepare(
          `
        SELECT 'sales' as orderType, id, order_no as orderNo, total_amount as totalAmount, submitted_at as submittedAt
        FROM sales_orders
        WHERE status = 'submitted' AND organization_id = ? AND submitted_at IS NOT NULL AND submitted_at <= ${sinceExpr}
        `
        )
        .all(orgId) as Array<Record<string, unknown>>;
      rows.push(...so);
    }
    rows.sort((a, b) => String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")));
    res.json(maybePaginate(req as AuthenticatedRequest, rows));
  });

  app.get("/api/approvals/sla-dashboard", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orgId = user.organizationId;

    const makeStats = (table: "purchase_orders" | "sales_orders") => {
      const result = db
        .prepare(
          `
        SELECT
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as pendingCount,
          SUM(CASE WHEN status = 'submitted' AND submitted_at IS NOT NULL AND submitted_at <= datetime('now', '-24 hours') THEN 1 ELSE 0 END) as overdue24hCount,
          AVG(CASE
            WHEN status = 'approved' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL
            THEN (julianday(approved_at) - julianday(submitted_at)) * 24
            ELSE NULL
          END) as avgApproveHours
        FROM ${table}
        WHERE organization_id = ?
        `
        )
        .get(orgId) as { pendingCount: number; overdue24hCount: number; avgApproveHours: number | null };
      return {
        pendingCount: Number(result.pendingCount || 0),
        overdue24hCount: Number(result.overdue24hCount || 0),
        avgApproveHours: result.avgApproveHours == null ? null : Number(result.avgApproveHours.toFixed(2))
      };
    };

    const data: Record<string, unknown> = {};
    if (hasPermission(user, "purchase:approve")) data.purchase = makeStats("purchase_orders");
    if (hasPermission(user, "sales:approve")) data.sales = makeStats("sales_orders");
    res.json(data);
  });

  app.get("/api/approvals/:orderType/:id/timeline", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orderType = String(req.params.orderType);
    const id = String(req.params.id);
    if (!["purchase", "sales"].includes(orderType)) return next(new Error("Invalid order type"));
    const entityType = orderType === "purchase" ? "purchase_order" : "sales_order";

    if (orderType === "purchase" && !hasPermission(user, "purchase:read") && !hasPermission(user, "purchase:approve")) {
      return next(new Error("Forbidden: missing read permission"));
    }
    if (orderType === "sales" && !hasPermission(user, "sales:read") && !hasPermission(user, "sales:approve")) {
      return next(new Error("Forbidden: missing read permission"));
    }

    const logs = db
      .prepare(
        `
      SELECT id, username, action, detail, created_at as createdAt
      FROM audit_logs
      WHERE organization_id = ? AND entity_type = ? AND entity_id = ?
      ORDER BY id ASC
      `
      )
      .all(user.organizationId, entityType, id);
    res.json(logs);
  });

  app.post("/api/approvals/batch-action", auth, (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const orderType = String(req.body?.orderType || "");
    const action = String(req.body?.action || "") as "submit" | "approve" | "reject";
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x: unknown) => Number(x)).filter((x: number) => x > 0) : [];
    const items: Array<{ orderType: "purchase" | "sales"; id: number }> = Array.isArray(req.body?.items)
      ? req.body.items
          .map((x: any) => ({ orderType: String(x?.orderType) as any, id: Number(x?.id) }))
          .filter((x: any) => (x.orderType === "purchase" || x.orderType === "sales") && x.id > 0)
      : [];
    const comment = String(req.body?.comment || "").trim();
    if (!["purchase", "sales", "mixed"].includes(orderType)) return next(new Error("Invalid order type"));
    if (!["submit", "approve", "reject"].includes(action)) return next(new Error("Unsupported batch action"));
    if (orderType === "mixed") {
      if (!items.length) return next(new Error("items is required for mixed"));
      // permission check per type below
    } else {
      if (!ids.length) return next(new Error("ids is required"));
      if (!hasPermission(user, action === "submit" ? `${orderType}:submit` : `${orderType}:approve`)) {
        return next(new Error("Forbidden: missing permission"));
      }
    }
    if (action === "reject" && !comment) return next(new Error("reject comment is required"));

    const orgId = user.organizationId;
    const failures: Array<{ id: number; reason: string }> = [];
    const successes: number[] = [];
    const runOne = (t: "purchase" | "sales", list: number[]) => {
      if (!list.length) return;
      if (!hasPermission(user, action === "submit" ? `${t}:submit` : `${t}:approve`)) {
        list.forEach((id) => failures.push({ id, reason: "Forbidden: missing permission" }));
        return;
      }
      const table = t === "purchase" ? "purchase_orders" : "sales_orders";
      const idCol = t === "purchase" ? "supplier_id" : "customer_id";
      const refType = t === "purchase" ? "purchase_order" : "sales_order";
      const billTable = t === "purchase" ? "ap_bills" : "ar_invoices";
      const billNoCol = t === "purchase" ? "bill_no" : "invoice_no";
      const amountPaidCol = t === "purchase" ? "paid_amount" : "received_amount";

      for (const id of list) {
        try {
          const order = db
            .prepare(`SELECT id, order_no as orderNo, status, total_amount as totalAmount, ${idCol} as partyId FROM ${table} WHERE id = ? AND organization_id = ?`)
            .get(id, orgId) as { id: number; orderNo: string; status: string; totalAmount: number; partyId: number } | undefined;
          if (!order) throw new Error("order not found");
          if (!canTransitionOrder(String(order.status || ""), action)) throw new Error(`cannot ${action} from ${order.status}`);
          let nextStatus = order.status;
          if (action === "submit") nextStatus = "submitted";
          if (action === "approve") nextStatus = "approved";
          if (action === "reject") nextStatus = "rejected";
          db.prepare(
            `UPDATE ${table}
             SET status = ?,
                 submitted_at = CASE WHEN ? = 'submit' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
                 approved_at = CASE WHEN ? = 'approve' THEN CURRENT_TIMESTAMP ELSE approved_at END,
                 rejected_at = CASE WHEN ? = 'reject' THEN CURRENT_TIMESTAMP ELSE rejected_at END,
                 approved_by = CASE WHEN ? = 'approve' THEN ? ELSE approved_by END
             WHERE id = ? AND organization_id = ?`
          ).run(nextStatus, action, action, action, action, user.id, order.id, orgId);

          if (action === "approve") {
            const existed = db
              .prepare(`SELECT id FROM ${billTable} WHERE organization_id = ? AND ref_type = ? AND ref_id = ? LIMIT 1`)
              .get(orgId, refType, order.id) as { id: number } | undefined;
            if (!existed) {
              const noPrefix = orderType === "purchase" ? "AP-" : "AR-";
              db.prepare(
                `INSERT INTO ${billTable} (organization_id, ${billNoCol}, ${orderType === "purchase" ? "supplier_id" : "customer_id"}, ref_type, ref_id, total_amount, ${amountPaidCol}, status)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 'open')`
              ).run(orgId, `${noPrefix}${order.orderNo}`, order.partyId, refType, order.id, order.totalAmount);
            }
          }

          db.prepare(
            "INSERT INTO audit_logs (organization_id, username, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(orgId, user.username, `${t}_order.${action}`, `${t}_order`, order.id, JSON.stringify({ from: order.status, to: nextStatus, comment: comment || null }));
          successes.push(order.id);
        } catch (e) {
          failures.push({ id, reason: e instanceof Error ? e.message : String(e) });
        }
      }
    };

    const trx = db.transaction(() => {
      if (orderType === "mixed") {
        const group = { purchase: [] as number[], sales: [] as number[] };
        items.forEach((it) => group[it.orderType].push(it.id));
        runOne("purchase", group.purchase);
        runOne("sales", group.sales);
      } else {
        runOne(orderType as "purchase" | "sales", ids);
      }
    });
    trx();
    res.json({ successCount: successes.length, failureCount: failures.length, failures, ids: successes });
  });
}
