import { Express } from "express";
import path from "path";
import { getVersionInfo } from "../version";

export function registerPublicRoutes(app: Express): void {
  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "gbf-erp-api",
      status: "running",
      statusText: "运行正常"
    });
  });

  app.get("/api/version", (_req, res) => {
    res.json(getVersionInfo());
  });

  app.get("/", (_req, res) => {
    res.redirect("/app");
  });

  app.get("/babysit", (_req, res) => {
    res.type("text/plain").send(
      [
        "This is the GBF ERP API service.",
        "",
        "If you meant Cursor PR babysit: that's an agent workflow, not an HTTP endpoint.",
        "Use /health to verify service, and /api/auth/login to get a token.",
        "",
        "Docs: see README.md in project root."
      ].join("\n")
    );
  });

  app.get("/app", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
  });
}
