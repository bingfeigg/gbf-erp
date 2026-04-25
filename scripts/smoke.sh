#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:4000}"
json_get='JSON.parse(require("fs").readFileSync(0,"utf8"))'

echo "[smoke] health check"
curl -s "$BASE_URL/health" >/dev/null

echo "[smoke] login"
LOGIN_JSON=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')
TOKEN=$(echo "$LOGIN_JSON" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
REFRESH=$(echo "$LOGIN_JSON" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).refreshToken")

if [[ -z "$TOKEN" || -z "$REFRESH" ]]; then
  echo "[smoke] login token missing"
  exit 1
fi

auth_get() {
  curl -s -H "Authorization: Bearer $TOKEN" "$1"
}
auth_post() {
  curl -s -X POST "$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2"
}

echo "[smoke] me"
auth_get "$BASE_URL/api/auth/me" >/dev/null

echo "[smoke] refresh"
curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" >/dev/null

echo "[smoke] seed master data"
auth_post "$BASE_URL/api/suppliers" '{"code":"SUP001","name":"Default Supplier"}' >/dev/null || true
auth_post "$BASE_URL/api/customers" '{"code":"CUS001","name":"Default Customer"}' >/dev/null || true
auth_post "$BASE_URL/api/products" '{"sku":"SKU001","name":"Demo Product","unit":"pcs","costPrice":10,"salePrice":15}' >/dev/null || true

SUPPLIER_ID=$(auth_get "$BASE_URL/api/suppliers" | node -p "const a=$json_get; (a.find(x=>x.code==='SUP001')||{}).id||''")
CUSTOMER_ID=$(auth_get "$BASE_URL/api/customers" | node -p "const a=$json_get; (a.find(x=>x.code==='CUS001')||{}).id||''")
PRODUCT_ID=$(auth_get "$BASE_URL/api/products" | node -p "const a=$json_get; (a.find(x=>x.sku==='SKU001')||{}).id||''")
if [[ -z "$SUPPLIER_ID" || -z "$CUSTOMER_ID" || -z "$PRODUCT_ID" ]]; then
  echo "[smoke] master data missing"
  exit 1
fi

echo "[smoke] approval workflow (purchase/sales)"
PO_NO="PO-SMOKE-$(date +%s)-$RANDOM"
SO_NO="SO-SMOKE-$(date +%s)-$RANDOM"

AP_COUNT_BEFORE=$(auth_get "$BASE_URL/api/ap/bills" | node -p "const a=$json_get; a.length")
AR_COUNT_BEFORE=$(auth_get "$BASE_URL/api/ar/invoices" | node -p "const a=$json_get; a.length")

PO_CREATE=$(auth_post "$BASE_URL/api/purchase-orders" "{\"orderNo\":\"$PO_NO\",\"supplierId\":$SUPPLIER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":5,\"price\":10}]}")
PO_ID=$(echo "$PO_CREATE" | node -p "const j=$json_get; j.id")
PO_STATUS=$(echo "$PO_CREATE" | node -p "const j=$json_get; j.status")
if [[ "$PO_STATUS" != "draft" ]]; then
  echo "[smoke] purchase create status invalid: $PO_STATUS"
  exit 1
fi
echo "[smoke] purchase order detail GET"
auth_get "$BASE_URL/api/purchase-orders/$PO_ID" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.order||!j.items||j.items.length<1) process.exit(1);"
auth_post "$BASE_URL/api/purchase-orders/$PO_ID/action" '{"action":"submit","comment":"smoke submit"}' >/dev/null
auth_post "$BASE_URL/api/purchase-orders/$PO_ID/action" '{"action":"approve","comment":"smoke approve"}' >/dev/null

SO_CREATE=$(auth_post "$BASE_URL/api/sales-orders" "{\"orderNo\":\"$SO_NO\",\"customerId\":$CUSTOMER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":2,\"price\":15}]}")
SO_ID=$(echo "$SO_CREATE" | node -p "const j=$json_get; j.id")
SO_STATUS=$(echo "$SO_CREATE" | node -p "const j=$json_get; j.status")
if [[ "$SO_STATUS" != "draft" ]]; then
  echo "[smoke] sales create status invalid: $SO_STATUS"
  exit 1
fi
echo "[smoke] sales order detail GET"
auth_get "$BASE_URL/api/sales-orders/$SO_ID" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.order||!j.items||j.items.length<1) process.exit(1);"
auth_post "$BASE_URL/api/sales-orders/$SO_ID/action" '{"action":"submit","comment":"smoke submit"}' >/dev/null
auth_post "$BASE_URL/api/sales-orders/$SO_ID/action" '{"action":"approve","comment":"smoke approve"}' >/dev/null

echo "[smoke] reverse workflow (no settlement allowed)"
PO_RV_NO="PO-RV-SMOKE-$(date +%s)-$RANDOM"
SO_RV_NO="SO-RV-SMOKE-$(date +%s)-$RANDOM"
PO_RV_CREATE=$(auth_post "$BASE_URL/api/purchase-orders" "{\"orderNo\":\"$PO_RV_NO\",\"supplierId\":$SUPPLIER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":1,\"price\":10}]}")
PO_RV_ID=$(echo "$PO_RV_CREATE" | node -p "const j=$json_get; j.id")
auth_post "$BASE_URL/api/purchase-orders/$PO_RV_ID/action" '{"action":"submit","comment":"reverse submit"}' >/dev/null
PO_RV_RES=$(auth_post "$BASE_URL/api/purchase-orders/$PO_RV_ID/action" '{"action":"approve","comment":"reverse approve"}')
if [[ -z "$PO_RV_RES" ]]; then
  echo "[smoke] purchase reverse precondition setup failed"
  exit 1
fi
PO_RV_DONE=$(auth_post "$BASE_URL/api/purchase-orders/$PO_RV_ID/action" '{"action":"reverse","comment":"reverse test"}')
PO_RV_STATUS=$(echo "$PO_RV_DONE" | node -p "const j=$json_get; j.status || ''")
if [[ "$PO_RV_STATUS" != "reversed" ]]; then
  echo "[smoke] purchase reverse status invalid: $PO_RV_STATUS"
  exit 1
fi

SO_RV_CREATE=$(auth_post "$BASE_URL/api/sales-orders" "{\"orderNo\":\"$SO_RV_NO\",\"customerId\":$CUSTOMER_ID,\"items\":[{\"productId\":$PRODUCT_ID,\"qty\":1,\"price\":15}]}")
SO_RV_ID=$(echo "$SO_RV_CREATE" | node -p "const j=$json_get; j.id")
auth_post "$BASE_URL/api/sales-orders/$SO_RV_ID/action" '{"action":"submit","comment":"reverse submit"}' >/dev/null
SO_RV_RES=$(auth_post "$BASE_URL/api/sales-orders/$SO_RV_ID/action" '{"action":"approve","comment":"reverse approve"}')
if [[ -z "$SO_RV_RES" ]]; then
  echo "[smoke] sales reverse precondition setup failed"
  exit 1
fi
SO_RV_DONE=$(auth_post "$BASE_URL/api/sales-orders/$SO_RV_ID/action" '{"action":"reverse","comment":"reverse test"}')
SO_RV_STATUS=$(echo "$SO_RV_DONE" | node -p "const j=$json_get; j.status || ''")
if [[ "$SO_RV_STATUS" != "reversed" ]]; then
  echo "[smoke] sales reverse status invalid: $SO_RV_STATUS"
  exit 1
fi

AP_COUNT_AFTER=$(auth_get "$BASE_URL/api/ap/bills" | node -p "const a=$json_get; a.length")
AR_COUNT_AFTER=$(auth_get "$BASE_URL/api/ar/invoices" | node -p "const a=$json_get; a.length")
if (( AP_COUNT_AFTER < AP_COUNT_BEFORE + 1 )); then
  echo "[smoke] AP bill not generated on purchase approval"
  exit 1
fi
if (( AR_COUNT_AFTER < AR_COUNT_BEFORE + 1 )); then
  echo "[smoke] AR invoice not generated on sales approval"
  exit 1
fi

echo "[smoke] reports"
auth_get "$BASE_URL/api/finance/reports/trial-balance" >/dev/null
auth_get "$BASE_URL/api/finance/reports/ar-aging" >/dev/null
auth_get "$BASE_URL/api/finance/reports/ap-aging" >/dev/null
auth_get "$BASE_URL/api/finance/reports/approval-efficiency" >/dev/null
auth_get "$BASE_URL/api/approvals/sla-dashboard" >/dev/null
auth_get "$BASE_URL/api/approvals/pending" >/dev/null
auth_get "$BASE_URL/api/approvals/overdue?hours=24" >/dev/null

echo "[smoke] audit logs"
auth_get "$BASE_URL/api/audit-logs" >/dev/null
auth_get "$BASE_URL/api/alerts/events" >/dev/null

echo "[smoke] OK"
