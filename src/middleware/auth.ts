import { NextFunction, Request, Response } from "express";
import db from "../db";
import { RoleName } from "../types";
import { verifyToken } from "../security";

export const rolePermissions: Record<RoleName, string[]> = {
  admin: ["*"],
  sales: ["sales:read", "sales:write", "sales:submit", "customer:read", "customer:write", "product:read", "product:write"],
  purchase: ["purchase:read", "purchase:write", "purchase:submit", "supplier:read", "supplier:write", "product:read", "product:write"],
  warehouse: ["stock:read", "stock:write", "product:read", "product:write"],
  finance: ["sales:read", "purchase:read", "stock:read", "sales:approve", "purchase:approve"]
};

export function getPermissionsByRole(role: RoleName): string[] {
  return rolePermissions[role] ?? [];
}

export function hasPermission(user: { role: RoleName }, permission: string): boolean {
  const perms = getPermissionsByRole(user.role);
  return perms.includes("*") || perms.includes(permission);
}

/** 非生产环境下是否允许用 `x-username` 模拟登录（Bearer 始终优先）。 */
function devHeaderAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env.ALLOW_DEV_HEADER_AUTH;
  if (raw !== undefined && String(raw).trim() !== "") {
    const v = String(raw).trim().toLowerCase();
    if (v === "0" || v === "false" || v === "no" || v === "off") return false;
    if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  }
  return process.env.NODE_ENV === "development";
}

export type AuthenticatedRequest = Request & {
  user?: { id: number; username: string; role: RoleName; organizationId: number };
};

export function getOrgId(req: Request): number {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw new Error("Unauthorized");
  return user.organizationId;
}

export function auth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice("Bearer ".length).trim();
      const payload = verifyToken(token);
      if (payload.typ !== "access") {
        return next(new Error("Invalid token: not an access token (use Authorization Bearer access token)"));
      }
      const dbUser = db
        .prepare("SELECT organization_id as organizationId FROM users WHERE id = ?")
        .get(payload.sub) as { organizationId: number } | undefined;
      if (!dbUser) return next(new Error("User not found"));
      (req as AuthenticatedRequest).user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        organizationId: dbUser.organizationId
      };
      return next();
    } catch (e) {
      return next(e instanceof Error ? e : new Error("Invalid token"));
    }
  }

  if (process.env.NODE_ENV === "production") {
    return next(new Error("Missing auth token"));
  }

  if (!devHeaderAuthEnabled()) {
    return next(new Error("Missing auth token (set ALLOW_DEV_HEADER_AUTH=1 to use x-username in non-production)"));
  }

  const username = req.header("x-username");
  if (!username) return next(new Error("Missing auth token"));

  const user = db
    .prepare("SELECT id, username, role, organization_id as organizationId FROM users WHERE username = ?")
    .get(username) as { id: number; username: string; role: RoleName; organizationId: number } | undefined;
  if (!user) return next(new Error("User not found"));
  (req as AuthenticatedRequest).user = user;
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const perms = rolePermissions[user.role];
    if (perms.includes("*") || perms.includes(permission)) return next();
    return next(new Error(`Forbidden: missing permission ${permission}`));
  };
}

/** 满足任一权限即可（例如商品创建允许 stock:write 或 product:write） */
export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new Error("Unauthorized"));
    const perms = rolePermissions[user.role];
    if (perms.includes("*")) return next();
    if (permissions.some((p) => perms.includes(p))) return next();
    return next(new Error(`Forbidden: need one of ${permissions.join(", ")}`));
  };
}

/** 管理员专用；Forbidden 文案须以 `Forbidden` 开头以便 error-handler 映射为 HTTP 403。 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return next(new Error("Unauthorized"));
  if (user.role !== "admin") return next(new Error("Forbidden: admin only"));
  next();
}
