# 变更日志

> 按版本汇总变更要点。

## 未发布

- 合并环境变量模板为单一的 `.env.example`，并删除重复的 `env.example`。
- 将 `CHANGELOG.md` 与 `scripts/regression-smoke.md` 移至 `docs/` 目录，并新增 `docs/README.md` 索引。
- 新增服务端代码架构说明文档 [`docs/architecture.md`](architecture.md)。
- 抽取统一内存分页工具 [`src/utils/pagination.ts`](../src/utils/pagination.ts)，财务应收/应付列表保持「仅带 pageSize 才分页」行为。
- 将 SQLite 表重建类辅助函数迁至 [`src/db/schema-evolution.ts`](../src/db/schema-evolution.ts)，缩减 [`src/db.ts`](../src/db.ts) 职责。

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
