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
  sales_order_reverse: "销售冲销"
};

const EVENT_TYPE_ZH = {
  "approval.overdue": "审批超时"
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
