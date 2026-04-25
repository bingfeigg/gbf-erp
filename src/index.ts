import express from "express";
import cors from "cors";
import path from "path";
import { initDb } from "./db";
import { APPROVAL_SCAN_INTERVAL_MS, WEBHOOK_DELIVERY_INTERVAL_MS } from "./constants";
import { registerAppRoutes } from "./routes/register-app";
import { registerErrorHandler } from "./middleware/error-handler";
import { scanOverdueApprovals, processWebhookDeliveries } from "./services/alert-webhook-runtime";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/app", express.static(path.join(process.cwd(), "public"), { index: false, redirect: false }));

initDb();

function validateRuntimeConfig() {
  const portRaw = process.env.PORT ?? "3100";
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${portRaw}`);
  }
  const secret = process.env.JWT_SECRET ?? "";
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === "change-this-in-production" || secret.length < 32) {
      throw new Error(
        "Invalid JWT_SECRET for production: set env JWT_SECRET to a random string of at least 32 characters " +
          "(e.g. run `openssl rand -hex 32` and export the result). See .env.example in the project root."
      );
    }
  }
}

validateRuntimeConfig();

registerAppRoutes(app);
registerErrorHandler(app);

const port = Number(process.env.PORT ?? 3100);
const server = app.listen(port, () => {
  console.log(`GBF ERP API running at http://localhost:${port}`);
  setInterval(() => {
    try {
      scanOverdueApprovals();
    } catch (_e) {
      // keep scanner best-effort, never crash API process
    }
  }, APPROVAL_SCAN_INTERVAL_MS);
  setInterval(() => {
    processWebhookDeliveries().catch(() => {
      // keep delivery worker best-effort, never crash API process
    });
  }, WEBHOOK_DELIVERY_INTERVAL_MS);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[gbf-erp] 端口 ${port} 已被占用。请先结束占用进程，例如: bash scripts/free-port.sh ${port}\n` +
        `（常用: npm run free:3100 或 npm run free:4000）\n` +
        `也可换端口: PORT=3101 JWT_SECRET="..." NODE_ENV=production npm run start`
    );
  } else {
    console.error("[gbf-erp] 服务监听失败:", err);
  }
  process.exit(1);
});
