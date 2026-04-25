/** 访问令牌 TTL（秒） */
export const ACCESS_TTL_SECONDS = 8 * 60 * 60;
/** 刷新令牌 TTL（秒） */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
export const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000;
export const LOGIN_RATE_LIMIT = 8;
export const APPROVAL_OVERDUE_HOURS = Number(process.env.APPROVAL_OVERDUE_HOURS ?? 24);
export const APPROVAL_SCAN_INTERVAL_MS = Number(process.env.APPROVAL_SCAN_INTERVAL_MS ?? 5 * 60 * 1000);
export const WEBHOOK_DELIVERY_INTERVAL_MS = Number(process.env.WEBHOOK_DELIVERY_INTERVAL_MS ?? 15 * 1000);
