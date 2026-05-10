import test from "node:test";
import assert from "node:assert/strict";
import { paginateInMemory } from "./pagination";

test("财务 opt-in：未传 pageSize 时返回完整数组", () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const out = paginateInMemory({ query: {} }, rows, { maxPageSize: 200, optIn: true });
  assert.deepEqual(out, rows);
});

test("列表默认：按 pageSize 分页", () => {
  const rows = Array.from({ length: 10 }, (_, i) => i);
  const out = paginateInMemory({ query: { page: "2", pageSize: "3" } }, rows, { maxPageSize: 200 });
  assert.ok(out && typeof out === "object" && "rows" in out);
  const p = out as { rows: number[]; total: number; page: number; pageSize: number };
  assert.equal(p.total, 10);
  assert.equal(p.page, 2);
  assert.equal(p.pageSize, 3);
  assert.deepEqual(p.rows, [3, 4, 5]);
});
