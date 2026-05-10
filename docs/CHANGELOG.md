# 变更日志

> 按版本汇总变更要点。

## 未发布

- 文档：**新增 [`docs/license.md`](./license.md)**（离线许可证环境变量、签发/导入、`deployment.id`、数据文件与 Docker）；更新 [`README.md`](./README.md)、[`architecture.md`](./architecture.md)、[`regression-smoke.md`](./regression-smoke.md) 与仓库根 **[README](../README.md)** 索引。
- OpenAPI：补充 **`/api/license/status`**、**`POST /api/license/install`**、**`POST /api/license/install-bootstrap`** 及 schemas；描述许可证闸 **402** 与匿名 `/api/license/status` 的公网暴露注意。
- 许可证：**保存成功后**清除页面上的 JSON 文本框与已选文件，避免在控制台长期展示原文；**单实例绑定**：`DATA_DIR/deployment.id` 在首次初始化时生成 UUID，`GET /api/license/status` 返回 `installationId`；若许可证 `payload.deploymentId` 已填写则须与本机一致，否则校验失败（不填则不限实例）。
- 控制台「导航中心」新增 **工具 → 许可证**，主区打开 `panelLicense`；原侧栏折叠「许可证」已移除以避免入口隐蔽。
- 浏览器版许可证签发可视化工具：[`tools/license-maker/`](../tools/license-maker/)，本地运行 `npm run license:maker` 或 `bash tools/license-maker/serve.sh` 后访问 `http://127.0.0.1:5175`（私钥仅在本地参与签名）。
- **离线许可证**：配置 `LICENSE_PUBLIC_KEY_FILE`（或 `LICENSE_PUBLIC_KEY`）后对 Ed25519 签名许可证启用校验；默认许可证路径为 `DATA_DIR/license.json`。可选 **`LICENSE_PUBLIC_KEY_REQUIRED=1`**：未配置公钥时进程拒绝启动。登录页提供「许可证未就绪」粘贴区，接口 **`POST /api/license/install-bootstrap`**（管理员账号密码 + 许可证全文）可在首次登录前写入；登录后许可证仍无效时弹出全屏提示（管理员可继续粘贴）。签发密钥：`npm run license:keys` / `npm run license:sign`。未配置公钥时不启用校验（兼容开发）。
- **许可证试用期**：已配置公钥但尚无有效正式许可证时，自动写入 `DATA_DIR/trial.json` 并开始 **`LICENSE_TRIAL_DAYS`（默认 7 天）** 试用；试用期内接口放行，过期后需导入许可证。导入成功后清除 `trial.json`。控制台「切换账号」旁展示试用期或正式许可证剩余天数。
- **试用倒计时（未配置公钥）**：未设置 `LICENSE_PUBLIC_KEY_FILE` 时同样写入/读取 `trial.json`，在控制台「切换账号」旁显示试用剩余天数（仅提示，不拦截接口）；便于交付前尚未部署公钥的环境也能看到倒计时。
- 移除将项目根目录 `./erp.db` 复制到 `DATA_DIR` 的兼容逻辑；数据库仅以 **`DATA_DIR/erp.db`** 为准（见 [`src/db.ts`](../src/db.ts)）。

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
