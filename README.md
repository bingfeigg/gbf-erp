# GBF ERP（通用贸易 MVP 后端）

[![CI](https://github.com/bingfeigg/gbf-erp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/bingfeigg/gbf-erp/actions/workflows/ci.yml)

可运行的贸易类 ERP 后端：JWT 认证、主数据、带审批的采购/销售、库存、应收/应付、收款/付款、日记账与报表等。

## 环境要求

- **Node.js 20+**（以 `package.json`、`.nvmrc` 为准）。使用 nvm：`nvm install && nvm use`。
- **better-sqlite3**：若更换 Node 大版本，请执行 `npm run rebuild:native`（或删除 `node_modules` 后重新 `npm install`）。
- **数据**：SQLite 文件始终为 `DATA_DIR` 目录下的 `erp.db`；未设置时 `DATA_DIR` 默认为 `data`（即项目根下 `./data/erp.db`）。

## 快速开始

```bash
npm install
npm run migrate
npm run dev
```

- API 基址：`http://localhost:3100`
- 健康检查：`curl http://localhost:3100/health`
- 简易 Web 界面：浏览器打开 `http://localhost:3100/app`

开发环境默认账号（由迁移/种子数据写入）：

- `admin` / `admin`：管理账号（可创建/查看其他角色用户，走正式业务界面）
- `root` / `root`：开发测试账号（若在 `DEV_OPS_USERS` 白名单中，可见测试操作区）

## Web 控制台（`/app`）

- 浏览器打开 `http://localhost:3100/app`（与 `PORT` 一致即可）。
- **商品**：「商品库存」页可筛选、导出 CSV；**「新增商品」** 需 `stock:write` 或 `product:write`（见下节权限）。亦可调用 `POST /api/products`。
- **采购 / 销售**：左侧「②」「③」默认只建 **草稿**；可勾选 **「创建后自动提交」**（仍不会自动审批），便于直接进入「待我审批」。
- **审批工作台**：「加载采购单 / 销售单 / 待我审批」；点表格行会拉取 **`GET /api/purchase-orders/:id` 或 `GET /api/sales-orders/:id`**，在右侧以表头 + 明细行展示；**「复制详情 curl」** 生成带当前登录 Token 的查询命令（仅本机演示用，勿泄露）。
- **销售单来源**：与采购单独立，由「③」或 `POST /api/sales-orders` 创建，**不会**从采购单自动生成。

## 本地验证（无需 Docker）

`npm run verify` 会依次执行：

1. **`npm run openapi:validate`** — 校验 `openapi/openapi.yaml`（OpenAPI 3.0.3）。  
2. **`npm run test`** — `node:test` 单测；脚本会收集 `src` 下全部 `*.test.ts`（当前含 `order-helpers` 状态机与权限串）。  
3. **`npm run build` / `npm run migrate`** — 编译与数据库迁移。  
4. 在临时端口启动 `dist`，再跑 **smoke** 与 **e2e**（HTTP 脚本）。

```bash
npm run verify
```

单独执行：

```bash
npm run openapi:validate
npm run test
```

若服务已在本机运行（不传参时脚本里默认常指向 `http://localhost:4000`）：

```bash
npm run smoke -- http://127.0.0.1:3100
npm run e2e  -- http://127.0.0.1:3100
```

### OpenAPI 说明

- 规范路径：**`openapi/openapi.yaml`**（与 `src/routes` **人工对齐**的精简版，非穷举所有响应字段）。  
- 浏览：将文件内容粘贴到 [Swagger Editor](https://editor.swagger.io/)，或使用本机 OpenAPI 插件预览。  
- 修改接口时请同步更新 YAML，避免 `openapi:validate` 与协作方歧义。

### 单测说明

- 单测**不**连接真实 HTTP 或 SQLite；与 **smoke / e2e** 互补。  
- 新增文件：在 `src` 任意目录加 `*.test.ts` 即可被 `npm run test` 收集；**已排除于** `tsc` 编译产物（见 `tsconfig.json` 的 `exclude`）。

**GitHub：**`.github/` 下 CI 会跑 `npm audit`（仅 high+）、`npm run verify`、对 `src/` 的 CodeQL、以及 Dependabot。仅修改 `*.md`、`LICENSE` 或 `docs/**` 的推送/PR 会跳过 CI 与 CodeQL。

## Docker

```bash
docker compose up --build
```

浏览器访问 `http://localhost:3100/health` 与 `http://localhost:3100/app`。端口、环境变量与健康检查见 `docker-compose.yml`。（需本机可访问 Docker 守护进程。）

### 生产部署检查清单

1. **密钥**：`JWT_SECRET` 使用随机强串（≥32 字符），勿使用仓库示例值。  
2. **校验**：`npm run validate:env -- /path/to/.env`  
3. **端口**：宿主机 `3100` 未被占用，或改 `docker-compose.yml` 映射 / 环境变量 `PORT`。  
4. **数据**：`./data` 映射卷持久化；首次启动镜像内会执行迁移。  
5. **验收**：`docker compose config -q` 校验编排文件；`npm run docker:test` 会拉起容器并跑 `smoke` + `e2e`（**需本机 Docker 守护进程权限**）。若无 Docker，以 `npm run verify` 或 CI 为准。手动可 `curl` `/health`。  
6. **长期运行**：生产树可用 `scripts/install-systemd.sh`、`scripts/deploy.sh`（见上文「运维」）。

## 配置

- 参考模板：`.env.example`；生产环境在 `NODE_ENV=production` 时需提供足够强度的 `JWT_SECRET`（建议 ≥ 32 字符）。
- 校验： `npm run validate:env -- .env`

## 数据库

```bash
npm run migrate
```

拉取代码后若 `src/migrate` / `src/db` 有结构变更，请执行迁移以保持一致。

## 运维

### 备份与恢复（下述路径为示例）

**项目目录下：**

```bash
bash scripts/backup.sh ./data ./backups
bash scripts/restore.sh ./backups/<file>.tar.gz ./data
```

**生产部署目录（例如 `/opt/gbf-erp`）：**

```bash
sudo bash scripts/install-systemd.sh /opt/gbf-erp
bash scripts/deploy.sh /opt/gbf-erp gbf-erp.service /opt/gbf-erp/.env
bash scripts/setup-cron-backup.sh /opt/gbf-erp "0 2 * * *"
```

可选：报表或灾备相关路径一并备份/恢复时：

```bash
bash scripts/backup.sh /opt/gbf-erp/data /opt/gbf-erp/backups /opt/gbf-erp/dr-reports
bash scripts/restore.sh /opt/gbf-erp/backups/erp-YYYYmmdd-HHMMSS.tar.gz /opt/gbf-erp/data /opt/gbf-erp/dr-reports
```

**灾备演练**（验证：备份 → 恢复 → 接口探活等）：

```bash
npm run dr:drill -- "http://localhost:4000" ./data ./backups
npm run dr:drill -- "http://localhost:3100" /opt/gbf-erp/data /opt/gbf-erp/backups gbf-erp.service
```

**从备份包回滚：**

```bash
npm run rollback -- /opt/gbf-erp /opt/gbf-erp/backups/erp-YYYYmmdd-HHMMSS.tar.gz gbf-erp.service
```

其他资产：`env.example`、`deploy/gbf-erp.service`、`deploy/logrotate-gbf-erp`。

## API 示例（curl）

将下文中 `http://localhost:3100` 改为你实际 `PORT`。需鉴权的请求加请求头 `Authorization: Bearer <token>`。登录响应中含 `refreshToken`，可用于 `POST /api/auth/refresh`；`POST /api/auth/logout` 请求体中携带该 refresh 可撤销会话。

### 1）登录与 access token

```bash
TOKEN=$(curl -s -X POST http://localhost:3100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
```

刷新 access token（可选）：

```bash
REFRESH_TOKEN="<从登录 JSON 中复制>"
curl -X POST http://localhost:3100/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

### 2）主数据

```bash
curl -X POST http://localhost:3100/api/suppliers \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"SUP001","name":"Default Supplier"}'
curl -X POST http://localhost:3100/api/customers \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"CUS001","name":"Default Customer"}'
curl -X POST http://localhost:3100/api/products \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"sku":"SKU001","name":"Demo Product","unit":"pcs","costPrice":10,"salePrice":15}'
```

（`POST /api/products` 需 **`stock:write` 或 `product:write`**。）

### 3）与 4）采购单、销售单（先建草稿，后续通过 `POST .../action` 走审批/状态机）

```bash
curl -X POST http://localhost:3100/api/purchase-orders \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"orderNo":"PO2026001","supplierId":1,"items":[{"productId":1,"qty":100,"price":10}]}'
curl -X POST http://localhost:3100/api/sales-orders \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"orderNo":"SO2026001","customerId":1,"items":[{"productId":1,"qty":20,"price":15}]}'
```

### 4.5）采购单、销售单详情（表头 + 明细行，含往来单位名称）

将 `1` 换成实际单据 `id`（与列表或创建响应中一致）。

```bash
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/purchase-orders/1
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/sales-orders/1
```

响应为 JSON：`{ "order": { ... }, "items": [ { "sku", "productName", "qty", "price", "amount" } ] }`。需 `purchase:read` / `sales:read`。

### 5）库存相关查询

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/products
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/stock/ledger
```

### 6）应收/应付、收款/付款

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/ar/invoices
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/ap/bills
curl -X POST http://localhost:3100/api/finance/receipts \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"receiptNo":"RC2026001","customerId":1,"arInvoiceId":1,"amount":100}'
curl -X POST http://localhost:3100/api/finance/payments \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"paymentNo":"PY2026001","supplierId":1,"apBillId":1,"amount":200}'
```

### 7）科目与日记账

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/accounts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/journals
```

### 8）财务报表

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/trial-balance
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/ar-aging
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/ap-aging
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/inventory-valuation
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/kpi-summary
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3100/api/finance/reports/trend?days=14"
```

### 9）冲销（reverse）

若无关联的应收/应付已核销则允许；存在结算记录时通常返回 `400`：

```bash
curl -X POST http://localhost:3100/api/purchase-orders/1/action \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"action":"reverse","comment":"ops"}'
curl -X POST http://localhost:3100/api/sales-orders/1/action \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"action":"reverse","comment":"ops"}'
```

### 10）Webhooks

```bash
curl -X POST http://localhost:3100/api/config/webhooks \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://example.com/hook","eventType":"approval.overdue","secret":"my-webhook-secret","enabled":true}'
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/config/webhooks
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/config/webhooks/1
```

外发推送请求头含 `x-webhook-event`；若配置了 `secret`，签名头 `x-webhook-signature` 为对**原始 body** 做 `HMAC_SHA256(secret, raw_body)` 后的**十六进制**字符串。

## 角色与权限速查

权限串在 `src/middleware/auth.ts` 的 `rolePermissions` 中维护；接口通过 `requirePermission` / `requireAnyPermission` 校验。下表为**摘要**（细节以代码为准）。

| 角色 | 摘要 |
|------|------|
| **admin** | `*`（全部接口与配置） |
| **sales** | 销售单读写/提交，客户读写，**商品读 + `product:write`**（可维护 SKU） |
| **purchase** | 采购单读写/提交，供应商读写，**商品读 + `product:write`** |
| **warehouse** | 库存读/写，**商品读 + `product:write`**（库存与主数据维护） |
| **finance** | `sales:read`、`purchase:read`、`stock:read`，**`purchase:approve` + `sales:approve`**；**无** `product:read`、无采购/销售单创建类写权限（以 `auth.ts` 为准） |

Web 控制台中部分按钮会按权限禁用（灰色）。**审批通过/驳回/作废/冲销** 等需对应 `purchase:approve` 或 `sales:approve`（财务角色具备）。

## 功能与接口速查

| 领域 | 说明 |
|------|------|
| **审批** | 状态机：draft → submitted → approved / rejected / void；在 **通过审批** 时记库存、应收/应付等；`GET /api/approvals/pending`、`/overdue`、`/sla-dashboard`；时间线 `GET /api/approvals/purchase/{id}/timeline` 或 `GET /api/approvals/sales/{id}/timeline` |
| **规则与预警** | `GET/POST /api/config/approval-rules`，`GET/POST /api/config/alert-rules` |
| **幂等** | 在支持写操作的接口上可带请求头 `x-idempotency-key` |
| **审计** | `GET /api/audit-logs`（需具备权限的角色）；关键创建/确认行为会记日志 |
| **通知** | `GET /api/notifications/recent?sinceId=0` |
| **账务** | 销售单审批通过时按设计生成收入、销货成本、库存等分录 |
| **商品主数据** | `GET /api/products`（`product:read`）；`POST /api/products`（**`stock:write` 或 `product:write`**）；销售/采购/仓储角色含 `product:write` 时可在控制台维护 SKU |
| **单据详情** | `GET /api/purchase-orders/:id`（`purchase:read`）、`GET /api/sales-orders/:id`（`sales:read`）：表头 + 按行商品 |
| **脚本** | `scripts/`：`backup.sh`、`restore.sh`、`install-systemd.sh`、`deploy.sh`、`setup-cron-backup.sh`、`validate-env.sh`、`dr-drill.sh`、`rollback.sh`、`smoke.sh`、`e2e.sh`、`verify-local.sh` 等 |

## 常见问题

| 现象 | 处理 |
|--------|------------|
| `ERR_DLOPEN` / `better_sqlite3` / `MODULE_VERSION` 不匹配 | 使用 **Node 20+**，再执行 `npm run rebuild:native` 或重装 `node_modules`。 |
| 安装时报 `EBADENGINE` | 与 `package.json` 的 `engines` 对齐（Node ≥ 20）。 |
| `Cannot reverse … settlement` 等 | 与应收/应付结算冲突时需先处理相关收款/付款；按设计会阻止冲销。 |
| 幂等返回 409 或体不一致 | 同一 `x-idempotency-key` 仅在与**完全相同的** JSON 体复用时才视为同一请求。 |
| Webhook 一直 `retry` / `failed` | 检查 URL 可达、TLS 证书；若启用 `secret` 再校验收端 HMAC 是否与约定一致。 |
| `npm run docker:test` 立即退出并提示无法连接 Docker | 将用户加入 `docker` 组或使用 `sudo`；不影响 `npm run verify`（不依赖 Docker）。 |

## 后续可迭代（参考）

以下为产品/技术方向备忘；**OpenAPI 手写规范**与 **`order-helpers` 的 `node:test`** 已落地，其余仍属规划：

- **OpenAPI 深度集成**：从 Zod / 路由自动**生成或校验** YAML，减少与实现漂移。
- **更多单测**：扩展 `src/services/*`、或对纯函数模块增加用例；可选引入 Vitest 做覆盖率。
- **限流与审计增强**：登录/写接口按 IP 或用户限流；敏感配置变更双人复核等。
- **多组织与数据隔离**：前端显式切换 `organization_id`（后端部分表已带该字段）。
- **消息队列化 Webhook**：投递与重试与 HTTP 主线程解耦。

有明确优先级时可择项开 issue/分支实现。
