const ORDER_STATUS_ZH = {
  draft: "草稿",
  submitted: "已提交",
  approved: "已审批",
  rejected: "已拒绝",
  voided: "已作废",
  reversed: "已冲销"
};

const AR_AP_STATUS_ZH = {
  open: "未结清",
  paid: "已结清",
  voided: "已作废"
};

const ORDER_TYPE_ZH = {
  purchase: "采购单",
  sales: "销售单"
};

const ROLE_ZH = {
  admin: "管理员",
  sales: "销售",
  purchase: "采购",
  warehouse: "仓储",
  finance: "财务"
};

const ALERT_LEVEL_ZH = {
  info: "信息",
  warning: "警告",
  critical: "严重"
};

const APPROVAL_ACTION_ZH = {
  submit: "提交",
  approve: "审批通过",
  reject: "驳回",
  void: "作废",
  reverse: "冲销"
};

const JOURNAL_REF_ZH = {
  purchase_order: "采购单",
  sales_order: "销售单",
  cash_receipt: "收款单",
  cash_payment: "付款单",
  purchase_order_reverse: "采购冲销",
  sales_order_reverse: "销售冲销",
  purchase_receipt: "采购收货",
  sales_delivery: "销售发货",
  purchase_return: "采购退货",
  sales_return: "销售退货"
};

const EVENT_TYPE_ZH = {
  "approval.overdue": "审批超时"
};

/** 审计日志 entity_type → 中文（展示用） */
const AUDIT_ENTITY_TYPE_ZH = {
  user: "用户",
  customer: "客户",
  supplier: "供应商",
  product: "商品",
  warehouse: "仓库",
  location: "库位",
  purchase_order: "采购订单",
  sales_order: "销售订单",
  cash_receipt: "收款单",
  cash_payment: "付款单",
  purchase_receipt: "采购收货单",
  sales_delivery: "销售发货单",
  purchase_return: "采购退货单",
  sales_return: "销售退货单"
};

/** 审计日志 action → 中文（与后端 writeAuditLog 的 action 一致） */
const AUDIT_ACTION_ZH = {
  "auth.login": "登录",
  "auth.logout": "登出",
  "purchase_order.create": "创建采购订单",
  "purchase_order.submit": "提交采购订单",
  "purchase_order.approve": "采购订单审批通过",
  "purchase_order.reject": "采购订单驳回",
  "purchase_order.void": "采购订单作废",
  "purchase_order.reverse": "采购订单冲销",
  "sales_order.create": "创建销售订单",
  "sales_order.submit": "提交销售订单",
  "sales_order.approve": "销售订单审批通过",
  "sales_order.reject": "销售订单驳回",
  "sales_order.void": "销售订单作废",
  "sales_order.reverse": "销售订单冲销",
  "receipt.create": "创建收款单",
  "payment.create": "创建付款单",
  "purchase_receipt.create": "采购收货记账",
  "sales_delivery.create": "销售发货出库",
  "purchase_return.create": "采购退货出库",
  "sales_return.create": "销售退货入库",
  "user.create": "创建用户",
  "customer.create": "创建客户",
  "supplier.create": "创建供应商",
  "product.create": "创建商品",
  "warehouse.create": "创建仓库",
  "location.create": "创建库位"
};

const AUDIT_DETAIL_KEY_ZH = {
  orderNo: "单号",
  receiptNo: "单据号",
  paymentNo: "付款单号",
  deliveryNo: "发货单号",
  returnNo: "退货单号",
  customerId: "客户ID",
  supplierId: "供应商ID",
  amount: "金额",
  orderId: "订单ID",
  totalAmount: "总金额",
  totalCost: "总成本",
  username: "用户名",
  role: "角色",
  code: "编码",
  name: "名称",
  sku: "SKU",
  warehouseId: "仓库ID",
  from: "原状态",
  to: "新状态",
  comment: "备注"
};

function pickZh(map, key) {
  if (key == null || key === "") return "-";
  return map[key] || key;
}

function zhOrderStatus(s) {
  return pickZh(ORDER_STATUS_ZH, s);
}

function zhApprovalRowStatus(row) {
  const status = String(row?.status || "");
  return zhOrderStatus(status);
}

function approvalStatusBadgeHtml(statusRaw) {
  const st = String(statusRaw || "").toLowerCase();
  const text = zhOrderStatus(st);
  let cls = "badge badge-muted";
  if (st === "draft") cls = "badge badge-muted";
  else if (st === "submitted") cls = "badge badge-info";
  else if (st === "approved") cls = "badge badge-ok";
  else if (st === "rejected") cls = "badge badge-danger";
  else if (st === "voided") cls = "badge badge-muted";
  else if (st === "reversed") cls = "badge badge-danger";
  return `<span class="${cls}" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
}

function formatApprovalStatusCell(row) {
  return approvalStatusBadgeHtml(row?.status);
}
function canTransitionOrderClient(current, action) {
  const transitions = {
    draft: ["submit", "void"],
    submitted: ["approve", "reject"],
    rejected: ["submit"],
    approved: ["reverse"],
    voided: []
  };
  return (transitions[current] || []).includes(action);
}

function actionPermissionClient(orderType, action) {
  return action === "submit" ? `${orderType}:submit` : `${orderType}:approve`;
}
function parseAuditDetail(detail) {
  if (!detail) return {};
  if (typeof detail === "object") return detail;
  if (typeof detail !== "string") return {};
  try {
    return JSON.parse(detail);
  } catch (_e) {
    return {};
  }
}

function extractLatestRejectMeta(timelineRows) {
  const rows = Array.isArray(timelineRows) ? timelineRows : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i] || {};
    const detail = parseAuditDetail(row.detail);
    const action = String(row.action || "").toLowerCase();
    const isRejectAction = action === "reject" || action.endsWith(".reject");
    const isRejectByTransition =
      String(detail.from || "").toLowerCase() === "submitted" && String(detail.to || "").toLowerCase() === "draft";
    if (!isRejectAction && !isRejectByTransition) continue;
    const comment = typeof detail.comment === "string" ? detail.comment.trim() : "";
    return {
      rejectedAt: row.createdAt || "",
      rejectComment: comment || "-"
    };
  }
  return null;
}

function shortRejectComment(text, maxLen = 20) {
  const s = String(text || "").trim();
  if (!s) return "-";
  return s.length > maxLen ? `${s.slice(0, maxLen)}...` : s;
}
function formatRejectSummaryCell(row) {
  const shortText = String(row?.rejectComment || "-");
  const fullText = String(row?.rejectCommentFull || shortText || "-");
  if (shortText === "-" || fullText === "-") return "-";
  return `<span class="reject-summary" data-full="${escapeHtml(fullText)}" title="${escapeHtml(fullText)}">${escapeHtml(
    shortText
  )}</span>`;
}

function approvalRowKey(orderType, id) {
  return `${orderType}:${Number(id)}`;
}

function zhArApStatus(s) {
  return pickZh(AR_AP_STATUS_ZH, s);
}

function zhOrderType(s) {
  return pickZh(ORDER_TYPE_ZH, s);
}

function zhRole(s) {
  return pickZh(ROLE_ZH, s);
}

function zhAlertLevel(s) {
  return pickZh(ALERT_LEVEL_ZH, s);
}

function zhApprovalAction(s) {
  return pickZh(APPROVAL_ACTION_ZH, s);
}

function zhJournalRefType(s) {
  return pickZh(JOURNAL_REF_ZH, s);
}

/** 凭证列表/详情「摘要」：新数据为中文；旧库中英摘要转为可读中文 */
function zhJournalMemo(row) {
  const raw = String(row?.memo ?? "").trim();
  const refType = row?.refType;
  const refId = row?.refId;
  if (raw) {
    const legacy = [
      [/^Purchase receipt\s+(.+)$/i, (m) => `采购收货 ${m[1]}`],
      [/^Sales delivery\s+(.+)$/i, (m) => `销售发货 ${m[1]}`],
      [/^Purchase return\s+(.+)$/i, (m) => `采购退货 ${m[1]}`],
      [/^Sales return\s+(.+)$/i, (m) => `销售退货 ${m[1]}`],
      [/^Receipt\s+(.+)$/i, (m) => `收款单 ${m[1]}`],
      [/^Payment\s+(.+)$/i, (m) => `付款单 ${m[1]}`]
    ];
    for (const [re, fn] of legacy) {
      const m = raw.match(re);
      if (m) return fn(m);
    }
    return raw;
  }
  const zh = zhJournalRefType(refType);
  if (refId != null && refId !== "") return `${zh} #${refId}`;
  return zh;
}

function zhAuditAction(action) {
  if (action == null || action === "") return "-";
  return AUDIT_ACTION_ZH[action] || String(action);
}

function zhAuditEntityLabel(entityType, entityId) {
  const t = AUDIT_ENTITY_TYPE_ZH[entityType] || entityType || "-";
  if (entityId != null && entityId !== "") return `${t} #${entityId}`;
  return t;
}

/** 将 audit_logs.detail（JSON 字符串或对象）格式化为中文可读 */
function zhAuditDetail(detail) {
  if (detail == null || detail === "") return "";
  let obj = detail;
  if (typeof detail === "string") {
    try {
      obj = JSON.parse(detail);
    } catch {
      return detail;
    }
  }
  if (typeof obj !== "object" || obj === null) return String(detail);

  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    const label = AUDIT_DETAIL_KEY_ZH[k] || k;
    let display = v;
    if (k === "from" || k === "to") display = zhOrderStatus(String(v));
    else if (k === "role") display = zhRole(String(v));
    else if (k === "amount" || k === "totalAmount" || k === "totalCost") display = typeof fmtMoney === "function" ? fmtMoney(Number(v)) : String(v);
    else if (typeof v === "object") display = JSON.stringify(v);
    else display = String(v);
    parts.push(`${label}：${display}`);
  }
  return parts.join("；");
}

function zhEventType(s) {
  return pickZh(EVENT_TYPE_ZH, s);
}

function zhArFulfillmentStatus(s) {
  const map = {
    not_shipped: "未发货",
    partially_shipped: "部分发货",
    fully_shipped: "已发货",
    unknown: "未知"
  };
  return map[s] || String(s || "未知");
}

function zhApFulfillmentStatus(s) {
  const map = {
    not_received: "未收货",
    partially_received: "部分收货",
    fully_received: "已收货",
    unknown: "未知"
  };
  return map[s] || String(s || "未知");
}

function zhPaymentStatus(s) {
  const map = {
    no_bill: "未生成应付",
    unpaid: "未付款",
    partial_paid: "部分付款",
    paid: "已付款"
  };
  return map[s] || String(s || "未知");
}

function zhReceiptStatus(s) {
  const map = {
    no_invoice: "未生成应收",
    unreceived: "未收款",
    partial_received: "部分收款",
    received: "已收款"
  };
  return map[s] || String(s || "未知");
}

function fulfillmentStatusFromQty(totalQty, doneQty) {
  const total = Number(totalQty || 0);
  const done = Number(doneQty || 0);
  if (total <= 0 || done <= 0) return "none";
  if (done + 0.0001 >= total) return "full";
  return "partial";
}

function combinedStageLabel(args) {
  const { approvalStatus, fulfillment, settlement, kind } = args;
  const st = String(approvalStatus || "").toLowerCase();
  if (st && st !== "approved") return zhOrderStatus(st);

  const f = String(fulfillment || "none");
  const s = String(settlement || "unpaid");

  if (f === "none" && (s === "unpaid" || s === "unreceived")) return "待执行";
  if (f === "partial") return "执行中";
  if (f === "full" && (s === "unpaid" || s === "unreceived")) return "已执行待结算";
  if (f === "full" && (s === "partial_paid" || s === "partial_received")) return "结算中";
  if (f === "full" && (s === "paid" || s === "received")) return "已完成";
  return kind === "sales" ? "异常（未发已收）" : "异常（未收已付）";
}

function stageBadgeHtml(label) {
  const text = String(label || "");
  const title = text.includes("（") && text.includes("）") ? text : text;
  let cls = "badge badge-muted";
  if (text === "待执行") cls = "badge badge-muted";
  else if (text === "执行中") cls = "badge badge-info";
  else if (text === "已执行待结算") cls = "badge badge-warn";
  else if (text === "结算中") cls = "badge badge-warn";
  else if (text === "已完成") cls = "badge badge-ok";
  else if (text.startsWith("异常")) cls = "badge badge-danger";
  return `<span class="${cls}" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`;
}

function arStageKeyFromRow(r) {
  const f = String(r.fulfillmentStatus || "unknown");
  const total = Number(r.totalAmount || 0);
  const settled = Number(r.receivedAmount || 0);
  const isUnsettled = settled <= 0.0001;
  const isSettled = total > 0 && settled + 0.0001 >= total;
  const isPartiallySettled = settled > 0.0001 && settled + 0.0001 < total;
  if (f === "not_shipped" && isUnsettled) return "todo";
  if (f === "partially_shipped") return "doing";
  if (f === "fully_shipped" && isUnsettled) return "wait_settle";
  if (f === "fully_shipped" && isPartiallySettled) return "settling";
  if (f === "fully_shipped" && isSettled) return "done";
  if ((f === "not_shipped" || f === "partially_shipped") && (isSettled || isPartiallySettled)) return "abnormal";
  return "other";
}

function apStageKeyFromRow(r) {
  const f = String(r.fulfillmentStatus || "unknown");
  const total = Number(r.totalAmount || 0);
  const settled = Number(r.paidAmount || 0);
  const isUnsettled = settled <= 0.0001;
  const isSettled = total > 0 && settled + 0.0001 >= total;
  const isPartiallySettled = settled > 0.0001 && settled + 0.0001 < total;
  if (f === "not_received" && isUnsettled) return "todo";
  if (f === "partially_received") return "doing";
  if (f === "fully_received" && isUnsettled) return "wait_settle";
  if (f === "fully_received" && isPartiallySettled) return "settling";
  if (f === "fully_received" && isSettled) return "done";
  if ((f === "not_received" || f === "partially_received") && (isSettled || isPartiallySettled)) return "abnormal";
  return "other";
}

function stageLabelFromKey(key, kind) {
  if (key === "todo") return "待执行";
  if (key === "doing") return "执行中";
  if (key === "wait_settle") return "已执行待结算";
  if (key === "settling") return "结算中";
  if (key === "done") return "已完成";
  if (key === "abnormal") return kind === "sales" ? "异常（未发已收）" : "异常（未收已付）";
  return "未知";
}
