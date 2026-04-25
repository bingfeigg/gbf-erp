import { Express } from "express";
import db from "../db";
import { auth, requirePermission, requireAnyPermission, getOrgId } from "../middleware/auth";
import { partnerSchema, productSchema, userCreateSchema } from "../schemas/api";
import { hashPassword } from "../security";
import { writeAuditLog } from "../services/audit";

export function registerMasterRoutes(app: Express): void {
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
    const rows = db
      .prepare(
        `
      SELECT p.id, p.sku, p.name, p.unit, p.cost_price as costPrice, p.sale_price as salePrice,
        COALESCE(SUM(s.qty_change), 0) as stockQty
      FROM products p
      LEFT JOIN stock_ledger s ON s.product_id = p.id AND s.organization_id = p.organization_id
      WHERE p.organization_id = ?
      GROUP BY p.id
      ORDER BY p.id DESC
      `
      )
      .all(orgId);
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
    const rows = db
      .prepare(
        `
      SELECT l.id, l.product_id as productId, p.sku, p.name, l.qty_change as qtyChange, l.ref_type as refType, l.ref_id as refId, l.created_at as createdAt
      FROM stock_ledger l
      JOIN products p ON p.id = l.product_id AND p.organization_id = l.organization_id
      WHERE l.organization_id = ?
      ORDER BY l.id DESC
      `
      )
      .all(orgId);
    res.json(rows);
  });
}
