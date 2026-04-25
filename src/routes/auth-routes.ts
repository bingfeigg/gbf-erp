import { Express } from "express";
import db from "../db";
import { RoleName } from "../types";
import { randomTokenId, signToken, verifyPassword, verifyToken } from "../security";
import { auth, AuthenticatedRequest, getPermissionsByRole } from "../middleware/auth";
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from "../constants";
import { loginSchema, refreshTokenBodySchema } from "../schemas/api";
import { writeAuditLog } from "../services/audit";
import { ensureLoginRateLimit, registerLoginAttempt } from "../services/auth-login-attempts";

export function registerAuthRoutes(app: Express): void {
  const resolveDevOpsEnabled = (username: string) => {
    const allowRaw = String(process.env.DEV_OPS_USERS ?? "").trim();
    if (!allowRaw) return false;
    const allowSet = new Set(
      allowRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    return allowSet.has(String(username).trim().toLowerCase());
  };

  app.post("/api/auth/login", (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const { username, password } = parsed.data;
    try {
      ensureLoginRateLimit(username);
      const user = db
        .prepare("SELECT id, username, password, role, organization_id as organizationId FROM users WHERE username = ?")
        .get(username) as { id: number; username: string; password: string; role: RoleName; organizationId: number } | undefined;

      if (!user || !verifyPassword(password, user.password)) {
        registerLoginAttempt(username, false);
        return next(new Error("Invalid credentials"));
      }
      registerLoginAttempt(username, true);

      const accessTokenId = randomTokenId();
      const refreshTokenId = randomTokenId();
      const token = signToken(
        { sub: user.id, username: user.username, role: user.role, typ: "access", jti: accessTokenId },
        ACCESS_TTL_SECONDS
      );
      const refreshToken = signToken(
        { sub: user.id, username: user.username, role: user.role, typ: "refresh", jti: refreshTokenId },
        REFRESH_TTL_SECONDS
      );
      db.prepare("INSERT INTO auth_refresh_sessions (user_id, token_id, expires_at, revoked) VALUES (?, ?, ?, 0)")
        .run(user.id, refreshTokenId, Date.now() + REFRESH_TTL_SECONDS * 1000);
      writeAuditLog({
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
        detail: { role: user.role }
      });

      res.json({
        token,
        refreshToken,
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/auth/me", auth, (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json({ user, permissions: getPermissionsByRole(user.role) });
  });

  app.get("/api/auth/permissions", auth, (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json({
      role: user.role,
      permissions: getPermissionsByRole(user.role),
      devOpsEnabled: resolveDevOpsEnabled(user.username)
    });
  });

  app.post("/api/auth/refresh", (req, res, next) => {
    const parsed = refreshTokenBodySchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    try {
      const payload = verifyToken(parsed.data.refreshToken);
      if (payload.typ !== "refresh") throw new Error("Invalid refresh token");
      const session = db
        .prepare(
          "SELECT id, user_id as userId, token_id as tokenId, expires_at as expiresAt, revoked FROM auth_refresh_sessions WHERE token_id = ?"
        )
        .get(payload.jti) as { id: number; userId: number; tokenId: string; expiresAt: number; revoked: number } | undefined;
      if (!session || session.revoked || session.expiresAt < Date.now()) {
        throw new Error("Refresh session expired");
      }
      const user = db
        .prepare("SELECT id, username, role, organization_id as organizationId FROM users WHERE id = ?")
        .get(session.userId) as { id: number; username: string; role: RoleName; organizationId: number } | undefined;
      if (!user) throw new Error("User not found");
      const accessToken = signToken(
        { sub: user.id, username: user.username, role: user.role, typ: "access", jti: randomTokenId() },
        ACCESS_TTL_SECONDS
      );
      res.json({ token: accessToken });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    const parsed = refreshTokenBodySchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    try {
      const payload = verifyToken(parsed.data.refreshToken);
      if (payload.typ !== "refresh") throw new Error("Invalid refresh token");
      db.prepare("UPDATE auth_refresh_sessions SET revoked = 1 WHERE token_id = ?").run(payload.jti);
      writeAuditLog({
        action: "auth.logout",
        entityType: "user",
        entityId: payload.sub
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
}
