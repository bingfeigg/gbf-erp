#!/usr/bin/env npx tsx
/**
 * 离线签发许可证（使用私钥）。公钥部署在客户环境的 LICENSE_PUBLIC_KEY_FILE。
 *
 * 用法:
 *   LICENSE_PRIVATE_KEY_FILE=./license_private.pem npx tsx scripts/sign-license.ts \
 *     --expires 2028-12-31 --customer "客户名称"
 *
 *   # 可选绑定实例（安装后 data/deployment.id 或手动指定）:
 *   --deployment "550e8400-e29b-41d4-a716-446655440000"
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { stableStringify, type LicenseFile, type LicensePayload } from "../src/license";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function main() {
  const keyPath = process.env.LICENSE_PRIVATE_KEY_FILE?.trim();
  if (!keyPath) {
    console.error("请设置 LICENSE_PRIVATE_KEY_FILE 指向 Ed25519 私钥 PEM（可用 scripts/gen-license-keys.sh 生成）。");
    process.exit(1);
  }
  const expires = arg("--expires");
  const customer = arg("--customer") ?? "";
  const deployment = arg("--deployment") ?? "";
  const notes = arg("--notes") ?? "";

  if (!expires) {
    console.error("缺少 --expires YYYY-MM-DD");
    process.exit(1);
  }

  const expiresAt = new Date(`${expires}T23:59:59.999Z`).toISOString();
  if (!Number.isFinite(Date.parse(expiresAt))) {
    console.error("无效的 --expires");
    process.exit(1);
  }

  const issuedAt = new Date().toISOString();
  const payload: LicensePayload = {
    v: 1,
    issuedAt,
    expiresAt,
    customerId: customer || undefined,
    deploymentId: deployment || undefined,
    notes: notes || undefined
  };

  const privPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
  const privateKey = crypto.createPrivateKey(fs.readFileSync(privPath, "utf8"));
  const canonical = stableStringify(payload);
  const signature = crypto.sign(null, Buffer.from(canonical, "utf8"), privateKey);
  const file: LicenseFile = {
    payload,
    signature: signature.toString("base64")
  };

  process.stdout.write(`${JSON.stringify(file, null, 2)}\n`);
}

main();
