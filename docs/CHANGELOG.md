# 变更日志

> 按版本汇总变更要点。

## 未发布

（暂无）

## 0.2.3 - 2026-05-11

- **E2E**：`scripts/e2e.sh`「采购冲销在结算后应失败」在付款前补 **`POST /api/purchase-orders/:id/receipts` 全额收货**，与「未收满货禁止付款」一致，并断言付款 **201**，修复 `npm run verify` 误报。
- **工具链**：`npm run test` / `openapi:validate` 使用 **`./node_modules/.bin/tsx`** 与 **`./node_modules/.bin/swagger-cli`**，避免 `npx --no-install`/`find -exec` 与 PATH 问题导致单测或 OpenAPI 校验失败。
- **版本**：`package.json`、`openapi.yaml` **`0.2.3`**。
- OpenAPI：**`/api/license/*`**、`402` / 匿名 `status` 说明； **`info.version`** 与发布同步。
- **离线许可证**（Ed25519）：`LICENSE_PUBLIC_KEY_FILE` / `LICENSE_TRIAL_DAYS` / `LICENSE_PUBLIC_KEY_REQUIRED`；`GET /api/license/status`、`install`、**`install-bootstrap`**；全局 **402** 门控（`src/middleware/license-gate.ts`）；**单实例**：`DATA_DIR/deployment.id` ↔ payload `deploymentId`；控制台 **工具 → 许可证**、`license-panel.js`、粘贴后清空、**402** → `gbf-license-blocked`。
- **`tools/license-maker/`**、`npm run license:keys|sign|maker`；**Dockerfile** 多阶段运行镜像不含 `src/`。
- 商品创建：SKU/名称「已有商品」建议、提交前防重名、表单 **`autocomplete="off"`**。
- 文档：[**`docs/license.md`**](./license.md) 与 **`architecture.md` / `regression-smoke.md` / 根 README** 索引更新。
- 移除将 `./erp.db` 从项目根迁入 `DATA_DIR` 的旧兼容；库文件仅以 **`DATA_DIR/erp.db`** 为准。

## 0.2.2 - 2026-05-10

- 履约（采购收货、销售发货、采购/销售退货）的事务与库存分录迁至 [`src/services/fulfillment.ts`](../src/services/fulfillment.ts)，[`fulfillment-routes.ts`](../src/routes/fulfillment-routes.ts) 仅编排校验、幂等与审计。
- 控制台「单据创建 + 收付款 + 应收应付下拉与预览」迁至 [`public/app/doc-settlement.js`](../public/app/doc-settlement.js)；`index.html` 中置于 `order-execution.js` 与 `approval-workspace.js` 之间。
- 控制台进一步拆分：`detail-views.js`、`order-execution.js`、`approval-workspace.js`，并与既有 `api-client.js`、`finance-tables.js`、`reminders.js` 等协作；`architecture.md` 补充高内聚、低耦合拆分说明。
- 首次建表与索引 SQL 抽至 [`src/db/initial-ddl.ts`](../src/db/initial-ddl.ts)；采购/销售订单列表查询与筛选迁至 [`src/services/order-list-queries.ts`](../src/services/order-list-queries.ts)。
- 非生产环境 **`ALLOW_DEV_HEADER_AUTH`** 控制是否允许 `x-username` 模拟登录（Bearer 仍优先）；`.env.example` 已说明。
- 控制台 `api-client.js`：`POST /api/auth/login` 返回 401 时不再误判为「会话过期」；错误响应非 JSON 时降级展示，避免整段 `api` 失败。
- 修复 `public/app.js` 误入审批 curl 片段导致脚本解析失败、登录按钮无绑定；登录表单增加「登录中…」提示，登录按钮使用 `type="button"`。
- 修复 `public/app/detail-views.js` 中 `renderJournalDetailHtml` 未闭合导致的脚本语法错误。

## 0.2.0 - 2026-04-24

- 核心 ERP 读写接口支持多组织数据隔离。
- 新增可配置的审批规则与预警规则相关 API。
- 审批动作及收款/付款等操作支持通过请求头 `x-idempotency-key` 做幂等保护。
- 新增趋势报表接口与通知轮询接口。
- 控制台新增趋势页签与顶部实时通知条。
- 新增端到端回归脚本与 GitHub Actions CI 工作流。
- Docker 与 Compose 增加健康检查，Compose 限制 CPU/内存。
- 新增数据库迁移入口命令（`npm run migrate`）。
- 新增 SQLite 数据文件的备份/恢复脚本。
- 新增生产部署相关资产：
  - systemd 单元（`deploy/gbf-erp.service`）
  - logrotate 策略（`deploy/logrotate-gbf-erp`）
  - `scripts/` 下的安装、部署与 cron 脚本
- 新增运行时加固相关资产：
  - 环境变量模板（`.env.example`）
  - API 启动阶段的配置校验
  - 环境校验脚本（`scripts/validate-env.sh`）
  - 灾备演练脚本（`scripts/dr-drill.sh`）
  - 基于备份的回滚脚本（`scripts/rollback.sh`）
- 完成 ERP 生产收尾范围：
  - 审批冲销流程（`action=reverse`）及与结算冲突的防护
  - 结算分录明细账（`ar_receipt_lines`、`ap_payment_lines`）
  - Webhook 配置、队列投递与重试 Worker
  - 商品/应收/应付/审批/日记账统一的右侧详情抽屉
  - 冒烟与 E2E 覆盖冲销成功/失败等防护路径
