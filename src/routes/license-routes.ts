import { Express } from "express";
import { z } from "zod";
import db from "../db";
import { auth, AuthenticatedRequest, requireAdmin } from "../middleware/auth";
import { getLicenseStatus, isLicenseEnforcementEnabled, writeLicenseFile, type LicenseFile } from "../license";
import { verifyPassword } from "../security";
import { writeAuditLog } from "../services/audit";
import { ensureLoginRateLimit, registerLoginAttempt } from "../services/auth-login-attempts";
import { RoleName } from "../types";

const installBodySchema = z.object({
  /** 完整许可证 JSON 字符串（与文件内容一致） */
  licenseJson: z.string().min(10)
});

const installBootstrapSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  licenseJson: z.string().min(10)
});

export function registerLicenseRoutes(app: Express): void {
  app.get("/api/license/status", (_req, res) => {
    res.json(getLicenseStatus());
  });

  /**
   * 首次部署：在登录前用管理员账号密码 + 许可证全文完成写入（需已配置公钥且当前许可证无效/缺失）。
   * 与登录共用限流，避免暴力尝试。
   */
  app.post("/api/license/install-bootstrap", (req, res, next) => {
    const parsed = installBootstrapSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    if (!isLicenseEnforcementEnabled()) {
      return res.status(400).json({ message: "当前未配置许可证公钥，无需通过此接口安装" });
    }
    const st = getLicenseStatus();
    if (st.enforcement && st.valid) {
      return res.status(400).json({ message: "许可证已有效，请直接登录；如需更换请登录后在许可证栏操作。" });
    }
    const { username, password, licenseJson } = parsed.data;
    try {
      ensureLoginRateLimit(username);
      const user = db
        .prepare("SELECT id, username, password, role, organization_id as organizationId FROM users WHERE username = ?")
        .get(username) as
        | { id: number; username: string; password: string; role: RoleName; organizationId: number }
        | undefined;

      if (!user || !verifyPassword(password, user.password)) {
        registerLoginAttempt(username, false);
        return next(new Error("Invalid credentials"));
      }
      if (user.role !== "admin") {
        registerLoginAttempt(username, false);
        return next(new Error("Forbidden: only admin can install license"));
      }
      registerLoginAttempt(username, true);

      let file: LicenseFile;
      try {
        file = JSON.parse(licenseJson) as LicenseFile;
      } catch {
        throw new Error("许可证 JSON 无法解析");
      }
      writeLicenseFile(file);
      const after = getLicenseStatus();
      writeAuditLog({
        action: "license.install",
        entityType: "organization",
        entityId: user.organizationId,
        detail: {
          expiresAt: after.enforcement && "expiresAt" in after ? after.expiresAt : undefined,
          bootstrap: true
        }
      });
      res.json({ ok: true, status: after });
    } catch (err) {
      next(err instanceof Error ? err : new Error(String(err)));
    }
  });

  app.post("/api/license/install", auth, requireAdmin, (req, res, next) => {
    const parsed = installBodySchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    try {
      let file: LicenseFile;
      try {
        file = JSON.parse(parsed.data.licenseJson) as LicenseFile;
      } catch {
        throw new Error("许可证 JSON 无法解析");
      }
      writeLicenseFile(file);
      const after = getLicenseStatus();
      const user = (req as AuthenticatedRequest).user;
      writeAuditLog({
        action: "license.install",
        entityType: "organization",
        entityId: user?.organizationId ?? 0,
        detail: {
          expiresAt: after.enforcement && "expiresAt" in after ? after.expiresAt : undefined
        }
      });
      res.json({ ok: true, status: after });
    } catch (err) {
      next(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
