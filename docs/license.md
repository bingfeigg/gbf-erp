# 离线许可证与交付说明

本文说明**客户环境**如何配置验签公钥、导入许可证、理解试用期与单实例绑定；签发方如何使用脚本与可视化工具。环境与接口细节以仓库根目录 **[`.env.example`](../.env.example)**、**[`openapi/openapi.yaml`](../openapi/openapi.yaml)** 为准。

## 行为概览

| 场景 | 服务端行为 |
|------|------------|
| **未配置验签公钥** | 不启用许可证门控；仍会维护 `DATA_DIR/trial.json` 并在控制台展示「试用剩余天数」（仅提示，**不拦截 API**）。 |
| **已配置公钥**（`LICENSE_PUBLIC_KEY_FILE` 或 `LICENSE_PUBLIC_KEY`） | 启用门控：磁盘上 `license.json` 验签通过且在有效期内则放行；否则在**试用期**内（见 `trial.json`）仍放行；试用结束且仍无有效许可证则对非豁免路径返回 **HTTP 402**，`code` 一般为 `LICENSE_INVALID`。 |
| **`LICENSE_PUBLIC_KEY_REQUIRED=1`** | **未**配置有效公钥时**进程拒绝启动**（用于强制交付环境必须先部署公钥）。 |

豁免路径（不经过 402 闸）包括：`/health`、`/api/version`、`/api/license/status`、`POST /api/license/install`、**`POST /api/license/install-bootstrap`**、以及整套 **`/api/auth/*`** 等，完整列表见 **[`src/middleware/license-gate.ts`](../src/middleware/license-gate.ts)**。

## 环境变量

| 变量 | 说明 |
|------|------|
| `LICENSE_PUBLIC_KEY_FILE` | Ed25519 **公钥** PEM 文件路径（相对 `cwd` 或绝对路径）。 |
| `LICENSE_PUBLIC_KEY` | 公钥 PEM 文本（可用 `\n` 表示换行）；与 `LICENSE_PUBLIC_KEY_FILE` 二选一即可。 |
| `LICENSE_FILE` | 许可证 JSON 路径；未设时默认为 **`DATA_DIR/license.json`**。 |
| `LICENSE_TRIAL_DAYS` | 已配置公钥、尚无有效正式许可证时的试用天数上限（默认 `7`，并实现上限制在合理范围）。 |
| `LICENSE_PUBLIC_KEY_REQUIRED` | 置为 `1`/`true` 等时表示**必须**配置公钥，否则启动失败。 |

`DATA_DIR` 未设置时默认为项目下的 **`data/`**（与 SQLite 同目录思路一致）。

## 本机标识与单实例绑定

- 首次数据库初始化时会生成 **`DATA_DIR/deployment.id`**（UUID 文本）。
- **`GET /api/license/status`**（无需登录）返回的 **`installationId`** 即该值；签发给客户时可在许可证 payload 中填写 **`deploymentId`**，与 `installationId` 一致则仅该机可用；payload 中**不填**则不限制实例。

**公网暴露注意**：`/api/license/status` 匿名可读，会暴露 `installationId` 与试用/授权状态摘要。公网部署建议由网络层限制访问或为该路径单独限速（OpenAPI 中亦有说明）。

## 密钥对与签发（签发方，非客户环境必填）

1. **生成密钥对**（私钥仅存签发方；勿提交仓库，默认输出目录 **`license-keys/`** 已在 **`.gitignore`** 中忽略）：
   ```bash
   npm run license:keys
   # 或: bash scripts/gen-license-keys.sh [输出目录]
   ```
2. **签发许可证 JSON**（stdout 输出全文，可重定向为客户 `license.json`）：
   ```bash
   LICENSE_PRIVATE_KEY_FILE=./license-keys/license_private.pem npx tsx scripts/sign-license.ts \
     --expires 2028-12-31 --customer "客户名称" [--deployment "<installationId UUID>"]
   ```
3. **浏览器可视化签发**（私钥仅在本地参与签名）：`npm run license:maker`，默认说明见 **`tools/license-maker/`**。

客户环境侧只需要**公钥**与**签发的许可证文件**。

## 在客户环境导入许可证

| 时机 | 方式 |
|------|------|
| **尚未能正常登录控制台**（已配公钥、许可证无效或缺失、且非试用期放行） | 登录页的引导区，或通过 **`POST /api/license/install-bootstrap`**：**管理员用户名 + 密码 + 许可证 JSON 字符串**。与登录共用失败次数防护。 |
| **已能以管理员登录** | 控制台 **导航 → 工具 → 许可证**，粘贴或选择文件后保存；或使用 **`POST /api/license/install`**（Bearer + 管理员，`body.licenseJson`）。 |

导入成功且验签通过后，通常会删除 **`trial.json`**，并开始按许可证 `expiresAt` 等字段展示剩余时间。

## 相关数据文件

| 路径 | 含义 |
|------|------|
| `DATA_DIR/license.json` | 当前许可证 JSON（payload + signature） |
| `DATA_DIR/trial.json` | 试用开始时刻（ISO 字符串） |
| `DATA_DIR/deployment.id` | 本实例 UUID |

## Docker 镜像与源码

仓库根 **[`Dockerfile`](../Dockerfile)** 为多阶段构建：**运行阶段镜像不含 `src/`，仅包含编译产物 `dist/`、`public/` 与生产依赖的 `node_modules`**。与客户「不带源码仍可运行」的交付方式一致。

## 前端与契约

- 控制台脚本 **`public/app/license-panel.js`** 负责横幅、登录引导、许可证页与门控弹窗；**[`public/app/api-client.js`](../public/app/api-client.js)** 在遇到 **402** 时会派发 **`gbf-license-blocked`** 事件。
- HTTP 契约见 **`openapi/openapi.yaml`** 中 **`license`** 标签下列出的路径。

## 相关代码入口（延伸阅读）

| 路径 | 职责 |
|------|------|
| [`src/license.ts`](../src/license.ts) | 验签、`getLicenseStatus`、`getLicenseGateOutcome`、`writeLicenseFile`、试用读写 |
| [`src/middleware/license-gate.ts`](../src/middleware/license-gate.ts) | 全局 402 门控与豁免列表 |
| [`src/routes/license-routes.ts`](../src/routes/license-routes.ts) | `/api/license/*` |
| [`src/services/deployment-id.ts`](../src/services/deployment-id.ts) | `deployment.id` 生成与读取 |
| [`scripts/sign-license.ts`](../scripts/sign-license.ts) | 离线签发 CLI |
