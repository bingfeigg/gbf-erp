# 变更日志

> 按版本汇总变更要点；早期版本的条目可能仍为英文，仅供追溯。

## Unreleased

- Merged environment templates into a single `.env.example` and removed duplicate `env.example`.
- Moved `CHANGELOG.md` and `scripts/regression-smoke.md` under `docs/`; added `docs/README.md` index.

## 0.2.0 - 2026-04-24

- Added multi-organization isolation across core ERP read/write APIs.
- Added configurable approval and alert rules APIs.
- Added idempotency protection for approval actions and receipts/payments via `x-idempotency-key`.
- Added trend reporting endpoint and notification polling endpoint.
- Added frontend trend dashboard tab and live notification banner.
- Added E2E regression script and GitHub Actions CI workflow.
- Added Docker and Compose health checks plus Compose CPU/memory limits.
- Added database migration entrypoint (`npm run migrate`).
- Added backup/restore scripts for SQLite data files.
- Added production deployment assets:
  - systemd unit (`deploy/gbf-erp.service`)
  - logrotate policy (`deploy/logrotate-gbf-erp`)
  - install/deploy/cron scripts in `scripts/`
- Added runtime hardening assets:
  - environment template (`.env.example`)
  - startup config validation in API boot sequence
  - env validation script (`scripts/validate-env.sh`)
  - disaster recovery drill script (`scripts/dr-drill.sh`)
  - backup-based rollback script (`scripts/rollback.sh`)
- Completed ERP production-closure scope:
  - approval reverse flow (`action=reverse`) with settlement guards
  - settlement line ledgers (`ar_receipt_lines`, `ap_payment_lines`)
  - webhook configuration + queued delivery + retry worker
  - unified right-side detail drawers for Products/AR/AP/Approval/Journals
  - smoke/e2e coverage for reverse success/failure guard paths
