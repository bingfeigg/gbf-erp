# 代码架构说明

本文描述仓库「服务端」主体目录职责与请求链路，便于阅读代码或扩展接口。前端静态资源位于仓库根目录 [`public/`](../public/)，契约文档位于 [`openapi/`](../openapi/)。

### 控制台脚本（`public/`）

| 文件 | 作用 |
|------|------|
| [`public/index.html`](../public/index.html) | 页面结构与样式；底部按顺序引用脚本。注意 Express 将 `public` 挂在 **`/app`**，故 `public/app/foo.js` 的 URL 为 **`/app/app/foo.js`**（勿写成 `/app/foo.js`，否则会 404）。 |
| [`public/app/state-dom.js`](../public/app/state-dom.js) | 全局 `state`、缓存、`document` 引用、`panels`、版本行首屏请求、`log`、会话持久化、`showAction*` 等。 |
| [`public/app/format.js`](../public/app/format.js) | 日期短格式、金额两位小数、`escapeHtml` 等纯展示函数。 |
| [`public/app/table.js`](../public/app/table.js) | `renderTable`、`textMatch` / `textMatchEx`（依赖 `format`）。 |
| [`public/app/i18n-zh.js`](../public/app/i18n-zh.js) | 状态/角色等中文映射、`pickZh`、审批单元格与驳回摘要；应收/应付阶段键与 `stageBadgeHtml` 等。 |
| [`public/app/detail-views.js`](../public/app/detail-views.js) | 侧栏/抽屉纯展示：采购销售单详情 HTML、商品与应收应付摘要、凭证明细 HTML。 |
| [`public/app/api-client.js`](../public/app/api-client.js) | `ensureToken`、`api`（Bearer）、`hasPermission`、`normalizePagedRows`；许可证门控返回 **402** 时派发 `gbf-license-blocked`。 |
| [`public/app/license-panel.js`](../public/app/license-panel.js) | 许可证状态横幅、登录前 bootstrap 引导、控制台「工具 → 许可证」页、进门全屏提示与管理员粘贴导入。 |
| [`public/app/reminders.js`](../public/app/reminders.js) | 催收货/催发货列表与加载。 |
| [`public/app/finance-tables.js`](../public/app/finance-tables.js) | 应收、应付、凭证、审计、告警等表格的查询与渲染。 |
| [`public/app/order-execution.js`](../public/app/order-execution.js) | 采购/销售执行区：刷新订单与仓库库位、快捷选单、数量校验、收发货与退货 API 调用。 |
| [`public/app/doc-settlement.js`](../public/app/doc-settlement.js) | 单据创建（采购/销售）、收款/付款、主数据下拉与应收应付未结下拉、`syncTxnFormDefaults` 与相关预览/提示。 |
| [`public/app/approval-workspace.js`](../public/app/approval-workspace.js) | 审批列表/详情/时间轴、批量动作、从审批跳转执行与资金区、`jumpFromApprovalDetail`。 |
| [`public/app.js`](../public/app.js) | 编排入口：登录与定时刷新、主数据 CRUD、表格与事件绑定等（与上表模块通过全局函数协作；单据创建与收付款逻辑见 `doc-settlement.js`）。 |

#### 拆分原则（高内聚、低耦合）

- **目标**：模块内职责完整、对外依赖少且单向；**不为减行数或「一律拆文件」而拆**。
- **适合单独成文件的信号**：边界稳定（如纯工具、HTTP 封装、单一业务域）、依赖方向清晰（例如不反向依赖 `app.js`）、单文件已明显妨碍阅读或测试。
- **宁可保留在 `app.js` 的情况**：与页面事件绑定强交织、频繁与十几处 DOM 交互、拆后只剩薄封装或形成循环依赖风险的逻辑。
- **新增代码时**：优先落在已有高内聚模块；若只是 `app.js` 里多几十行且无新边界，不必新开脚本。脚本顺序见 `index.html`（例如 **`api-client.js` → `license-panel.js`**，再 `reminders.js` … **`order-execution.js` → `doc-settlement.js` → `approval-workspace.js` → `app.js`**：`license-panel` 需在 `api` 之后以复用 `fetch` 错误行为；执行区先于收付下拉；`doc-settlement` 先于审批以便跳转资金区时函数已就绪；`app.js` 最后以提供 `inputText` / `selectNum` / `sortByIdDesc` 等被 `doc-settlement` 运行期调用的符号）。

## 技术栈与运行时

| 类别 | 选型 |
|------|------|
| 运行时 | Node.js 20+ |
| 语言 | TypeScript → 编译输出至 `dist/` |
| Web 框架 | Express |
| 数据库 | SQLite（`better-sqlite3`），库文件路径由 `DATA_DIR` 控制，默认 `./data/erp.db` |
| 校验 | Zod（`src/schemas/api.ts` 等处） |
| 鉴权 | JWT（`Authorization: Bearer`）；开发环境下可选用 Header 模拟用户（见下文） |

入口文件为 [`src/index.ts`](../src/index.ts)：挂载 CORS、`express.json`、`/app` 静态目录后 **`initDb()`**，再校验 `PORT`/`JWT_SECRET`（生产）以及可选的 **`LICENSE_PUBLIC_KEY_REQUIRED`**；随后注册路由与全局错误处理，并启动定时任务（审批超时扫描、Webhook 投递）。

## 源码目录（`src/`）

```
src/
├── index.ts              # 进程入口：Express、静态目录、配置校验、路由、定时任务
├── license.ts            # 离线许可证：公钥加载、验签、状态、试用期、写入 license.json
├── migrate.ts            # 迁移 CLI（npm run migrate）
├── db.ts                 # SQLite 连接、`initDb`（执行初始 DDL、演进、种子用户、`deployment.id`）
├── db/
│   ├── initial-ddl.ts    # 首次建表与索引的 SQL 常量（由 `initDb` 执行）
│   └── schema-evolution.ts  # 表结构演进（按组织唯一约束等重建辅助函数）
├── utils/
│   └── pagination.ts     # 内存分页（与路由中原先各文件内联逻辑一致）
├── constants.ts          # 扫描间隔等常量
├── security.ts           # 密码哈希、JWT 签发与校验
├── types.ts              # 共用类型（含角色名等）
├── version.ts            # 读取 package.json 暴露版本信息
├── schemas/
│   └── api.ts            # 请求体 Zod Schema（订单、主数据、财务等）
├── middleware/
│   ├── auth.ts           # JWT / 开发调试认证、角色权限表、requirePermission、requireAdmin
│   ├── license-gate.ts   # 已配置验签公钥且许可证无效时的全局 402 门控（豁免列表见文件内）
│   └── error-handler.ts # 统一错误响应
├── routes/
│   ├── register-app.ts   # 汇总注册全部路由（顺序见下文）
│   ├── license-routes.ts # GET /api/license/status、许可证安装/bootstrap
│   ├── public.ts         # 健康检查、版本、静态页兜底等公开路由
│   ├── auth-routes.ts    # 登录、刷新、注销
│   ├── finance-routes.ts # 应收应付、收款付款、科目、日记账等
│   ├── finance-report-routes.ts
│   ├── master-routes.ts  # 供应商、客户、商品、仓库库位等主数据
│   ├── order-routes.ts   # 聚合：采购单、销售单、履约（收货/发货/退货）
│   ├── purchase-order-routes.ts
│   ├── sales-order-routes.ts
│   ├── fulfillment-routes.ts
│   ├── approvals-routes.ts
│   ├── notifications-routes.ts
│   ├── audit-routes.ts
│   ├── reminder-routes.ts
│   └── config-routes.ts  # 审批/预警规则、Webhook 等配置类接口
└── services/             # 可复用领域逻辑（与路由解耦）
    ├── deployment-id.ts  # `DATA_DIR/deployment.id`（实例 UUID），供许可证 payload.deploymentId 绑定
    ├── order-helpers.ts  # 订单状态机、审批通过后的库存/凭证侧效应等
    ├── journal.ts
    ├── fulfillment.ts      # 采购收货、销售发货、采购/销售退货（库存台账 + 凭证）
    ├── audit.ts
    ├── idempotency.ts
    ├── auth-login-attempts.ts
    ├── ar-invoice-no.ts
    ├── order-list-queries.ts  # 采购/销售订单列表查询、结算字段附加与筛选
    └── alert-webhook-runtime.ts  # 超时扫描、Webhook 队列处理（由 index 定时调用）
```

### 路由注册顺序

[`routes/register-app.ts`](../src/routes/register-app.ts) 中顺序**有意固定**：**首位**挂载 **`registerLicenseGate`**（全局中间件，在多数路由之前执行）；其后为公开路由、认证、`license-routes`、财务与报表、主数据、订单与履约、通知、审批、审计、催办、配置类。全局错误处理在 [`index.ts`](../src/index.ts) 中于路由注册**之后**挂载，勿在中间插入会绕过错误处理的中间件。

许可证明细与用户操作说明见 **[docs/license.md](./license.md)**。

## 典型请求路径

1. **HTTP** 进入 Express；在 `registerAppRoutes` 内先于业务路由执行 **许可证门控**（若已配置公钥且当前无有效许可证、且不在豁免路径上，则可能直接 **402 JSON**）。
2. **认证**：受保护路由使用 `middleware/auth` 中的 `auth`；按路由使用 `requirePermission("xxx:read")` 等做细粒度授权；`getOrgId(req)` 从当前用户解析组织，用于多组织数据隔离。
3. **校验**：部分接口使用 `schemas/api.ts` 中的 Zod Schema 校验请求体。
4. **业务**：路由层编排 HTTP，复杂逻辑委托 `services/*`，持久化通过 `db.ts` 导出的默认 `Database` 实例执行 SQL。
5. **错误**：未捕获异常由 `registerErrorHandler` 统一转换为 HTTP 响应。

### 开发环境认证说明

生产环境要求携带合法 JWT。非生产环境下，未提供 Bearer 时是否允许用请求头 `x-username` 模拟用户由环境变量 **`ALLOW_DEV_HEADER_AUTH`** 控制（`1`/`true` 等为开启，`0`/`false` 等为关闭）；若未设置且 `NODE_ENV=development`，默认开启以便本地调试。其它非生产值（如测试）默认关闭。**切勿在生产依赖 Header 模拟登录**。

## 与仓库其它部分的边界

| 路径 | 职责 |
|------|------|
| [`public/`](../public/) | 浏览器控制台（`index.html`、`public/app/*.js` 与 `public/app.js`），挂载在 `/app` |
| [`openapi/openapi.yaml`](../openapi/openapi.yaml) | HTTP API 契约（与实现人工对齐，见 README） |
| [`scripts/`](../scripts/) | Bash：验证、冒烟、备份、部署辅助、`license:keys` / `sign-license` 等 |
| [`tools/`](../tools/) | 可选工具（如 **license-maker** 浏览器签发页）；不进入客户运行时必需路径 |
| [`deploy/`](../deploy/) | systemd、logrotate 等运维片段 |

## 扩展新接口时的建议

1. 在对应 `routes/*-routes.ts` 中注册路径；若为新领域，可增加新文件并在 `register-app.ts` 中**按依赖顺序**注册。
2. 权限串与 `middleware/auth.ts` 中的 `rolePermissions` 对齐；需要新权限时在路由上使用 `requirePermission` / `requireAnyPermission`。
3. 请求体结构优先在 `schemas/api.ts` 用 Zod 定义并复用。
4. 涉及订单状态、库存、应收应付连锁变更时，优先查看 `services/order-helpers.ts` 是否已有封装，避免重复实现状态机。
5. 同步更新 `openapi/openapi.yaml`（若对外暴露契约）。

## 测试与质量

- 单元测试：`src/**/*.test.ts`，由 `npm run test` 收集（见 `tsconfig` 排除编译）。
- 集成级脚本：`npm run smoke`、`npm run e2e`（需服务已启动）。
- 全量本地校验：`npm run verify`。
