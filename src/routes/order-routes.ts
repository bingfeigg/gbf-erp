import { Express } from "express";
import { registerPurchaseOrderRoutes } from "./purchase-order-routes";
import { registerSalesOrderRoutes } from "./sales-order-routes";
import { registerFulfillmentRoutes } from "./fulfillment-routes";

export function registerOrderRoutes(app: Express): void {
  registerPurchaseOrderRoutes(app);
  registerSalesOrderRoutes(app);
  registerFulfillmentRoutes(app);
}
