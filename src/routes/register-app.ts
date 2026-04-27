import { Express } from "express";
import { registerPublicRoutes } from "./public";
import { registerAuthRoutes } from "./auth-routes";
import { registerFinanceRoutes } from "./finance-routes";
import { registerFinanceReportRoutes } from "./finance-report-routes";
import { registerMasterRoutes } from "./master-routes";
import { registerOrderRoutes } from "./order-routes";
import { registerNotificationRoutes } from "./notifications-routes";
import { registerApprovalsRoutes } from "./approvals-routes";
import { registerAuditRoutes } from "./audit-routes";
import { registerConfigRoutes } from "./config-routes";
import { registerReminderRoutes } from "./reminder-routes";

/** 注册全部 HTTP 路由（顺序敏感：先公开/认证；财务核心后立即财务报表；错误处理在 index 最后挂载） */
export function registerAppRoutes(app: Express): void {
  registerPublicRoutes(app);
  registerAuthRoutes(app);
  registerFinanceRoutes(app);
  registerFinanceReportRoutes(app);
  registerMasterRoutes(app);
  registerOrderRoutes(app);
  registerNotificationRoutes(app);
  registerApprovalsRoutes(app);
  registerAuditRoutes(app);
  registerReminderRoutes(app);
  registerConfigRoutes(app);
}
