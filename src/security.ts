import crypto from "crypto";
import { RoleName } from "./types";

const HASH_ITERATIONS = 120000;
const HASH_KEY_LEN = 32;
const HASH_DIGEST = "sha256";
const JWT_ALG = "HS256";
const JWT_SECRET = process.env.JWT_SECRET ?? "change-this-in-production";

interface TokenPayload {
  sub: number;
  username: string;
  role: RoleName;
  typ: "access" | "refresh";
  jti: string;
  iat: number;
  exp: number;
}

function toBase64Url(input: Buffer | string): string {
  const source = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input).toString("base64");
  return source.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return Buffer.from(padded, "base64");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LEN, HASH_DIGEST).toString("hex");
  return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function isHashedPassword(password: string): boolean {
  return password.startsWith("pbkdf2$");
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!isHashedPassword(stored)) {
    const a = Buffer.from(password, "utf8");
    const b = Buffer.from(stored, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  const [algo, rawIterations, salt, targetHash] = stored.split("$");
  if (algo !== "pbkdf2" || !rawIterations || !salt || !targetHash) {
    return false;
  }
  const iterations = Number(rawIterations);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }
  const digest = crypto.pbkdf2Sync(password, salt, iterations, HASH_KEY_LEN, HASH_DIGEST).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(targetHash, "hex"));
}

export function randomTokenId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function signToken(input: Omit<TokenPayload, "exp" | "iat">, ttlSeconds = 8 * 60 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: JWT_ALG, typ: "JWT" };
  const payload: TokenPayload = {
    ...input,
    iat: now,
    exp: now + ttlSeconds
  };

  const headerPart = toBase64Url(JSON.stringify(header));
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const data = `${headerPart}.${payloadPart}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(data).digest();
  return `${data}.${toBase64Url(signature)}`;
}

export function verifyToken(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token: expected header.payload.signature");
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const data = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(data).digest();
  let providedSignature: Buffer;
  try {
    providedSignature = fromBase64Url(signaturePart);
  } catch {
    throw new Error("Invalid token: signature is not valid base64");
  }
  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new Error("Invalid token: signature mismatch");
  }

  let payloadJson: string;
  try {
    payloadJson = fromBase64Url(payloadPart).toString("utf8");
  } catch {
    throw new Error("Invalid token: payload is not valid base64");
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(payloadJson) as TokenPayload;
  } catch {
    throw new Error("Invalid token: payload is not valid JSON");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || !Number.isFinite(payload.exp)) {
    throw new Error("Invalid token: missing or invalid exp");
  }
  if (payload.exp < now) {
    throw new Error("Token expired");
  }
  if (!payload.typ || !payload.jti) {
    throw new Error("Invalid token: missing typ or jti");
  }
  return payload;
}
