import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export type VersionInfo = {
  version: string;
  commit: string;
  builtAt: string;
};

let cached: VersionInfo | null = null;

function safeReadPackageVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.trim() ? parsed.version.trim() : "0.0.0";
  } catch (_e) {
    return "0.0.0";
  }
}

function safeReadCommit(): string {
  const envSha =
    process.env.GIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.BUILD_COMMIT ||
    "";
  const envShort = String(envSha).trim().slice(0, 12);
  if (envShort) return envShort;

  try {
    const out = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 800
    })
      .toString("utf8")
      .trim();
    return out.slice(0, 12);
  } catch (_e) {
    return "";
  }
}

export function getVersionInfo(): VersionInfo {
  if (cached) return cached;
  cached = {
    version: safeReadPackageVersion(),
    commit: safeReadCommit(),
    builtAt: process.env.BUILD_TIME ? String(process.env.BUILD_TIME) : new Date().toISOString()
  };
  return cached;
}

