import db from "../db";
import { LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS } from "../constants";

export function registerLoginAttempt(username: string, ok: boolean) {
  db.prepare("INSERT INTO auth_login_attempts (username, attempted_at, ok) VALUES (?, ?, ?)")
    .run(username.toLowerCase(), Date.now(), ok ? 1 : 0);
}

export function ensureLoginRateLimit(username: string) {
  const since = Date.now() - LOGIN_RATE_WINDOW_MS;
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM auth_login_attempts WHERE username = ? AND attempted_at >= ? AND ok = 0")
    .get(username.toLowerCase(), since) as { cnt: number };
  if (row.cnt >= LOGIN_RATE_LIMIT) {
    throw new Error("Too many login attempts, please retry later");
  }
}
