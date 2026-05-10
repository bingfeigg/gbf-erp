import db from "../db";
import { hasPermission } from "../middleware/auth";
import type { RoleName } from "../types";

export type OrderListFilters = {
  q: string;
  status: string;
  stage: string;
  actionableOnly: boolean;
};

export type PurchaseOrderListRow = {
  id: number;
  orderNo: string;
  supplierId: number;
  status: string;
  totalAmount: number;
  totalQty: number;
  receivedQty: number;
  remainingQty: number;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  voidedAt: string | null;
  approvedBy: number | null;
  paymentStatus: "no_bill" | "unpaid" | "partial_paid" | "paid";
  billOpenAmount: number;
};

export type SalesOrderListRow = {
  id: number;
  orderNo: string;
  customerId: number;
  status: string;
  totalAmount: number;
  totalQty: number;
  deliveredQty: number;
  remainingQty: number;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  voidedAt: string | null;
  approvedBy: number | null;
  receiptStatus: "no_invoice" | "unreceived" | "partial_received" | "received";
  invoiceOpenAmount: number;
};

export function fetchPurchaseOrderListRows(orgId: number): Omit<
  PurchaseOrderListRow,
  "paymentStatus" | "billOpenAmount"
>[] {
  return db
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
    .all(orgId) as Omit<PurchaseOrderListRow, "paymentStatus" | "billOpenAmount">[];
}

export function attachPurchaseOrderPaymentFields(
  orgId: number,
  rows: Omit<PurchaseOrderListRow, "paymentStatus" | "billOpenAmount">[]
): PurchaseOrderListRow[] {
  const billStmt = db.prepare(
    `
          SELECT total_amount as totalAmount, paid_amount as paidAmount
          FROM ap_bills
          WHERE organization_id = ? AND ref_type = 'purchase_order' AND ref_id = ?
          ORDER BY id DESC
          LIMIT 1
          `
  );
  return rows.map((row) => {
    let paymentStatus: PurchaseOrderListRow["paymentStatus"] = "no_bill";
    let billOpenAmount = 0;
    const bill = billStmt.get(orgId, row.id) as { totalAmount: number; paidAmount: number } | undefined;
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
}

export function purchaseOrderStageKey(r: PurchaseOrderListRow): string {
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
}

export function filterPurchaseOrderList(
  rows: PurchaseOrderListRow[],
  filters: OrderListFilters,
  user: { role: RoleName }
): PurchaseOrderListRow[] {
  const { q, status, stage, actionableOnly } = filters;
  return rows.filter((r) => {
    if (q) {
      const hay = `${r.id || ""} ${r.orderNo || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const st = String(r.status || "").toLowerCase();
    if (status !== "all" && st !== status) return false;
    if (actionableOnly) {
      const canSubmit = hasPermission(user, "purchase:submit");
      const canApprove = hasPermission(user, "purchase:approve");
      if (st === "draft" && !canSubmit) return false;
      if (st === "submitted" && !canApprove) return false;
      if (st !== "draft" && st !== "submitted") return false;
    }
    if (stage !== "all" && purchaseOrderStageKey(r) !== stage) return false;
    return true;
  });
}

export function fetchSalesOrderListRows(orgId: number): Omit<
  SalesOrderListRow,
  "receiptStatus" | "invoiceOpenAmount"
>[] {
  return db
    .prepare(
      `
      SELECT
        so.id,
        so.order_no as orderNo,
        so.customer_id as customerId,
        so.status,
        so.total_amount as totalAmount,
        COALESCE(SUM(soi.qty), 0) as totalQty,
        COALESCE(SUM(soi.delivered_qty), 0) as deliveredQty,
        COALESCE(SUM(soi.qty - soi.delivered_qty), 0) as remainingQty,
        so.created_at as createdAt,
        so.submitted_at as submittedAt,
        so.approved_at as approvedAt,
        so.rejected_at as rejectedAt,
        so.voided_at as voidedAt,
        so.approved_by as approvedBy
      FROM sales_orders so
      LEFT JOIN sales_order_items soi ON soi.order_id = so.id
      WHERE so.organization_id = ?
      GROUP BY so.id
      ORDER BY so.id DESC
      `
    )
    .all(orgId) as Omit<SalesOrderListRow, "receiptStatus" | "invoiceOpenAmount">[];
}

export function attachSalesOrderReceiptFields(
  orgId: number,
  rows: Omit<SalesOrderListRow, "receiptStatus" | "invoiceOpenAmount">[]
): SalesOrderListRow[] {
  const invStmt = db.prepare(
    `
          SELECT total_amount as totalAmount, received_amount as receivedAmount
          FROM ar_invoices
          WHERE organization_id = ? AND ref_type = 'sales_order' AND ref_id = ?
          ORDER BY id DESC
          LIMIT 1
          `
  );
  return rows.map((row) => {
    let receiptStatus: SalesOrderListRow["receiptStatus"] = "no_invoice";
    let invoiceOpenAmount = 0;
    const invoice = invStmt.get(orgId, row.id) as { totalAmount: number; receivedAmount: number } | undefined;
    if (invoice) {
      const total = Number(invoice.totalAmount || 0);
      const received = Number(invoice.receivedAmount || 0);
      invoiceOpenAmount = Math.max(0, total - received);
      if (received <= 0.0001) receiptStatus = "unreceived";
      else if (received + 0.0001 >= total) receiptStatus = "received";
      else receiptStatus = "partial_received";
    }
    return { ...row, receiptStatus, invoiceOpenAmount };
  });
}

export function salesOrderStageKey(r: SalesOrderListRow): string {
  const st = String(r.status || "").toLowerCase();
  if (st !== "approved") return "other";
  const total = Number(r.totalQty || 0);
  const done = Number(r.deliveredQty || 0);
  const f = total <= 0 || done <= 0 ? "none" : done + 0.0001 >= total ? "full" : "partial";
  const settlement = String(r.receiptStatus || "");
  if (f === "none" && (settlement === "unreceived" || settlement === "no_invoice")) return "todo";
  if (f === "partial") return "doing";
  if (f === "full" && (settlement === "unreceived" || settlement === "no_invoice")) return "wait_settle";
  if (f === "full" && settlement === "partial_received") return "settling";
  if (f === "full" && settlement === "received") return "done";
  return "abnormal";
}

export function filterSalesOrderList(
  rows: SalesOrderListRow[],
  filters: OrderListFilters,
  user: { role: RoleName }
): SalesOrderListRow[] {
  const { q, status, stage, actionableOnly } = filters;
  return rows.filter((r) => {
    if (q) {
      const hay = `${r.id || ""} ${r.orderNo || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const st = String(r.status || "").toLowerCase();
    if (status !== "all" && st !== status) return false;
    if (actionableOnly) {
      const canSubmit = hasPermission(user, "sales:submit");
      const canApprove = hasPermission(user, "sales:approve");
      if (st === "draft" && !canSubmit) return false;
      if (st === "submitted" && !canApprove) return false;
      if (st !== "draft" && st !== "submitted") return false;
    }
    if (stage !== "all" && salesOrderStageKey(r) !== stage) return false;
    return true;
  });
}
