import crypto from "crypto";
import fs from "fs";
import path from "path";

function dataDir(): string {
  return path.resolve(process.cwd(), process.env.DATA_DIR ?? "data");
}

export function getDeploymentIdFilePath(): string {
  return path.join(dataDir(), "deployment.id");
}

/**
 * 本机实例唯一 ID（UUID），首次启动时写入 `DATA_DIR/deployment.id`。
 * 签发许可证时在 payload.deploymentId 填入该值，即可将许可证绑定到本实例。
 */
export function ensureDeploymentId(): string {
  const p = getDeploymentIdFilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p)) {
    const id = fs.readFileSync(p, "utf8").trim();
    if (id) return id;
  }
  const id = crypto.randomUUID();
  fs.writeFileSync(p, `${id}\n`, "utf8");
  return id;
}

export function readDeploymentId(): string {
  return ensureDeploymentId();
}
