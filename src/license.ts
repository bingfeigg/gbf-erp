import crypto from "crypto";
import fs from "fs";
import path from "path";
import { readDeploymentId } from "./services/deployment-id";

/** 与签发脚本 `scripts/sign-license.ts` 使用同一套规范：payload 经稳定序列化后做 Ed25519 签名。 */
export interface LicensePayload {
  v: number;
  customerId?: string;
  deploymentId?: string;
  issuedAt: string;
  expiresAt: string;
  notes?: string;
}

export interface LicenseFile {
  payload: LicensePayload;
  /** base64(Ed25519 signature) */
  signature: string;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableStringify(x)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function resolveDataDir(): string {
  return path.resolve(process.cwd(), process.env.DATA_DIR ?? "data");
}

function getTrialFilePath(): string {
  return path.join(resolveDataDir(), "trial.json");
}

/** 无正式许可证时的试用天数，可由环境变量覆盖。 */
export function getTrialPeriodDays(): number {
  const raw = Number(process.env.LICENSE_TRIAL_DAYS ?? 7);
  if (!Number.isFinite(raw) || raw <= 0) return 7;
  return Math.min(Math.floor(raw), 3650);
}

function getTrialPeriodMs(): number {
  return getTrialPeriodDays() * 86_400_000;
}

interface TrialFile {
  startedAt: string;
}

/** 正式许可证生效后删除试用起点，避免重复占用试用期记录（可选）。 */
export function clearTrialFile(): void {
  try {
    fs.unlinkSync(getTrialFilePath());
  } catch {
    // ignore
  }
}

/**
 * 在已配置公钥但尚无有效许可证时，首次访问会写入 trial.json 并开始计时。
 * @returns 试用开始时刻（毫秒）
 */
export function ensureTrialStartedMs(): number {
  const p = getTrialFilePath();
  if (fs.existsSync(p)) {
    try {
      const raw = fs.readFileSync(p, "utf8");
      const j = JSON.parse(raw) as TrialFile;
      const t = new Date(j.startedAt).getTime();
      if (Number.isFinite(t)) return t;
    } catch {
      // 损坏则重新计时
    }
  }
  const now = Date.now();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify({ startedAt: new Date(now).toISOString() }, null, 2)}\n`, "utf8");
  return now;
}

/** 已配置公钥且磁盘上许可证文件通过校验时返回 payload，否则 null。 */
function getVerifiedLicensePayload(): LicensePayload | null {
  const file = readLicenseFileFromDisk();
  if (!file) return null;
  const v = verifyLicenseObject(file);
  return v.ok ? v.payload : null;
}

export function getLicenseFilePath(): string {
  if (process.env.LICENSE_FILE && String(process.env.LICENSE_FILE).trim()) {
    return path.resolve(process.cwd(), String(process.env.LICENSE_FILE).trim());
  }
  return path.join(resolveDataDir(), "license.json");
}

export function loadLicensePublicKey(): crypto.KeyObject | null {
  const keyFile = String(process.env.LICENSE_PUBLIC_KEY_FILE ?? "").trim();
  if (keyFile) {
    const p = path.isAbsolute(keyFile) ? keyFile : path.resolve(process.cwd(), keyFile);
    if (fs.existsSync(p)) {
      return crypto.createPublicKey(fs.readFileSync(p, "utf8"));
    }
  }
  const inline = String(process.env.LICENSE_PUBLIC_KEY ?? "").trim();
  if (inline) {
    return crypto.createPublicKey(inline.replace(/\\n/g, "\n"));
  }
  return null;
}

export function isLicenseEnforcementEnabled(): boolean {
  return loadLicensePublicKey() != null;
}

export function readLicenseFileFromDisk(): LicenseFile | null {
  const p = getLicenseFilePath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as LicenseFile;
  } catch {
    return null;
  }
}

export function verifyLicenseObject(file: LicenseFile): { ok: true; payload: LicensePayload } | { ok: false; reason: string } {
  const pub = loadLicensePublicKey();
  if (!pub) {
    return { ok: false, reason: "未配置许可证公钥（LICENSE_PUBLIC_KEY_FILE）" };
  }
  if (!file || !file.payload || typeof file.signature !== "string") {
    return { ok: false, reason: "许可证格式无效" };
  }
  const { payload } = file;
  if (payload.v !== 1) {
    return { ok: false, reason: "不支持的许可证版本" };
  }
  const canonical = stableStringify(payload);
  let sig: Buffer;
  try {
    sig = Buffer.from(file.signature, "base64");
  } catch {
    return { ok: false, reason: "许可证签名格式无效" };
  }
  const ok = crypto.verify(null, Buffer.from(canonical, "utf8"), pub, sig);
  if (!ok) {
    return { ok: false, reason: "许可证签名校验失败" };
  }

  const issuedMs = new Date(payload.issuedAt).getTime();
  const expiresMs = new Date(payload.expiresAt).getTime();
  if (!Number.isFinite(issuedMs)) {
    return { ok: false, reason: "issuedAt 无效" };
  }
  if (!Number.isFinite(expiresMs)) {
    return { ok: false, reason: "expiresAt 无效" };
  }
  if (Date.now() < issuedMs) {
    return { ok: false, reason: "许可证尚未生效" };
  }
  if (Date.now() > expiresMs) {
    return { ok: false, reason: "许可证已过期" };
  }
  const licDep = typeof payload.deploymentId === "string" ? payload.deploymentId.trim() : "";
  if (licDep) {
    const mid = readDeploymentId().trim();
    if (licDep !== mid) {
      return { ok: false, reason: "许可证已绑定其它实例（deploymentId 与本机 deployment.id 不一致）" };
    }
  }
  return { ok: true, payload };
}

export type LicenseStatusResponse =
  | {
      enforcement: false;
      valid: true;
      /** 本机实例 ID，提供给签发方写入许可证 payload.deploymentId 以实现单实例绑定 */
      installationId?: string;
      /** 未配置公钥时仍按 trial.json 展示试用倒计时（仅提示，不拦截接口） */
      trialUiActive?: boolean;
      trialUiDaysRemaining?: number | null;
      trialUiEndsAt?: string | null;
    }
  | {
      enforcement: true;
      valid: boolean;
      reason?: string;
      expiresAt?: string;
      issuedAt?: string;
      customerId?: string;
      deploymentId?: string;
      installationId?: string;
      daysRemaining: number | null;
      /** 尚无正式许可证，但在试用期内 */
      trialActive?: boolean;
      trialDaysRemaining?: number | null;
      trialEndsAt?: string | null;
    };

export function getLicenseStatus(): LicenseStatusResponse {
  const installationId = readDeploymentId();
  if (!isLicenseEnforcementEnabled()) {
    const startedAtMs = ensureTrialStartedMs();
    const trialMs = getTrialPeriodMs();
    const endsAtMs = startedAtMs + trialMs;
    const endsIso = new Date(endsAtMs).toISOString();
    const now = Date.now();
    if (now > endsAtMs) {
      return {
        enforcement: false,
        valid: true,
        installationId,
        trialUiActive: false,
        trialUiDaysRemaining: 0,
        trialUiEndsAt: endsIso
      };
    }
    const trialUiDaysRemaining = Math.max(1, Math.ceil((endsAtMs - now) / 86_400_000));
    return {
      enforcement: false,
      valid: true,
      installationId,
      trialUiActive: true,
      trialUiDaysRemaining,
      trialUiEndsAt: endsIso
    };
  }

  const payload = getVerifiedLicensePayload();
  if (payload) {
    const expMs = new Date(payload.expiresAt).getTime();
    const daysRemaining = Math.max(0, Math.floor((expMs - Date.now()) / 86_400_000));
    return {
      enforcement: true,
      valid: true,
      installationId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      customerId: payload.customerId,
      deploymentId: payload.deploymentId,
      daysRemaining,
      trialActive: false,
      trialDaysRemaining: null,
      trialEndsAt: null
    };
  }

  const startedAtMs = ensureTrialStartedMs();
  const trialMs = getTrialPeriodMs();
  const endsAtMs = startedAtMs + trialMs;
  const endsIso = new Date(endsAtMs).toISOString();
  const now = Date.now();

  if (now > endsAtMs) {
    const days = getTrialPeriodDays();
    return {
      enforcement: true,
      valid: false,
      installationId,
      reason: `试用期已结束（共 ${days} 天），请导入正式许可证`,
      daysRemaining: null,
      trialActive: false,
      trialDaysRemaining: 0,
      trialEndsAt: endsIso
    };
  }

  const trialDaysRemaining = Math.max(1, Math.ceil((endsAtMs - now) / 86_400_000));

  return {
    enforcement: true,
    valid: false,
    installationId,
    reason: `试用期内（剩余约 ${trialDaysRemaining} 天），请尽快导入正式许可证`,
    daysRemaining: null,
    trialActive: true,
    trialDaysRemaining,
    trialEndsAt: endsIso
  };
}

export function getLicenseGateOutcome():
  | { allow: true }
  | { allow: false; message: string; code: "LICENSE_INVALID" } {
  if (!isLicenseEnforcementEnabled()) {
    return { allow: true };
  }
  const st = getLicenseStatus();
  if (!st.enforcement) {
    return { allow: true };
  }
  if (st.valid) {
    return { allow: true };
  }
  if ("trialActive" in st && st.trialActive) {
    return { allow: true };
  }
  const reason = "reason" in st && st.reason ? st.reason : "许可证无效";
  return {
    allow: false,
    message: reason || "许可证无效或已过期",
    code: "LICENSE_INVALID"
  };
}

export function writeLicenseFile(file: LicenseFile): void {
  const v = verifyLicenseObject(file);
  if (!v.ok) {
    throw new Error(v.reason);
  }
  const target = getLicenseFilePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  clearTrialFile();
}
