import { Express, NextFunction, Request, Response } from "express";
import { getLicenseGateOutcome } from "../license";

function isLicenseGateExempt(req: Request): boolean {
  if (req.method === "OPTIONS") return true;
  const p = req.path;

  if (p === "/" || p === "/app" || p === "/babysit") return true;
  if (p === "/health") return true;
  if (p === "/api/version") return true;
  // 匿名可读：installationId / 试用等元数据会暴露给未登录客户端；公网部署请配合访问控制或限速（见 openapi 说明）。
  if (p === "/api/license/status") return true;
  if (p === "/api/license/install" && req.method === "POST") return true;
  if (p === "/api/license/install-bootstrap" && req.method === "POST") return true;

  if (p === "/api/auth/login" && req.method === "POST") return true;
  if (p === "/api/auth/refresh" && req.method === "POST") return true;
  if (p === "/api/auth/logout" && req.method === "POST") return true;
  if (p === "/api/auth/me" && req.method === "GET") return true;
  if (p === "/api/auth/permissions" && req.method === "GET") return true;

  return false;
}

/** 未配置公钥时不拦截；配置公钥后除豁免路径外均需有效许可证。 */
export function registerLicenseGate(app: Express): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isLicenseGateExempt(req)) return next();
    const outcome = getLicenseGateOutcome();
    if (outcome.allow) return next();
    return res.status(402).json({
      message: outcome.message,
      code: outcome.code
    });
  });
}
