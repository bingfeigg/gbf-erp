import fs from "fs";
const t1 = fs.readFileSync("/tmp/ddl1.txt", "utf8");
const t2 = fs.readFileSync("/tmp/ddl2.txt", "utf8");
const hdr =
  "/** 首次启动时的建表与索引 DDL（由 initDb 执行；演进仍用 ensureColumn / rebuild*）。 */\n";
const body =
  hdr +
  "export const ERP_INITIAL_TABLES_DDL = `\n" +
  t1 +
  "`;\n\nexport const ERP_INDEX_DDL = `\n" +
  t2 +
  "`;\n";
fs.writeFileSync(new URL("../src/db/initial-ddl.ts", import.meta.url), body);
