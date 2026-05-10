import db from "../db";
import type { z } from "zod";
import { fulfillmentItemSchema } from "../schemas/api";
import { makeEntryNo, createJournalEntry } from "./journal";

export type FulfillmentItem = z.infer<typeof fulfillmentItemSchema>;

export function makeFulfillmentNo(prefix: string): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${y}${m}${day}-${rnd}`;
}

function autoBatchNoForReceipt(receiptNo: string, productId: number): string {
  return `BATCH-${receiptNo}-${productId}`;
}

function pickBatchWithEnoughQty(args: {
  organizationId: number;
  productId: number;
  qtyNeeded: number;
  warehouseId?: number;
  locationId?: number;
}): string | null {
  const { organizationId, productId, qtyNeeded, warehouseId, locationId } = args;
  const hasWarehouse = Number.isFinite(warehouseId) && Number(warehouseId) > 0;
  const hasLocation = Number.isFinite(locationId) && Number(locationId) > 0;
  const rows = db
    .prepare(
      `
      SELECT
        batch_no as batchNo,
        COALESCE(SUM(qty_change), 0) as qty
      FROM stock_ledger
      WHERE organization_id = ?
        AND product_id = ?
        AND batch_no IS NOT NULL
        AND batch_no <> ''
        AND (? = 0 OR warehouse_id = ?)
        AND (? = 0 OR location_id = ?)
      GROUP BY batch_no
      HAVING qty >= ?
      ORDER BY MIN(created_at) ASC
      LIMIT 1
      `
    )
    .get(
      organizationId,
      productId,
      hasWarehouse ? 1 : 0,
      hasWarehouse ? warehouseId : null,
      hasLocation ? 1 : 0,
      hasLocation ? locationId : null,
      qtyNeeded
    ) as { batchNo: string } | undefined;
  return rows?.batchNo ?? null;
}

function assertWarehouseAndLocation(orgId: number, warehouseId?: number, locationId?: number): void {
  if (warehouseId) {
    const wh = db
      .prepare("SELECT id FROM warehouses WHERE organization_id = ? AND id = ?")
      .get(orgId, warehouseId) as { id: number } | undefined;
    if (!wh) throw new Error("Warehouse not found");
  }
  if (locationId) {
    const loc = db
      .prepare("SELECT id, warehouse_id as warehouseId FROM locations WHERE organization_id = ? AND id = ?")
      .get(orgId, locationId) as { id: number; warehouseId: number } | undefined;
    if (!loc) throw new Error("Location not found");
    if (warehouseId && loc.warehouseId !== warehouseId) throw new Error("Location does not belong to warehouse");
  }
}

export function createPurchaseReceipt(args: {
  organizationId: number;
  orderId: number;
  receiptNo: string;
  warehouseId?: number;
  locationId?: number;
  items: FulfillmentItem[];
}): { receiptId: number; receiptNo: string; totalAmount: number } {
  const { organizationId: orgId, orderId, receiptNo, warehouseId, locationId, items } = args;
  return db.transaction(() => {
    assertWarehouseAndLocation(orgId, warehouseId, locationId);
    const order = db
      .prepare(
        "SELECT id, supplier_id as supplierId, order_no as orderNo, status FROM purchase_orders WHERE id = ? AND organization_id = ?"
      )
      .get(orderId, orgId) as { id: number; supplierId: number; orderNo: string; status: string } | undefined;
    if (!order) throw new Error("Purchase order not found");
    if (order.status !== "approved") throw new Error("Purchase order must be approved before receipt");

    const receipt = db
      .prepare(
        "INSERT INTO purchase_receipts (organization_id, receipt_no, order_id, supplier_id, warehouse_id, location_id, total_amount) VALUES (?, ?, ?, ?, ?, ?, 0)"
      )
      .run(orgId, receiptNo, order.id, order.supplierId, warehouseId ?? null, locationId ?? null);
    const receiptId = Number(receipt.lastInsertRowid);
    let totalAmount = 0;

    for (const item of items) {
      const row = db
        .prepare(
          `SELECT poi.id, poi.qty, poi.received_qty as receivedQty, poi.price, poi.product_id as productId, p.cost_price as costPrice
           FROM purchase_order_items poi
           JOIN products p ON p.id = poi.product_id AND p.organization_id = ?
           WHERE poi.order_id = ? AND poi.product_id = ?`
        )
        .get(orgId, order.id, item.productId) as
        | { id: number; qty: number; receivedQty: number; price: number; productId: number; costPrice: number }
        | undefined;
      if (!row) throw new Error(`Order item not found for product ${item.productId}`);
      const remaining = Number(row.qty) - Number(row.receivedQty);
      if (item.qty > remaining + 0.0001) throw new Error(`Receipt qty exceeds remaining for product ${item.productId}`);

      const stock = db
        .prepare("SELECT COALESCE(SUM(qty_change), 0) as qty FROM stock_ledger WHERE organization_id = ? AND product_id = ?")
        .get(orgId, row.productId) as { qty: number };
      const oldQty = Number(stock.qty || 0);
      const oldCost = Number(row.costPrice || 0);
      const newQty = oldQty + item.qty;
      const avgCost = newQty > 0 ? (oldQty * oldCost + item.qty * Number(row.price)) / newQty : Number(row.price);

      db.prepare("UPDATE products SET cost_price = ? WHERE id = ? AND organization_id = ?").run(avgCost, row.productId, orgId);
      db.prepare("UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?").run(item.qty, row.id);
      const batchNo = (item.batchNo && String(item.batchNo).trim()) || autoBatchNoForReceipt(receiptNo, row.productId);
      db.prepare(
        "INSERT INTO purchase_receipt_items (receipt_id, order_item_id, product_id, qty, unit_price, unit_cost, amount, batch_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        receiptId,
        row.id,
        row.productId,
        item.qty,
        row.price,
        row.price,
        item.qty * Number(row.price),
        batchNo
      );
      db.prepare(
        "INSERT INTO stock_ledger (organization_id, product_id, qty_change, unit_cost, warehouse_id, location_id, batch_no, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(orgId, row.productId, item.qty, row.price, warehouseId ?? null, locationId ?? null, batchNo, "purchase_receipt", receiptId);

      const amount = item.qty * Number(row.price);
      totalAmount += amount;
    }

    db.prepare("UPDATE purchase_receipts SET total_amount = ? WHERE id = ?").run(totalAmount, receiptId);
    createJournalEntry({
      organizationId: orgId,
      entryNo: makeEntryNo("JE-PR-"),
      refType: "purchase_receipt",
      refId: receiptId,
          memo: `采购收货 ${receiptNo}`,
      lines: [
        { accountCode: "1405", debit: totalAmount, credit: 0 },
        { accountCode: "2202", debit: 0, credit: totalAmount }
      ]
    });
    return { receiptId, receiptNo, totalAmount };
  })();
}

export function createSalesDelivery(args: {
  organizationId: number;
  orderId: number;
  deliveryNo: string;
  warehouseId?: number;
  locationId?: number;
  items: FulfillmentItem[];
}): { deliveryId: number; deliveryNo: string; totalAmount: number; totalCost: number } {
  const { organizationId: orgId, orderId, deliveryNo, warehouseId, locationId, items } = args;
  return db.transaction(() => {
    assertWarehouseAndLocation(orgId, warehouseId, locationId);
    const order = db
      .prepare(
        "SELECT id, customer_id as customerId, order_no as orderNo, status FROM sales_orders WHERE id = ? AND organization_id = ?"
      )
      .get(orderId, orgId) as { id: number; customerId: number; orderNo: string; status: string } | undefined;
    if (!order) throw new Error("Sales order not found");
    if (order.status !== "approved") throw new Error("Sales order must be approved before delivery");

    const delivery = db
      .prepare(
        "INSERT INTO sales_deliveries (organization_id, delivery_no, order_id, customer_id, warehouse_id, location_id, total_amount, total_cost) VALUES (?, ?, ?, ?, ?, ?, 0, 0)"
      )
      .run(orgId, deliveryNo, order.id, order.customerId, warehouseId ?? null, locationId ?? null);
    const deliveryId = Number(delivery.lastInsertRowid);
    let totalAmount = 0;
    let totalCost = 0;

    for (const item of items) {
      const row = db
        .prepare(
          `SELECT soi.id, soi.qty, soi.delivered_qty as deliveredQty, soi.price, soi.product_id as productId, p.cost_price as costPrice
           FROM sales_order_items soi
           JOIN products p ON p.id = soi.product_id AND p.organization_id = ?
           WHERE soi.order_id = ? AND soi.product_id = ?`
        )
        .get(orgId, order.id, item.productId) as
        | { id: number; qty: number; deliveredQty: number; price: number; productId: number; costPrice: number }
        | undefined;
      if (!row) throw new Error(`Order item not found for product ${item.productId}`);
      const remaining = Number(row.qty) - Number(row.deliveredQty);
      if (item.qty > remaining + 0.0001) throw new Error(`Delivery qty exceeds remaining for product ${item.productId}`);
      const stock = db
        .prepare("SELECT COALESCE(SUM(qty_change), 0) as qty FROM stock_ledger WHERE organization_id = ? AND product_id = ?")
        .get(orgId, row.productId) as { qty: number };
      if (Number(stock.qty || 0) + 0.0001 < item.qty) {
        throw new Error(`Insufficient stock for product ${item.productId}: ${Number(stock.qty || 0)} < ${item.qty}`);
      }

      const unitCost = Number(row.costPrice || 0);
      const batchNo =
        (item.batchNo && String(item.batchNo).trim()) ||
        pickBatchWithEnoughQty({
          organizationId: orgId,
          productId: row.productId,
          qtyNeeded: item.qty,
          warehouseId: warehouseId ?? undefined,
          locationId: locationId ?? undefined
        });
      if (!batchNo) {
        throw new Error(`无法自动匹配批次号（库存无可用批次或不足量），请手工填写批次号：productId=${row.productId}`);
      }
      const amount = item.qty * Number(row.price);
      const costAmount = item.qty * unitCost;
      totalAmount += amount;
      totalCost += costAmount;

      db.prepare("UPDATE sales_order_items SET delivered_qty = delivered_qty + ? WHERE id = ?").run(item.qty, row.id);
      db.prepare(
        "INSERT INTO sales_delivery_items (delivery_id, order_item_id, product_id, qty, unit_price, unit_cost, amount, cost_amount, batch_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(deliveryId, row.id, row.productId, item.qty, row.price, unitCost, amount, costAmount, batchNo);
      db.prepare(
        "INSERT INTO stock_ledger (organization_id, product_id, qty_change, unit_cost, warehouse_id, location_id, batch_no, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        orgId,
        row.productId,
        -item.qty,
        unitCost,
        warehouseId ?? null,
        locationId ?? null,
        batchNo,
        "sales_delivery",
        deliveryId
      );
    }

    db.prepare("UPDATE sales_deliveries SET total_amount = ?, total_cost = ? WHERE id = ?").run(totalAmount, totalCost, deliveryId);
    createJournalEntry({
      organizationId: orgId,
      entryNo: makeEntryNo("JE-SD-"),
      refType: "sales_delivery",
      refId: deliveryId,
          memo: `销售发货 ${deliveryNo}`,
      lines: [
        { accountCode: "1122", debit: totalAmount, credit: 0 },
        { accountCode: "6001", debit: 0, credit: totalAmount },
        { accountCode: "6401", debit: totalCost, credit: 0 },
        { accountCode: "1405", debit: 0, credit: totalCost }
      ]
    });
    return { deliveryId, deliveryNo, totalAmount, totalCost };
  })();
}

export function createPurchaseReturn(args: {
  organizationId: number;
  orderId: number;
  returnNo: string;
  warehouseId?: number;
  locationId?: number;
  items: FulfillmentItem[];
}): { returnId: number; returnNo: string; totalAmount: number } {
  const { organizationId: orgId, orderId, returnNo, warehouseId, locationId, items } = args;
  return db.transaction(() => {
    assertWarehouseAndLocation(orgId, warehouseId, locationId);
    const order = db
      .prepare("SELECT id, supplier_id as supplierId, status FROM purchase_orders WHERE id = ? AND organization_id = ?")
      .get(orderId, orgId) as { id: number; supplierId: number; status: string } | undefined;
    if (!order) throw new Error("Purchase order not found");
    if (order.status !== "approved") throw new Error("Purchase order must be approved before return");

    const ret = db
      .prepare(
        "INSERT INTO purchase_returns (organization_id, return_no, order_id, supplier_id, warehouse_id, location_id, total_amount) VALUES (?, ?, ?, ?, ?, ?, 0)"
      )
      .run(orgId, returnNo, order.id, order.supplierId, warehouseId ?? null, locationId ?? null);
    const returnId = Number(ret.lastInsertRowid);
    let totalAmount = 0;

    for (const item of items) {
      const row = db
        .prepare(
          "SELECT id, qty, received_qty as receivedQty, price, product_id as productId FROM purchase_order_items WHERE order_id = ? AND product_id = ?"
        )
        .get(order.id, item.productId) as
        | { id: number; qty: number; receivedQty: number; price: number; productId: number }
        | undefined;
      if (!row) throw new Error(`Order item not found for product ${item.productId}`);
      if (item.qty > Number(row.receivedQty) + 0.0001) throw new Error(`Return qty exceeds received qty for product ${item.productId}`);
      const stock = db
        .prepare("SELECT COALESCE(SUM(qty_change), 0) as qty FROM stock_ledger WHERE organization_id = ? AND product_id = ?")
        .get(orgId, row.productId) as { qty: number };
      if (Number(stock.qty || 0) + 0.0001 < item.qty) throw new Error(`Insufficient stock for product ${item.productId}`);

      const batchNo =
        (item.batchNo && String(item.batchNo).trim()) ||
        pickBatchWithEnoughQty({
          organizationId: orgId,
          productId: row.productId,
          qtyNeeded: item.qty,
          warehouseId: warehouseId ?? undefined,
          locationId: locationId ?? undefined
        });
      if (!batchNo) {
        throw new Error(`无法自动匹配批次号（库存无可用批次或不足量），请手工填写批次号：productId=${row.productId}`);
      }

      db.prepare("UPDATE purchase_order_items SET received_qty = received_qty - ? WHERE id = ?").run(item.qty, row.id);
      db.prepare(
        "INSERT INTO purchase_return_items (return_id, order_item_id, product_id, qty, unit_price, amount, batch_no) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(returnId, row.id, row.productId, item.qty, row.price, item.qty * Number(row.price), batchNo);
      db.prepare(
        "INSERT INTO stock_ledger (organization_id, product_id, qty_change, unit_cost, warehouse_id, location_id, batch_no, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        orgId,
        row.productId,
        -item.qty,
        row.price,
        warehouseId ?? null,
        locationId ?? null,
        batchNo,
        "purchase_return",
        returnId
      );

      totalAmount += item.qty * Number(row.price);
    }

    db.prepare("UPDATE purchase_returns SET total_amount = ? WHERE id = ?").run(totalAmount, returnId);
    createJournalEntry({
      organizationId: orgId,
      entryNo: makeEntryNo("JE-PRT-"),
      refType: "purchase_return",
      refId: returnId,
          memo: `采购退货 ${returnNo}`,
      lines: [
        { accountCode: "2202", debit: totalAmount, credit: 0 },
        { accountCode: "1405", debit: 0, credit: totalAmount }
      ]
    });
    return { returnId, returnNo, totalAmount };
  })();
}

export function createSalesReturn(args: {
  organizationId: number;
  orderId: number;
  returnNo: string;
  warehouseId?: number;
  locationId?: number;
  items: FulfillmentItem[];
}): { returnId: number; returnNo: string; totalAmount: number; totalCost: number } {
  const { organizationId: orgId, orderId, returnNo, warehouseId, locationId, items } = args;
  return db.transaction(() => {
    assertWarehouseAndLocation(orgId, warehouseId, locationId);
    const order = db
      .prepare("SELECT id, customer_id as customerId, status FROM sales_orders WHERE id = ? AND organization_id = ?")
      .get(orderId, orgId) as { id: number; customerId: number; status: string } | undefined;
    if (!order) throw new Error("Sales order not found");
    if (order.status !== "approved") throw new Error("Sales order must be approved before return");

    const ret = db
      .prepare(
        "INSERT INTO sales_returns (organization_id, return_no, order_id, customer_id, warehouse_id, location_id, total_amount, total_cost) VALUES (?, ?, ?, ?, ?, ?, 0, 0)"
      )
      .run(orgId, returnNo, order.id, order.customerId, warehouseId ?? null, locationId ?? null);
    const returnId = Number(ret.lastInsertRowid);
    let totalAmount = 0;
    let totalCost = 0;

    for (const item of items) {
      const row = db
        .prepare(
          `SELECT soi.id, soi.qty, soi.delivered_qty as deliveredQty, soi.price, soi.product_id as productId, p.cost_price as costPrice
           FROM sales_order_items soi
           JOIN products p ON p.id = soi.product_id AND p.organization_id = ?
           WHERE soi.order_id = ? AND soi.product_id = ?`
        )
        .get(orgId, order.id, item.productId) as
        | { id: number; qty: number; deliveredQty: number; price: number; productId: number; costPrice: number }
        | undefined;
      if (!row) throw new Error(`Order item not found for product ${item.productId}`);
      if (item.qty > Number(row.deliveredQty) + 0.0001) throw new Error(`Return qty exceeds delivered qty for product ${item.productId}`);

      const unitCost = Number(row.costPrice || 0);
      const amount = item.qty * Number(row.price);
      const costAmount = item.qty * unitCost;
      totalAmount += amount;
      totalCost += costAmount;

      db.prepare("UPDATE sales_order_items SET delivered_qty = delivered_qty - ? WHERE id = ?").run(item.qty, row.id);
      const batchNo =
        (item.batchNo && String(item.batchNo).trim()) ||
        pickBatchWithEnoughQty({
          organizationId: orgId,
          productId: row.productId,
          qtyNeeded: item.qty,
          warehouseId: warehouseId ?? undefined,
          locationId: locationId ?? undefined
        }) ||
        `BATCH-RET-${returnNo}-${row.productId}`;
      db.prepare(
        "INSERT INTO sales_return_items (return_id, order_item_id, product_id, qty, unit_price, unit_cost, amount, cost_amount, batch_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(returnId, row.id, row.productId, item.qty, row.price, unitCost, amount, costAmount, batchNo);
      db.prepare(
        "INSERT INTO stock_ledger (organization_id, product_id, qty_change, unit_cost, warehouse_id, location_id, batch_no, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        orgId,
        row.productId,
        item.qty,
        unitCost,
        warehouseId ?? null,
        locationId ?? null,
        batchNo,
        "sales_return",
        returnId
      );
    }

    db.prepare("UPDATE sales_returns SET total_amount = ?, total_cost = ? WHERE id = ?").run(totalAmount, totalCost, returnId);
    createJournalEntry({
      organizationId: orgId,
      entryNo: makeEntryNo("JE-SRT-"),
      refType: "sales_return",
      refId: returnId,
          memo: `销售退货 ${returnNo}`,
      lines: [
        { accountCode: "6001", debit: totalAmount, credit: 0 },
        { accountCode: "1122", debit: 0, credit: totalAmount },
        { accountCode: "1405", debit: totalCost, credit: 0 },
        { accountCode: "6401", debit: 0, credit: totalCost }
      ]
    });
    return { returnId, returnNo, totalAmount, totalCost };
  })();
}
