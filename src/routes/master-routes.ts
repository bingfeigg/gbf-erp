import { Express } from "express";
import db from "../db";
import { auth, requirePermission, requireAnyPermission, getOrgId } from "../middleware/auth";
import { locationSchema, partnerSchema, productSchema, userCreateSchema, warehouseSchema } from "../schemas/api";
import { hashPassword } from "../security";
import { writeAuditLog } from "../services/audit";

export function registerMasterRoutes(app: Express): void {
  function makeAutoCode(prefix: string, n: number) {
    return `${prefix}${String(n).padStart(4, "0")}`;
  }

  function nextWarehouseCode(orgId: number): string {
    const rows = db
      .prepare("SELECT code FROM warehouses WHERE organization_id = ?")
      .all(orgId) as Array<{ code: string }>;
    const set = new Set(rows.map((r) => String(r.code || "").trim()).filter(Boolean));
    let n = set.size + 1;
    for (let i = 0; i < 20000; i++) {
      const code = makeAutoCode("WH", n + i);
      if (!set.has(code)) return code;
    }
    throw new Error("Failed to generate warehouse code");
  }

  function nextLocationCode(orgId: number, warehouseId: number): string {
    const rows = db
      .prepare("SELECT code FROM locations WHERE organization_id = ? AND warehouse_id = ?")
      .all(orgId, warehouseId) as Array<{ code: string }>;
    const set = new Set(rows.map((r) => String(r.code || "").trim()).filter(Boolean));
    let n = set.size + 1;
    for (let i = 0; i < 20000; i++) {
      const code = makeAutoCode("LOC", n + i);
      if (!set.has(code)) return code;
    }
    throw new Error("Failed to generate location code");
  }

  app.get("/api/users", auth, requirePermission("*"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db.prepare("SELECT id, username, role FROM users WHERE organization_id = ? ORDER BY id DESC").all(orgId);
    res.json(rows);
  });

  app.post("/api/users", auth, requirePermission("*"), (req, res, next) => {
    const parsed = userCreateSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { username, password, role } = parsed.data;
    const orgId = getOrgId(req);
    const info = db
      .prepare("INSERT INTO users (organization_id, username, password, role) VALUES (?, ?, ?, ?)")
      .run(orgId, username, hashPassword(password), role);
    writeAuditLog({
      req,
      action: "user.create",
      entityType: "user",
      entityId: Number(info.lastInsertRowid),
      detail: { username, role }
    });
    res.status(201).json({ id: info.lastInsertRowid, username, role });
  });

  app.get("/api/customers", auth, requirePermission("customer:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db.prepare("SELECT * FROM customers WHERE organization_id = ? ORDER BY id DESC").all(orgId);
    res.json(rows);
  });

  app.post("/api/customers", auth, requirePermission("customer:write"), (req, res, next) => {
    const parsed = partnerSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { code, name, contact, phone } = parsed.data;
    const orgId = getOrgId(req);
    const info = db
      .prepare("INSERT INTO customers (organization_id, code, name, contact, phone) VALUES (?, ?, ?, ?, ?)")
      .run(orgId, code, name, contact ?? null, phone ?? null);
    writeAuditLog({
      req,
      action: "customer.create",
      entityType: "customer",
      entityId: Number(info.lastInsertRowid),
      detail: { code, name }
    });
    res.status(201).json({ id: info.lastInsertRowid, code, name, contact, phone });
  });

  app.get("/api/suppliers", auth, requirePermission("supplier:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db.prepare("SELECT * FROM suppliers WHERE organization_id = ? ORDER BY id DESC").all(orgId);
    res.json(rows);
  });

  app.post("/api/suppliers", auth, requirePermission("supplier:write"), (req, res, next) => {
    const parsed = partnerSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { code, name, contact, phone } = parsed.data;
    const orgId = getOrgId(req);
    const info = db
      .prepare("INSERT INTO suppliers (organization_id, code, name, contact, phone) VALUES (?, ?, ?, ?, ?)")
      .run(orgId, code, name, contact ?? null, phone ?? null);
    writeAuditLog({
      req,
      action: "supplier.create",
      entityType: "supplier",
      entityId: Number(info.lastInsertRowid),
      detail: { code, name }
    });
    res.status(201).json({ id: info.lastInsertRowid, code, name, contact, phone });
  });

  app.get("/api/products", auth, requirePermission("product:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const warehouseId = Number(_req.query.warehouseId || 0);
    const locationId = Number(_req.query.locationId || 0);
    const hasWarehouse = Number.isFinite(warehouseId) && warehouseId > 0;
    const hasLocation = Number.isFinite(locationId) && locationId > 0;
    const rows = db
      .prepare(
        `
      SELECT p.id, p.sku, p.name, p.unit, p.cost_price as costPrice, p.sale_price as salePrice,
        COALESCE(SUM(s.qty_change), 0) as stockQty
      FROM products p
      LEFT JOIN stock_ledger s ON s.product_id = p.id AND s.organization_id = p.organization_id
      WHERE p.organization_id = ?
        AND (? = 0 OR s.warehouse_id = ?)
        AND (? = 0 OR s.location_id = ?)
      GROUP BY p.id
      ORDER BY p.id DESC
      `
      )
      .all(orgId, hasWarehouse ? 1 : 0, warehouseId, hasLocation ? 1 : 0, locationId);
    res.json(rows);
  });

  app.post("/api/products", auth, requireAnyPermission("stock:write", "product:write"), (req, res, next) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { sku, name, unit, costPrice, salePrice } = parsed.data;
    const orgId = getOrgId(req);
    const info = db
      .prepare("INSERT INTO products (organization_id, sku, name, unit, cost_price, sale_price) VALUES (?, ?, ?, ?, ?, ?)")
      .run(orgId, sku, name, unit, costPrice, salePrice);
    writeAuditLog({
      req,
      action: "product.create",
      entityType: "product",
      entityId: Number(info.lastInsertRowid),
      detail: { sku, name }
    });
    res.status(201).json({ id: info.lastInsertRowid, sku, name, unit, costPrice, salePrice });
  });

  app.get("/api/stock/ledger", auth, requirePermission("stock:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const warehouseId = Number(_req.query.warehouseId || 0);
    const locationId = Number(_req.query.locationId || 0);
    const batchNo = String(_req.query.batchNo || "").trim();
    const hasWarehouse = Number.isFinite(warehouseId) && warehouseId > 0;
    const hasLocation = Number.isFinite(locationId) && locationId > 0;
    const hasBatch = batchNo.length > 0;
    const rows = db
      .prepare(
        `
      SELECT l.id, l.product_id as productId, p.sku, p.name, l.qty_change as qtyChange, l.unit_cost as unitCost,
        l.warehouse_id as warehouseId, l.location_id as locationId, l.batch_no as batchNo,
        l.ref_type as refType, l.ref_id as refId, l.created_at as createdAt
      FROM stock_ledger l
      JOIN products p ON p.id = l.product_id AND p.organization_id = l.organization_id
      WHERE l.organization_id = ?
        AND (? = 0 OR l.warehouse_id = ?)
        AND (? = 0 OR l.location_id = ?)
        AND (? = 0 OR l.batch_no = ?)
      ORDER BY l.id DESC
      `
      )
      .all(orgId, hasWarehouse ? 1 : 0, warehouseId, hasLocation ? 1 : 0, locationId, hasBatch ? 1 : 0, batchNo);
    res.json(rows);
  });

  app.get("/api/warehouses", auth, requirePermission("stock:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const rows = db.prepare("SELECT id, code, name FROM warehouses WHERE organization_id = ? ORDER BY id DESC").all(orgId);
    res.json(rows);
  });

  app.post("/api/warehouses", auth, requirePermission("stock:write"), (req, res, next) => {
    const parsed = warehouseSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orgId = getOrgId(req);
    const { name } = parsed.data;
    const code = String(parsed.data.code || "").trim() || nextWarehouseCode(orgId);
    const info = db.prepare("INSERT INTO warehouses (organization_id, code, name) VALUES (?, ?, ?)").run(orgId, code, name);
    writeAuditLog({
      req,
      action: "warehouse.create",
      entityType: "warehouse",
      entityId: Number(info.lastInsertRowid),
      detail: { code, name }
    });
    res.status(201).json({ id: Number(info.lastInsertRowid), code, name });
  });

  app.get("/api/locations", auth, requirePermission("stock:read"), (_req, res) => {
    const orgId = getOrgId(_req);
    const warehouseId = Number(_req.query.warehouseId || 0);
    const hasWarehouse = Number.isFinite(warehouseId) && warehouseId > 0;
    const rows = hasWarehouse
      ? db
          .prepare(
            "SELECT id, warehouse_id as warehouseId, code, name FROM locations WHERE organization_id = ? AND warehouse_id = ? ORDER BY id DESC"
          )
          .all(orgId, warehouseId)
      : db
          .prepare("SELECT id, warehouse_id as warehouseId, code, name FROM locations WHERE organization_id = ? ORDER BY id DESC")
          .all(orgId);
    res.json(rows);
  });

  app.post("/api/locations", auth, requirePermission("stock:write"), (req, res, next) => {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const orgId = getOrgId(req);
    const { warehouseId, name } = parsed.data;
    const wh = db
      .prepare("SELECT id FROM warehouses WHERE organization_id = ? AND id = ?")
      .get(orgId, warehouseId) as { id: number } | undefined;
    if (!wh) return next(new Error("Warehouse not found"));
    const code = String(parsed.data.code || "").trim() || nextLocationCode(orgId, warehouseId);
    const info = db
      .prepare("INSERT INTO locations (organization_id, warehouse_id, code, name) VALUES (?, ?, ?, ?)")
      .run(orgId, warehouseId, code, name);
    writeAuditLog({
      req,
      action: "location.create",
      entityType: "location",
      entityId: Number(info.lastInsertRowid),
      detail: { warehouseId, code, name }
    });
    res.status(201).json({ id: Number(info.lastInsertRowid), warehouseId, code, name });
  });
}
