import { Express } from "express";
import { auth, getOrgId, requirePermission } from "../middleware/auth";
import { purchaseReceiptSchema, purchaseReturnSchema, salesDeliverySchema, salesReturnSchema } from "../schemas/api";
import { writeAuditLog } from "../services/audit";
import { bodyHash, loadIdempotency, saveIdempotency } from "../services/idempotency";
import {
  makeFulfillmentNo,
  createPurchaseReceipt,
  createSalesDelivery,
  createPurchaseReturn,
  createSalesReturn
} from "../services/fulfillment";

export function registerFulfillmentRoutes(app: Express): void {
  app.post("/api/purchase-orders/:id/receipts", auth, requirePermission("purchase:write"), (req, res, next) => {
    const parsed = purchaseReceiptSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const { items, warehouseId, locationId } = parsed.data;
    const receiptNo = parsed.data.receiptNo || makeFulfillmentNo("PR");
    const orgId = getOrgId(req);
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash({ orderId, ...parsed.data, receiptNo });
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, "fulfillment.purchase_receipt", idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    try {
      const result = createPurchaseReceipt({
        organizationId: orgId,
        orderId,
        receiptNo,
        warehouseId,
        locationId,
        items
      });
      writeAuditLog({
        req,
        action: "purchase_receipt.create",
        entityType: "purchase_receipt",
        entityId: result.receiptId,
        detail: { orderId, receiptNo: result.receiptNo, totalAmount: result.totalAmount }
      });
      const payload = { id: result.receiptId, receiptNo: result.receiptNo, orderId, totalAmount: result.totalAmount };
      if (idempotencyKey) {
        saveIdempotency({
          organizationId: orgId,
          endpoint: "fulfillment.purchase_receipt",
          idempotencyKey,
          requestHash,
          statusCode: 201,
          response: payload
        });
      }
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/sales-orders/:id/deliveries", auth, requirePermission("sales:write"), (req, res, next) => {
    const parsed = salesDeliverySchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const { items, warehouseId, locationId } = parsed.data;
    const deliveryNo = parsed.data.deliveryNo || makeFulfillmentNo("SD");
    const orgId = getOrgId(req);
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash({ orderId, ...parsed.data, deliveryNo });
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, "fulfillment.sales_delivery", idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    try {
      const result = createSalesDelivery({
        organizationId: orgId,
        orderId,
        deliveryNo,
        warehouseId,
        locationId,
        items
      });
      writeAuditLog({
        req,
        action: "sales_delivery.create",
        entityType: "sales_delivery",
        entityId: result.deliveryId,
        detail: { orderId, deliveryNo: result.deliveryNo, totalAmount: result.totalAmount, totalCost: result.totalCost }
      });
      const payload = { id: result.deliveryId, deliveryNo: result.deliveryNo, orderId, totalAmount: result.totalAmount, totalCost: result.totalCost };
      if (idempotencyKey) {
        saveIdempotency({
          organizationId: orgId,
          endpoint: "fulfillment.sales_delivery",
          idempotencyKey,
          requestHash,
          statusCode: 201,
          response: payload
        });
      }
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/purchase-orders/:id/returns", auth, requirePermission("purchase:write"), (req, res, next) => {
    const parsed = purchaseReturnSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const { items, warehouseId, locationId } = parsed.data;
    const returnNo = parsed.data.returnNo || makeFulfillmentNo("PRT");
    const orgId = getOrgId(req);
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash({ orderId, ...parsed.data, returnNo });
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, "fulfillment.purchase_return", idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    try {
      const result = createPurchaseReturn({
        organizationId: orgId,
        orderId,
        returnNo,
        warehouseId,
        locationId,
        items
      });
      writeAuditLog({
        req,
        action: "purchase_return.create",
        entityType: "purchase_return",
        entityId: result.returnId,
        detail: { orderId, returnNo: result.returnNo, totalAmount: result.totalAmount }
      });
      const payload = { id: result.returnId, returnNo: result.returnNo, orderId, totalAmount: result.totalAmount };
      if (idempotencyKey) {
        saveIdempotency({
          organizationId: orgId,
          endpoint: "fulfillment.purchase_return",
          idempotencyKey,
          requestHash,
          statusCode: 201,
          response: payload
        });
      }
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/sales-orders/:id/returns", auth, requirePermission("sales:write"), (req, res, next) => {
    const parsed = salesReturnSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) return next(new Error("Invalid order id"));
    const { items, warehouseId, locationId } = parsed.data;
    const returnNo = parsed.data.returnNo || makeFulfillmentNo("SRT");
    const orgId = getOrgId(req);
    const idempotencyKey = String(req.header("x-idempotency-key") || "").trim();
    const requestHash = bodyHash({ orderId, ...parsed.data, returnNo });
    if (idempotencyKey) {
      const cached = loadIdempotency(orgId, "fulfillment.sales_return", idempotencyKey, requestHash);
      if (cached) return res.status(cached.statusCode).json(cached.response);
    }

    try {
      const result = createSalesReturn({
        organizationId: orgId,
        orderId,
        returnNo,
        warehouseId,
        locationId,
        items
      });
      writeAuditLog({
        req,
        action: "sales_return.create",
        entityType: "sales_return",
        entityId: result.returnId,
        detail: { orderId, returnNo: result.returnNo, totalAmount: result.totalAmount, totalCost: result.totalCost }
      });
      const payload = {
        id: result.returnId,
        returnNo: result.returnNo,
        orderId,
        totalAmount: result.totalAmount,
        totalCost: result.totalCost
      };
      if (idempotencyKey) {
        saveIdempotency({
          organizationId: orgId,
          endpoint: "fulfillment.sales_return",
          idempotencyKey,
          requestHash,
          statusCode: 201,
          response: payload
        });
      }
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });
}
