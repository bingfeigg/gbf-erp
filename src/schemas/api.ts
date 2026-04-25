import { z } from "zod";

export const partnerSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  contact: z.string().optional(),
  phone: z.string().optional()
});

export const productSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  unit: z.string().min(1),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative()
});

export const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().positive(),
  price: z.number().nonnegative()
});

export const purchaseOrderSchema = z.object({
  orderNo: z.string().min(3),
  supplierId: z.number().int().positive(),
  items: z.array(orderItemSchema).min(1)
});

export const salesOrderSchema = z.object({
  orderNo: z.string().min(3),
  customerId: z.number().int().positive(),
  items: z.array(orderItemSchema).min(1)
});

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(4)
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(20)
});

export const receiptSchema = z.object({
  receiptNo: z.string().min(3),
  customerId: z.number().int().positive(),
  arInvoiceId: z.number().int().positive().optional(),
  amount: z.number().positive()
});

export const paymentSchema = z.object({
  paymentNo: z.string().min(3),
  supplierId: z.number().int().positive(),
  apBillId: z.number().int().positive().optional(),
  amount: z.number().positive()
});

export const orderActionSchema = z.object({
  action: z.enum(["submit", "approve", "reject", "void", "reverse"]),
  comment: z.string().max(200).optional()
});

export const erpRoleSchema = z.enum(["admin", "sales", "purchase", "warehouse", "finance"]);

export const userCreateSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: erpRoleSchema
});

export const configApprovalRuleSchema = z.object({
  orderType: z.enum(["purchase", "sales"]),
  minAmount: z.number().nonnegative(),
  approverRole: erpRoleSchema
});

export const configAlertRuleSchema = z.object({
  ruleKey: z.string().min(2),
  ruleValue: z.string().min(1)
});

export const configWebhookEndpointSchema = z.object({
  id: z.number().int().positive().optional(),
  url: z.string().url(),
  eventType: z.string().min(1).default("*"),
  secret: z.string().min(1).optional(),
  enabled: z.boolean().default(true)
});
