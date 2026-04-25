import { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";

export function registerErrorHandler(app: Express): void {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation failed", issues: err.issues });
    }
    if (err instanceof Error) {
      if (err.message.startsWith("Forbidden")) {
        return res.status(403).json({ message: err.message });
      }
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ message: "Duplicate key conflict", detail: err.message });
      }
      if (
        err.message.includes("Missing auth token") ||
        err.message.includes("Invalid token") ||
        err.message.includes("Token expired") ||
        err.message.includes("Invalid refresh token") ||
        err.message.includes("Refresh session expired") ||
        err.message.includes("Too many login attempts") ||
        err.message.includes("Invalid credentials") ||
        err.message.includes("User not found") ||
        err.message.includes("Unauthorized")
      ) {
        const code =
          err.message.includes("Token expired") || err.message.includes("Refresh session expired")
            ? "TOKEN_EXPIRED"
            : err.message.includes("Invalid token: signature")
              ? "TOKEN_BAD_SIGNATURE"
              : err.message.includes("Invalid token:")
                ? "TOKEN_INVALID"
                : err.message.includes("Invalid credentials") || err.message.includes("User not found")
                  ? "AUTH_FAILED"
                  : undefined;
        return res.status(401).json(code ? { message: err.message, code } : { message: err.message });
      }
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Unknown error" });
  });
}
