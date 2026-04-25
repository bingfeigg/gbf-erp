#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:4000}"
json_get='JSON.parse(require("fs").readFileSync(0,"utf8"))'

echo "[e2e] login"
LOGIN_JSON=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')
TOKEN=$(echo "$LOGIN_JSON" | node -p "const j=$json_get; j.token || ''")
if [[ -z "$TOKEN" ]]; then
  echo "[e2e] login failed"
  exit 1
fi

auth_post() {
  curl -s -X POST "$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$2" "$3"
}

echo "[e2e] idempotency for receipt"
curl -s -X POST "$BASE_URL/api/suppliers" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"code":"SUP-E2E","name":"Supplier E2E"}' >/dev/null || true
curl -s -X POST "$BASE_URL/api/customers" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"code":"CUS-E2E","name":"Customer E2E"}' >/dev/null || true
curl -s -X POST "$BASE_URL/api/products" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"sku":"SKU-E2E","name":"Product E2E","unit":"pcs","costPrice":10,"salePrice":20}' >/dev/null || true
SUPPLIER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/suppliers" | node -p "const a=$json_get; (a[0]||{}).id||1")
CUSTOMER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/customers" | node -p "const a=$json_get; (a[0]||{}).id||1")
PRODUCT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/products" | node -p "const a=$json_get; (a[0]||{}).id||1")

PO_NO="PO-E2E-$(date +%s)-$RANDOM"
SO_NO="SO-E2E-$(date +%s)-$RANDOM"

PO=$(curl -s -X POST "$BASE_URL/api/purchase-orders" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"orderNo\":\"$PO_NO\",\"supplierId\":$SUPPLIER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":3,\"price\":10}]}")
PO_ID=$(echo "$PO" | node -p "const j=$json_get; j.id")
echo "[e2e] purchase order detail GET"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/purchase-orders/$PO_ID" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.order||!Array.isArray(j.items)||j.items.length<1||!j.order.supplierName) { console.error(j); process.exit(1); }"
curl -s -X POST "$BASE_URL/api/purchase-orders/$PO_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"submit"}' >/dev/null
curl -s -X POST "$BASE_URL/api/purchase-orders/$PO_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"approve"}' >/dev/null

SO=$(curl -s -X POST "$BASE_URL/api/sales-orders" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"orderNo\":\"$SO_NO\",\"customerId\":$CUSTOMER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":1,\"price\":20}]}")
SO_ID=$(echo "$SO" | node -p "const j=$json_get; j.id")
echo "[e2e] sales order detail GET"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/sales-orders/$SO_ID" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.order||!Array.isArray(j.items)||j.items.length<1||!j.order.customerName) { console.error(j); process.exit(1); }"
curl -s -X POST "$BASE_URL/api/sales-orders/$SO_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"submit"}' >/dev/null
curl -s -X POST "$BASE_URL/api/sales-orders/$SO_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"approve"}' >/dev/null

AR_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/ar/invoices" | node -p "const a=$json_get; (a.find(x=>x.refId===${SO_ID})||a[0]||{}).id||''")
if [[ -z "$AR_ID" ]]; then
  echo "[e2e] AR invoice missing"
  exit 1
fi
KEY="e2e-rc-$(date +%s)-$RANDOM"
BODY="{\"receiptNo\":\"RC-E2E-$(date +%s)-$RANDOM\",\"customerId\":$CUSTOMER_ID,\"arInvoiceId\":$AR_ID,\"amount\":5}"
R1=$(curl -s -X POST "$BASE_URL/api/finance/receipts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "x-idempotency-key: $KEY" -d "$BODY")
R2=$(curl -s -X POST "$BASE_URL/api/finance/receipts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "x-idempotency-key: $KEY" -d "$BODY")
RID1=$(echo "$R1" | node -p "const j=$json_get; j.id")
RID2=$(echo "$R2" | node -p "const j=$json_get; j.id")
if [[ "$RID1" != "$RID2" ]]; then
  echo "[e2e] idempotency failed: receipt ids differ"
  exit 1
fi

echo "[e2e] trend and notifications endpoints"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/finance/reports/trend?days=14" >/dev/null
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/notifications/recent?sinceId=0" >/dev/null

echo "[e2e] reverse guard with settlements"
PO_G_NO="PO-GUARD-$(date +%s)-$RANDOM"
SO_G_NO="SO-GUARD-$(date +%s)-$RANDOM"

PO_G=$(curl -s -X POST "$BASE_URL/api/purchase-orders" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"orderNo\":\"$PO_G_NO\",\"supplierId\":$SUPPLIER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":2,\"price\":10}]}")
PO_G_ID=$(echo "$PO_G" | node -p "const j=$json_get; j.id")
curl -s -X POST "$BASE_URL/api/purchase-orders/$PO_G_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"submit"}' >/dev/null
curl -s -X POST "$BASE_URL/api/purchase-orders/$PO_G_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"approve"}' >/dev/null
AP_G_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/ap/bills" | node -p "const a=$json_get; (a.find(x=>x.refId===${PO_G_ID})||a[0]||{}).id||''")
if [[ -z "$AP_G_ID" ]]; then
  echo "[e2e] AP bill missing for reverse guard"
  exit 1
fi
curl -s -X POST "$BASE_URL/api/finance/payments" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"paymentNo\":\"PY-GUARD-$(date +%s)-$RANDOM\",\"supplierId\":$SUPPLIER_ID,\"apBillId\":$AP_G_ID,\"amount\":1}" >/dev/null
PO_REV_HTTP=$(curl -s -o /tmp/po-rev.json -w "%{http_code}" -X POST "$BASE_URL/api/purchase-orders/$PO_G_ID/action" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"reverse","comment":"should fail"}')
if [[ "$PO_REV_HTTP" != "400" ]]; then
  echo "[e2e] expected purchase reverse to fail after settlement"
  exit 1
fi

SO_G=$(curl -s -X POST "$BASE_URL/api/sales-orders" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"orderNo\":\"$SO_G_NO\",\"customerId\":$CUSTOMER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":1,\"price\":20}]}")
SO_G_ID=$(echo "$SO_G" | node -p "const j=$json_get; j.id")
curl -s -X POST "$BASE_URL/api/sales-orders/$SO_G_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"submit"}' >/dev/null
curl -s -X POST "$BASE_URL/api/sales-orders/$SO_G_ID/action" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"approve"}' >/dev/null
AR_G_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/ar/invoices" | node -p "const a=$json_get; (a.find(x=>x.refId===${SO_G_ID})||a[0]||{}).id||''")
if [[ -z "$AR_G_ID" ]]; then
  echo "[e2e] AR invoice missing for reverse guard"
  exit 1
fi
curl -s -X POST "$BASE_URL/api/finance/receipts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"receiptNo\":\"RC-GUARD-$(date +%s)-$RANDOM\",\"customerId\":$CUSTOMER_ID,\"arInvoiceId\":$AR_G_ID,\"amount\":1}" >/dev/null
SO_REV_HTTP=$(curl -s -o /tmp/so-rev.json -w "%{http_code}" -X POST "$BASE_URL/api/sales-orders/$SO_G_ID/action" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"reverse","comment":"should fail"}')
if [[ "$SO_REV_HTTP" != "400" ]]; then
  echo "[e2e] expected sales reverse to fail after settlement"
  exit 1
fi

echo "[e2e] OK"
