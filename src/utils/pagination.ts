import type { Request } from "express";

/** 内存分页后的列表形态（与既有 JSON 响应一致） */
export type PaginatedRows<T> = { rows: T[]; total: number; page: number; pageSize: number };

export type PaginateOptions = {
  /** 单页最大条数上限 */
  maxPageSize: number;
  /**
   * `true`：仅当请求带合法 `pageSize` 时才分页；否则返回完整数组（财务列表沿用此行为）。
   * `false`：与其它列表一致，缺省时仍按既有公式分页。
   */
  optIn?: boolean;
};

function readQuery(req: Pick<Request, "query">): Record<string, unknown> {
  return req.query as Record<string, unknown>;
}

/**
 * 对已在内存中的数组做分页，行为与路由中原 `maybePaginate` 保持一致。
 */
export function paginateInMemory<T>(req: Pick<Request, "query">, rows: T[], options: PaginateOptions): T[] | PaginatedRows<T> {
  const query = readQuery(req);
  const maxPageSize = options.maxPageSize;
  const optIn = options.optIn ?? false;

  if (optIn) {
    const rawPageSize = Number(query.pageSize);
    if (!Number.isFinite(rawPageSize) || rawPageSize <= 0) return rows;
    const pageSize = Math.max(1, Math.min(maxPageSize, rawPageSize));
    const page = Math.max(1, Number(query.page || 1));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
  }

  const pageSize = Math.max(1, Math.min(maxPageSize, Number(query.pageSize || 0)));
  const page = Math.max(1, Number(query.page || 1));
  if (!(pageSize > 0)) return rows;
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
}
