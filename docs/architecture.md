# 代码架构说明

本文描述仓库「服务端」主体目录职责与请求链路，便于阅读代码或扩展接口。前端静态资源位于仓库根目录 [`public/`](../public/)，契约文档位于 [`openapi/`](../openapi/)。

## 技术栈与运行时

| 类别 | 选型 |
|------|------|
| 运行时 | Node.js 20+ |
| 语言 | TypeScript → 编译输出至 `dist/` |
| Web 框架 | Express |
| 数据库 | SQLite（`better-sqlite3`），库文件路径由 `DATA_DIR` 控制，默认 `./data/erp.db` |
| 校验 | Zod（`src/schemas/api.ts` 等处） |
| 鉴权 | JWT（`Authorization: Bearer`）；开发环境下可选用 Header 模拟用户（见下文） |

入口文件为 [`src/index.ts`](../src/index.ts)：初始化数据库、校验关键环境变量、注册路由与全局错误处理，并启动定时任务（审批超时扫描、Webhook 投递）。

## 源码目录（`src/`）

```
src/
├── index.ts              # 进程入口：Express、静态目录、定时任务
├── migrate.ts            # 迁移 CLI（npm run migrate）
├── db.ts                 # SQLite 连接、`initDb` 中建表/索引/种子数据等
├── db/
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
│   ├── auth.ts           # JWT / 开发调试认证、角色权限表、requirePermission
│   └── error-handler.ts # 统一错误响应
├── routes/
│   ├── register-app.ts   # 汇总注册全部路由（顺序见下文）
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
    ├── order-helpers.ts  # 订单状态机、审批通过后的库存/凭证侧效应等
    ├── journal.ts
    ├── audit.ts
    ├── idempotency.ts
    ├── auth-login-attempts.ts
    ├── ar-invoice-no.ts
    └── alert-webhook-runtime.ts  # 超时扫描、Webhook 队列处理（由 index 定时调用）
```

### 路由注册顺序

[`routes/register-app.ts`](../src/routes/register-app.ts) 中顺序**有意固定**：先公开接口与认证，再财务与报表，再主数据、订单与履约，其后通知、审批、审计、催办，最后配置类。全局错误处理在 [`index.ts`](../src/index.ts) 中于路由注册**之后**挂载，勿在中间插入会绕过错误处理的中间件。

## 典型请求路径

1. **HTTP** 进入 Express，JSON 由 `express.json()` 解析。
2. **认证**：受保护路由使用 `middleware/auth` 中的 `auth`；按路由使用 `requirePermission("xxx:read")` 等做细粒度授权；`getOrgId(req)` 从当前用户解析组织，用于多组织数据隔离。
3. **校验**：部分接口使用 `schemas/api.ts` 中的 Zod Schema 校验请求体。
4. **业务**：路由层编排 HTTP，复杂逻辑委托 `services/*`，持久化通过 `db.ts` 导出的默认 `Database` 实例执行 SQL。
5. **错误**：未捕获异常由 `registerErrorHandler` 统一转换为 HTTP 响应。

### 开发环境认证说明

生产环境要求携带合法 JWT。非生产环境下，`auth` 中间件在未提供 Bearer 时，可读取 `x-username` 模拟用户（便于本地调试）；**切勿在生产依赖该行为**。

## 与仓库其它部分的边界

| 路径 | 职责 |
|------|------|
| [`public/`](../public/) | 浏览器控制台（`index.html`、`app.js`），挂载在 `/app` |
| [`openapi/openapi.yaml`](../openapi/openapi.yaml) | HTTP API 契约（与实现人工对齐，见 README） |
| [`scripts/`](../scripts/) | Bash：验证、冒烟、备份、部署辅助等 |
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
