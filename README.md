# GBF ERP (Generic Trading MVP)

A runnable ERP backend starter for generic trading companies.

## Included modules

- User + role access (JWT auth)
- Customer management
- Supplier management
- Product management
- Purchase order (confirmed-inbound)
- Sales order (confirmed-outbound)
- Stock ledger
- Accounts (chart of accounts)
- Journal entries (vouchers)
- AR invoice + cash receipt
- AP bill + cash payment

## Quick start

```bash
npm install
npm run dev
```

Server starts at `http://localhost:3100`.

Health check:

```bash
curl http://localhost:3100/health
```

Web console:

```bash
http://localhost:3100/app
```

## Docker run

```bash
docker compose up --build
```

Then open:

- `http://localhost:3100/health`
- `http://localhost:3100/app`

## Smoke test

```bash
npm run smoke
```

## Auth (MVP)

Use login to get JWT token, then pass `Authorization: Bearer <token>`.
Login also returns a `refreshToken` for access token renewal.

Default seeded account:

- username: `admin`
- password: `admin123`

## Example flow

### 1) Login and save token

```bash
TOKEN=$(curl -s -X POST http://localhost:3100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
```

Refresh access token:

```bash
REFRESH_TOKEN="<from-login-response>"
curl -X POST http://localhost:3100/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

### 2) Create supplier, customer, product

```bash
curl -X POST http://localhost:3100/api/suppliers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"SUP001","name":"Default Supplier"}'

curl -X POST http://localhost:3100/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"CUS001","name":"Default Customer"}'

curl -X POST http://localhost:3100/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sku":"SKU001","name":"Demo Product","unit":"pcs","costPrice":10,"salePrice":15}'
```

### 3) Inbound by purchase order

```bash
curl -X POST http://localhost:3100/api/purchase-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"orderNo":"PO2026001","supplierId":1,"items":[{"productId":1,"qty":100,"price":10}]}'
```

### 4) Outbound by sales order

```bash
curl -X POST http://localhost:3100/api/sales-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"orderNo":"SO2026001","customerId":1,"items":[{"productId":1,"qty":20,"price":15}]}'
```

### 5) Query stock

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/products
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/stock/ledger
```

### 6) Query AR/AP and post receipts/payments

List AR invoices and AP bills:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/ar/invoices
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/ap/bills
```

Create a cash receipt (apply to an AR invoice):

```bash
curl -X POST http://localhost:3100/api/finance/receipts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"receiptNo":"RC2026001","customerId":1,"arInvoiceId":1,"amount":100}'
```

Create a cash payment (apply to an AP bill):

```bash
curl -X POST http://localhost:3100/api/finance/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"paymentNo":"PY2026001","supplierId":1,"apBillId":1,"amount":200}'
```

### 7) Query vouchers (journal entries)

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/accounts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/journals
```

### 8) Finance reports

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/trial-balance
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/ar-aging
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/ap-aging
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/inventory-valuation
curl -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/finance/reports/kpi-summary
```

Notes:

- Sales posting now auto-generates COGS entry (`6401`) and inventory credit (`1405`).
- Login is rate-limited per username for basic brute-force protection.
- Auth now supports refresh/logout endpoints (`/api/auth/refresh`, `/api/auth/logout`).
- All create/confirm actions are written into audit logs (`/api/audit-logs`, admin only).
- Web console now applies button-level permission locks by user role.
- Purchase/Sales now use approval state machine (`draft -> submitted -> approved/rejected/voided`); postings happen on `approved`.
- Approval queue endpoint: `GET /api/approvals/pending`
- Approval efficiency report: `GET /api/finance/reports/approval-efficiency`
- Approval SLA dashboard: `GET /api/approvals/sla-dashboard`
- Overdue approval queue: `GET /api/approvals/overdue?hours=24`
- Approval timeline: `GET /api/approvals/{purchase|sales}/{id}/timeline`

## Next suggested steps

- Add document approval workflow and full operation audit trail
- Add production-grade frontend stack (React + Ant Design + route-level permission guard)
# gbf-erp
