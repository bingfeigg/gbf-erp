const state = {
  token: "",
  username: "",
  role: "",
  permissions: [],
  canUseDevOps: false,
  supplierId: 1,
  customerId: 1,
  productId: 1,
  arInvoiceId: null,
  apBillId: null
};
const STORAGE_SESSION_KEY = "gbf_erp_session_v1";
const STORAGE_PANEL_KEY = "gbf_erp_panel_v1";

const output = document.getElementById("output");
const loginStatus = document.getElementById("loginStatus");
const loginFormStatus = document.getElementById("loginFormStatus");
const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const kpiAr = document.getElementById("kpiAr");
const kpiAp = document.getElementById("kpiAp");
const kpiStock = document.getElementById("kpiStock");
const kpiStockValue = document.getElementById("kpiStockValue");
const kpiJe = document.getElementById("kpiJe");
const notificationBar = document.getElementById("notificationBar");
const roleTodoHint = document.getElementById("roleTodoHint");
const roleTodoList = document.getElementById("roleTodoList");
const trendChart = document.getElementById("trendChart");
const journalDetail = document.getElementById("journalDetail");
const productDetail = document.getElementById("productDetail");
const arDetail = document.getElementById("arDetail");
const apDetail = document.getElementById("apDetail");
const approvalDetail = document.getElementById("approvalDetail");
const approvalSlaCards = document.getElementById("approvalSlaCards");
const approvalOverdueTable = document.getElementById("approvalOverdueTable");
const approvalTimeline = document.getElementById("approvalTimeline");
const currentModuleTitle = document.getElementById("currentModuleTitle");
const bizParamsWorkbench = document.getElementById("bizParamsWorkbench");
const bizParamsHint = document.getElementById("bizParamsHint");
const tableTargets = {
  products: document.getElementById("productsTable"),
  approval: document.getElementById("approvalTable"),
  ar: document.getElementById("arTable"),
  ap: document.getElementById("apTable"),
  journals: document.getElementById("journalsTable"),
  audit: document.getElementById("auditTable"),
  alerts: document.getElementById("alertsTable")
};
const pagers = {
  products: document.getElementById("pagerProducts"),
  ar: document.getElementById("pagerAr"),
  ap: document.getElementById("pagerAp"),
  journals: document.getElementById("pagerJournals"),
  audit: document.getElementById("pagerAudit"),
  alerts: document.getElementById("pagerAlerts")
};
const filters = {
  products: document.getElementById("filterProducts"),
  ar: document.getElementById("filterAr"),
  ap: document.getElementById("filterAp"),
  journals: document.getElementById("filterJournals"),
  audit: document.getElementById("filterAudit")
};
const cache = { products: [], ar: [], ap: [], journals: [], audit: [], alerts: [], trend: [] };
const masterPickCache = { suppliers: [], customers: [], products: [] };
let notificationCursor = 0;
let notificationTimer = null;
let dashboardTimer = null;
let approvalType = "purchase";
let currentApprovalView = "none";
let approvalRowsCache = [];
let approvalRowsKind = "purchase";
const rejectSummaryCache = new Map();
const tabButtons = Array.from(document.querySelectorAll(".tab"));
const moduleNavButtons = Array.from(document.querySelectorAll(".module-nav [data-panel]"));
const panels = {
  panelCreate: document.getElementById("panelCreate"),
  panelProducts: document.getElementById("panelProducts"),
  panelApproval: document.getElementById("panelApproval"),
  panelAr: document.getElementById("panelAr"),
  panelAp: document.getElementById("panelAp"),
  panelJournals: document.getElementById("panelJournals"),
  panelTrend: document.getElementById("panelTrend"),
  panelAudit: document.getElementById("panelAudit"),
  panelAlerts: document.getElementById("panelAlerts")
};
const panelTitles = {
  panelCreate: "单据&商品创建",
  panelApproval: "审批工作台",
  panelAr: "应收管理",
  panelAp: "应付管理",
  panelProducts: "商品库存",
  panelJournals: "凭证中心",
  panelTrend: "趋势图表",
  panelAudit: "审计日志",
  panelAlerts: "告警事件"
};
const roleWorkspacePreset = {
  sales: {
    defaultPanel: "panelAr",
    preferredBizButtons: ["btnBizSales", "btnBizReceipt", "btnBizPending", "btnBizSubmit", "btnBizApprove", "btnBizRefresh"],
    preferredParamCards: ["paramCardSales", "paramCardReceipt"]
  },
  purchase: {
    defaultPanel: "panelAp",
    preferredBizButtons: ["btnBizPurchase", "btnBizPayment", "btnBizPending", "btnBizSubmit", "btnBizApprove", "btnBizRefresh"],
    preferredParamCards: ["paramCardPurchase", "paramCardPayment"]
  },
  finance: {
    defaultPanel: "panelJournals",
    preferredBizButtons: ["btnBizReceipt", "btnBizPayment", "btnBizPending", "btnBizApprove", "btnBizRefresh"],
    preferredParamCards: ["paramCardReceipt", "paramCardPayment"]
  },
  warehouse: {
    defaultPanel: "panelProducts",
    preferredBizButtons: ["btnBizRefresh"],
    preferredParamCards: ["paramCardPurchase", "paramCardSales"]
  },
  admin: {
    defaultPanel: "panelApproval",
    preferredBizButtons: ["btnBizPurchase", "btnBizSales", "btnBizPending", "btnBizSubmit", "btnBizApprove", "btnBizReceipt", "btnBizPayment", "btnBizRefresh"],
    preferredParamCards: ["paramCardPurchase", "paramCardSales", "paramCardReceipt", "paramCardPayment"]
  },
  root: {
    defaultPanel: "panelApproval",
    preferredBizButtons: ["btnBizPurchase", "btnBizSales", "btnBizPending", "btnBizSubmit", "btnBizApprove", "btnBizReceipt", "btnBizPayment", "btnBizRefresh"],
    preferredParamCards: ["paramCardPurchase", "paramCardSales", "paramCardReceipt", "paramCardPayment"]
  }
};
const pagerState = {
  products: { page: 1, pageSize: 8 },
  ar: { page: 1, pageSize: 8 },
  ap: { page: 1, pageSize: 8 },
  journals: { page: 1, pageSize: 8 },
  audit: { page: 1, pageSize: 12 },
  alerts: { page: 1, pageSize: 12 }
};

function log(title, data) {
  const msg = `\n=== ${title} ===\n${typeof data === "string" ? data : JSON.stringify(data, null, 2)}\n`;
  output.textContent += msg;
  output.scrollTop = output.scrollHeight;
}

function setAuthenticatedUi(isAuthed) {
  if (loginScreen) loginScreen.classList.toggle("hidden", isAuthed);
  if (appShell) appShell.classList.toggle("hidden", !isAuthed);
}

function persistSession() {
  try {
    if (!state.token) {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      return;
    }
    localStorage.setItem(
      STORAGE_SESSION_KEY,
      JSON.stringify({
        token: state.token,
        username: state.username,
        role: state.role,
        permissions: state.permissions,
        canUseDevOps: state.canUseDevOps
      })
    );
  } catch (_e) {
    // ignore storage failures
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.token) return false;
    state.token = String(s.token || "");
    state.username = String(s.username || "");
    state.role = String(s.role || "");
    state.permissions = Array.isArray(s.permissions) ? s.permissions : [];
    state.canUseDevOps = Boolean(s.canUseDevOps);
    return Boolean(state.token);
  } catch (_e) {
    return false;
  }
}

function persistCurrentPanel(panelId) {
  try {
    localStorage.setItem(STORAGE_PANEL_KEY, panelId);
  } catch (_e) {
    // ignore storage failures
  }
}

function restoreCurrentPanel() {
  try {
    return localStorage.getItem(STORAGE_PANEL_KEY) || "";
  } catch (_e) {
    return "";
  }
}

function renderTable(target, rows, columns, opts = {}) {
  if (!rows || rows.length === 0) {
    target.innerHTML = "<div class='muted' style='padding:8px;'>暂无数据</div>";
    return;
  }
  const classifyHeader = (label) => {
    const text = String(label || "");
    if (/(金额|借方|贷方|余额|成本|价格|数量|库存|openAmount|paid|received)/i.test(text)) return "th-amount";
    if (/(状态|级别|动作|类型)/i.test(text)) return "th-status";
    if (/(时间|日期|created|submitted|approved)/i.test(text)) return "th-time";
    if (/(^ID$|编号|单号|发票号|账单号|凭证号|SKU)/i.test(text)) return "th-id";
    return "";
  };
  const classifyCell = (label) => {
    const text = String(label || "");
    if (/(金额|借方|贷方|余额|成本|价格|数量|库存|openAmount|paid|received)/i.test(text)) return "td-amount";
    if (/(时间|日期|created|submitted|approved)/i.test(text)) return "td-time";
    return "";
  };
  const header = columns
    .map((c, idx) => {
      const cls = classifyHeader(c.label);
      const merged = `${cls}${idx === 0 ? " first-col" : ""}`.trim();
      return `<th class="${merged}">${c.label}</th>`;
    })
    .join("");
  const body = rows
    .map((row, idx) => {
      const cells = columns
        .map((c, colIdx) => {
          const v = c.getter(row);
          const base = [colIdx === 0 ? "first-col" : "", classifyCell(c.label)].filter(Boolean).join(" ");
          const cls = base ? ` class="${base}"` : "";
          return `<td${cls}>${v == null ? "" : String(v)}</td>`;
        })
        .join("");
      const rowAttr = opts.clickable ? `data-row-idx="${idx}" style="cursor:pointer;"` : "";
      return `<tr ${rowAttr}>${cells}</tr>`;
    })
    .join("");
  target.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  if (opts.clickable && typeof opts.onRowClick === "function") {
    target.querySelectorAll("tr[data-row-idx]").forEach((tr) => {
      tr.addEventListener("click", () => {
        target.querySelectorAll("tr.row-selected").forEach((el) => el.classList.remove("row-selected"));
        tr.classList.add("row-selected");
        const idx = Number(tr.getAttribute("data-row-idx"));
        opts.onRowClick(rows[idx]);
      });
    });
  }
}

function textMatch(row, keys, kw) {
  if (!kw) return true;
  const s = kw.toLowerCase();
  return keys.some((k) => String(row[k] ?? "").toLowerCase().includes(s));
}

/** 在关键字匹配时同时支持「中文展示值」（例如状态筛选用「草稿」也能命中 draft） */
function textMatchEx(row, keys, kw, extraGetters = []) {
  if (!kw) return true;
  const s = kw.toLowerCase();
  if (keys.some((k) => String(row[k] ?? "").toLowerCase().includes(s))) return true;
  return extraGetters.some((fn) => String(fn(row)).toLowerCase().includes(s));
}

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
  if (status === "draft" && row?.rejectedAt) return "草稿（已驳回）";
  return zhOrderStatus(status);
}

function formatApprovalStatusCell(row) {
  const statusText = zhApprovalRowStatus(row);
  const isRejectedDraft = String(row?.status || "") === "draft" && Boolean(row?.rejectedAt);
  if (!isRejectedDraft) return statusText;
  return `<span style="color:var(--danger);font-weight:700;" title="该单据由驳回回退到草稿">${escapeHtml(statusText)}</span>`;
}

function fmtMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : String(n ?? "-");
}

function fmtMaybe(v) {
  if (v == null || v === "") return "-";
  return String(v);
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

function findOrderStatusInCache(orderType, id) {
  const oid = Number(id);
  if (!Number.isFinite(oid) || oid <= 0) return null;
  const rows = approvalRowsCache || [];
  if (approvalRowsKind === "pending") {
    const hit = rows.find((r) => Number(r.id) === oid && String(r.orderType || "") === orderType);
    return hit?.status || null;
  }
  if (approvalRowsKind === "purchase" && orderType === "purchase") {
    const hit = rows.find((r) => Number(r.id) === oid);
    return hit?.status || null;
  }
  if (approvalRowsKind === "sales" && orderType === "sales") {
    const hit = rows.find((r) => Number(r.id) === oid);
    return hit?.status || null;
  }
  return null;
}

async function resolveOrderStatus(orderType, id) {
  const cached = findOrderStatusInCache(orderType, id);
  if (cached) return String(cached);
  const oid = Number(id);
  if (!Number.isFinite(oid) || oid <= 0) return null;
  const path = orderType === "sales" ? `/api/sales-orders/${oid}` : `/api/purchase-orders/${oid}`;
  try {
    const data = await api(path);
    const status = data?.order?.status;
    return status ? String(status) : null;
  } catch (_e) {
    return null;
  }
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

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

async function enrichApprovalRejectSummaries(rows, defaultOrderType) {
  const list = Array.isArray(rows) ? rows : [];
  const candidates = list
    .filter((r) => r && Number.isFinite(Number(r.id)) && (r.rejectedAt || String(r.status || "") === "rejected"))
    .slice(0, 40);
  if (!candidates.length) return;
  let changed = false;
  await Promise.all(
    candidates.map(async (row) => {
      const orderType = String(row.orderType || defaultOrderType || "purchase") === "sales" ? "sales" : "purchase";
      const key = approvalRowKey(orderType, row.id);
      if (rejectSummaryCache.has(key)) {
        const cached = rejectSummaryCache.get(key);
        row.rejectComment = cached.summary;
        row.rejectCommentFull = cached.full;
        return;
      }
      try {
        const timeline = await api(`/api/approvals/${orderType}/${row.id}/timeline`);
        const meta = extractLatestRejectMeta(timeline);
        const full = String(meta?.rejectComment || "-").trim() || "-";
        const summary = shortRejectComment(full);
        rejectSummaryCache.set(key, { summary, full });
        row.rejectComment = summary;
        row.rejectCommentFull = full;
        changed = true;
      } catch (_e) {
        rejectSummaryCache.set(key, { summary: "-", full: "-" });
        row.rejectComment = "-";
        row.rejectCommentFull = "-";
      }
    })
  );
  if (changed) renderApprovalTableFromCache();
}

/** 采购单详情（纯文本，便于在侧栏阅读） */
function formatPoDetail(data, rejectMeta = null) {
  const o = data.order || {};
  const lines = (data.items || []).map(
    (it, i) =>
      [
        `${i + 1}. ${it.sku ?? "-"} / ${it.productName ?? "-"}`,
        `   数量 ${fmtMoney(it.qty)} | 单价 ${fmtMoney(it.price)} | 小计 ${fmtMoney(it.amount)}`
      ].join("\n")
  );
  return [
    `采购单 ${o.orderNo ?? "-"}（ID ${o.id ?? "-"}）`,
    `状态：${zhOrderStatus(o.status)}`,
    `供应商：${o.supplierName ?? "-"}（${o.supplierCode ?? "-"} / #${o.supplierId ?? "-"}）`,
    `合计金额：${fmtMoney(o.totalAmount)}`,
    `创建：${o.createdAt ?? "-"}`,
    `提交：${o.submittedAt ?? "-"}`,
    `通过：${o.approvedAt ?? "-"}`,
    `驳回：${rejectMeta?.rejectedAt || o.rejectedAt || "-"}`,
    `驳回意见：${rejectMeta?.rejectComment || "-"}`,
    "",
    "明细：",
    ...lines,
    `共 ${(data.items || []).length} 行`
  ].join("\n");
}

/** 销售单详情 */
function formatSoDetail(data, rejectMeta = null) {
  const o = data.order || {};
  const lines = (data.items || []).map(
    (it, i) =>
      [
        `${i + 1}. ${it.sku ?? "-"} / ${it.productName ?? "-"}`,
        `   数量 ${fmtMoney(it.qty)} | 单价 ${fmtMoney(it.price)} | 小计 ${fmtMoney(it.amount)}`
      ].join("\n")
  );
  return [
    `销售单 ${o.orderNo ?? "-"}（ID ${o.id ?? "-"}）`,
    `状态：${zhOrderStatus(o.status)}`,
    `客户：${o.customerName ?? "-"}（${o.customerCode ?? "-"} / #${o.customerId ?? "-"}）`,
    `合计金额：${fmtMoney(o.totalAmount)}`,
    `创建：${o.createdAt ?? "-"}`,
    `提交：${o.submittedAt ?? "-"}`,
    `通过：${o.approvedAt ?? "-"}`,
    `驳回：${rejectMeta?.rejectedAt || o.rejectedAt || "-"}`,
    `驳回意见：${rejectMeta?.rejectComment || "-"}`,
    "",
    "明细：",
    ...lines,
    `共 ${(data.items || []).length} 行`
  ].join("\n");
}

function formatProductDetail(row) {
  return [
    `【商品】${fmtMaybe(row.name)}（ID ${fmtMaybe(row.id)}）`,
    `SKU：${fmtMaybe(row.sku)}     单位：${fmtMaybe(row.unit)}`,
    `库存：${fmtMoney(row.stockQty)}     成本价：${fmtMoney(row.costPrice)}     销售价：${fmtMoney(row.salePrice)}`
  ].join("\n");
}

function formatArInvoiceDetail(row) {
  const total = Number(row.totalAmount || 0);
  const received = Number(row.receivedAmount || 0);
  const open = Math.max(0, total - received);
  return [
    `【应收发票】${fmtMaybe(row.invoiceNo)}（ID ${fmtMaybe(row.id)}）`,
    `客户：${fmtMaybe(row.customerName)}（#${fmtMaybe(row.customerId)}）`,
    `状态：${zhArApStatus(row.status)}     未收余额：${fmtMoney(open)}`,
    `总金额：${fmtMoney(total)}     已收：${fmtMoney(received)}`,
    `来源：${fmtMaybe(row.refType)} #${fmtMaybe(row.refId)}`,
    `时间：${fmtMaybe(row.createdAt)}`
  ].join("\n");
}

function formatApBillDetail(row) {
  const total = Number(row.totalAmount || 0);
  const paid = Number(row.paidAmount || 0);
  const open = Math.max(0, total - paid);
  return [
    `【应付账单】${fmtMaybe(row.billNo)}（ID ${fmtMaybe(row.id)}）`,
    `供应商：${fmtMaybe(row.supplierName)}（#${fmtMaybe(row.supplierId)}）`,
    `状态：${zhArApStatus(row.status)}     未付余额：${fmtMoney(open)}`,
    `总金额：${fmtMoney(total)}     已付：${fmtMoney(paid)}`,
    `来源：${fmtMaybe(row.refType)} #${fmtMaybe(row.refId)}`,
    `时间：${fmtMaybe(row.createdAt)}`
  ].join("\n");
}

function formatJournalDetail(entry) {
  const lines = (entry.lines || []).map((l, i) => {
    const dc = Number(l.debit || 0) > 0 ? `借 ${fmtMoney(l.debit)}` : `贷 ${fmtMoney(l.credit)}`;
    return `  ${i + 1}. ${fmtMaybe(l.accountCode)}  ${dc}`;
  });
  const debit = (entry.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = (entry.lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
  return [
    `【凭证】${fmtMaybe(entry.entryNo)}`,
    `来源：${zhJournalRefType(entry.refType)}     参考：${fmtMaybe(entry.refType)} #${fmtMaybe(entry.refId)}`,
    `摘要：${fmtMaybe(entry.memo)}`,
    `合计：借 ${fmtMoney(debit)} / 贷 ${fmtMoney(credit)}`,
    `时间：${fmtMaybe(entry.createdAt)}`,
    "————————————————————————————",
    "分录：",
    ...lines,
    `共 ${(entry.lines || []).length} 行`
  ].join("\n");
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
function zhEventType(s) {
  return pickZh(EVENT_TYPE_ZH, s);
}

function showActionWarn(message) {
  if (!notificationBar) return;
  notificationBar.textContent = `提示：${message}`;
}

function toggleQuickPartyBox(boxId, show, nameInputId = "") {
  const box = document.getElementById(boxId);
  if (!box) return;
  const selectMap = {
    boxQuickAddSupplier: "poSupplierPick",
    boxQuickAddCustomerSales: "soCustomerPick",
    boxQuickAddCustomerReceipt: "rcCustomerPick",
    boxQuickAddSupplierPayment: "pySupplierPick"
  };
  const selectId = selectMap[boxId];
  const selectEl = selectId ? document.getElementById(selectId) : null;
  if (selectEl) {
    selectEl.disabled = !!show;
    selectEl.style.opacity = show ? "0.75" : "1";
    selectEl.title = show ? "请先完成当前新增或取消" : "";
  }
  box.style.display = show ? "flex" : "none";
  if (show && nameInputId) {
    const nameInput = document.getElementById(nameInputId);
    if (nameInput) nameInput.focus();
  }
  if (!show) {
    box.querySelectorAll("input").forEach((el) => {
      el.value = "";
    });
  }
}

const quickAddPreviousSelectValue = new Map();
const quickPartyBoxes = [
  "boxQuickAddSupplier",
  "boxQuickAddCustomerSales",
  "boxQuickAddCustomerReceipt",
  "boxQuickAddSupplierPayment"
];

function closeOtherQuickPartyBoxes(activeBoxId = "") {
  quickPartyBoxes.forEach((boxId) => {
    if (!boxId || boxId === activeBoxId) return;
    const box = document.getElementById(boxId);
    if (!box || box.style.display === "none") return;
    const selectMap = {
      boxQuickAddSupplier: "poSupplierPick",
      boxQuickAddCustomerSales: "soCustomerPick",
      boxQuickAddCustomerReceipt: "rcCustomerPick",
      boxQuickAddSupplierPayment: "pySupplierPick"
    };
    const sid = selectMap[boxId];
    if (sid) cancelQuickPartyBox(boxId, sid);
  });
}

function cancelQuickPartyBox(boxId, selectId) {
  const prev = quickAddPreviousSelectValue.get(boxId);
  if (prev != null) {
    const el = document.getElementById(selectId);
    if (el) {
      el.value = String(prev);
      updateSelectVisualState(selectId);
      renderPreviewBySelectId(selectId);
    }
  }
  quickAddPreviousSelectValue.delete(boxId);
  toggleQuickPartyBox(boxId, false);
}

function refreshSinglePartyPick(selectId, rows, entityText) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const current = String(el.value || "");
  const options = [`<option value="">选择${entityText}</option>`, `<option value="__add_new__">+ 新增${entityText}</option>`];
  rows.forEach((r) => {
    options.push(`<option value="${r.id}">${r.code || ""} ${r.name || ""}（ID:${r.id}）</option>`);
  });
  el.innerHTML = options.join("");
  if (current && current !== "__add_new__") el.value = current;
  updateSelectVisualState(selectId);
}

function sortByIdDesc(rows) {
  return [...(rows || [])].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
}

async function quickCreateParty(kind, codeInputId, nameInputId, boxId, targetSelectId) {
  const isSupplier = kind === "supplier";
  const typeText = isSupplier ? "供应商" : "客户";
  const codePrefix = isSupplier ? "SUP" : "CUS";
  const codeRaw = document.getElementById(codeInputId)?.value.trim() || "";
  const nameRaw = document.getElementById(nameInputId)?.value.trim() || "";
  if (!nameRaw || nameRaw.length < 2) {
    throw new Error(`${typeText}名称至少 2 个字符。`);
  }
  const payload = {
    code: (codeRaw && codeRaw.length >= 2 ? codeRaw : `${codePrefix}${Date.now().toString().slice(-6)}`).toUpperCase(),
    name: nameRaw
  };
  const path = isSupplier ? "/api/suppliers" : "/api/customers";
  const created = await api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (isSupplier) {
    masterPickCache.suppliers = sortByIdDesc([...(masterPickCache.suppliers || []), created]);
    refreshSinglePartyPick("poSupplierPick", masterPickCache.suppliers, "供应商");
    refreshSinglePartyPick("pySupplierPick", masterPickCache.suppliers, "供应商");
  } else {
    masterPickCache.customers = sortByIdDesc([...(masterPickCache.customers || []), created]);
    refreshSinglePartyPick("soCustomerPick", masterPickCache.customers, "客户");
    refreshSinglePartyPick("rcCustomerPick", masterPickCache.customers, "客户");
  }
  const target = document.getElementById(targetSelectId);
  if (target) {
    target.value = String(created.id);
    target.dataset.prevValue = String(created.id);
  }
  updateSelectVisualState(targetSelectId);
  if (isSupplier) {
    state.supplierId = Number(created.id) || state.supplierId;
    if (targetSelectId === "poSupplierPick") renderPurchaseAutoHint();
  } else {
    state.customerId = Number(created.id) || state.customerId;
  }
  quickAddPreviousSelectValue.delete(boxId);
  toggleQuickPartyBox(boxId, false);
  showPickOptionHint(`已新增${typeText}：${payload.code} ${payload.name}（ID:${created.id}）`);
  log(`新增${typeText}`, created);
}

let approvalActionHintTimer = null;
function showApprovalActionHint(message) {
  const el = document.getElementById("approvalActionHint");
  if (!el) return;
  el.textContent = message;
  el.style.display = "";
  if (approvalActionHintTimer) clearTimeout(approvalActionHintTimer);
  approvalActionHintTimer = setTimeout(() => {
    if (el.textContent === message) el.style.display = "none";
    approvalActionHintTimer = null;
  }, 5000);
}

function updateKpis() {
  const arOpen = cache.ar.reduce((sum, r) => sum + Math.max(0, Number(r.totalAmount) - Number(r.receivedAmount)), 0);
  const apOpen = cache.ap.reduce((sum, r) => sum + Math.max(0, Number(r.totalAmount) - Number(r.paidAmount)), 0);
  const stockTotal = cache.products.reduce((sum, r) => sum + Number(r.stockQty || 0), 0);
  const stockCost = cache.products.reduce(
    (sum, r) => sum + Number(r.stockQty || 0) * Number(r.costPrice || 0),
    0
  );
  kpiAr.textContent = arOpen.toFixed(2);
  kpiAp.textContent = apOpen.toFixed(2);
  kpiStock.textContent = stockTotal.toFixed(2);
  if (kpiStockValue) kpiStockValue.textContent = `库存成本金额 ${stockCost.toFixed(2)}`;
  kpiJe.textContent = String(cache.journals.length);
}

function renderTrendFromCache() {
  const rows = cache.trend || [];
  if (!rows.length) {
    trendChart.innerHTML = "<div class='muted'>暂无趋势数据</div>";
    return;
  }
  const maxVal = rows.reduce(
    (m, r) => Math.max(m, Number(r.salesAmount || 0), Number(r.purchaseAmount || 0), Number(r.receiptAmount || 0), Number(r.paymentAmount || 0)),
    1
  );
  trendChart.innerHTML = rows
    .map((r) => {
      const salesPct = Math.min(100, Math.round((Number(r.salesAmount || 0) / maxVal) * 100));
      const purchasePct = Math.min(100, Math.round((Number(r.purchaseAmount || 0) / maxVal) * 100));
      const width = Math.max(salesPct, purchasePct, 2);
      return `<div class="trend-row">
        <div class="muted">${r.day}</div>
        <div class="trend-bar"><div class="trend-fill" style="width:${width}%"></div></div>
        <div class="muted">销:${Number(r.salesAmount || 0).toFixed(0)}</div>
      </div>`;
    })
    .join("");
}

async function queryTrend() {
  ensureToken();
  const rows = await api("/api/finance/reports/trend?days=14");
  cache.trend = rows;
  renderTrendFromCache();
  log("趋势图表", rows);
}

async function pollNotifications() {
  if (!state.token) return;
  const result = await api(`/api/notifications/recent?sinceId=${notificationCursor}`);
  const rows = result.rows || [];
  notificationCursor = Math.max(notificationCursor, Number(result.maxId || 0));
  if (!rows.length) return;
  const latest = rows[0];
  notificationBar.textContent = `通知：${rows.length} 条新消息，最新：${zhAlertLevel(latest.level)} / ${zhEventType(latest.eventType)} / ${latest.message}`;
}

function hasPermission(permission) {
  const perms = state.permissions || [];
  return perms.includes("*") || perms.includes(permission);
}

/** 审批区：标明当前动作对应的采购/销售 API 路径 */
function syncApprovalContextLabel(mode) {
  const el = document.getElementById("approvalContextLabel");
  if (!el) return;
  if (mode === "mixed") {
    el.textContent = "待审批列表：请点击一行锁定「采购单 / 销售单」后，再使用下方「提交 / 通过」等（动作发往对应 /api/.../action）。";
    return;
  }
  const t = approvalType === "sales" ? "销售单" : "采购单";
  const path = approvalType === "sales" ? "sales-orders" : "purchase-orders";
  el.textContent = `当前：${t}（审批动作 → POST /api/${path}/:id/action；详情 → GET /api/${path}/:id）`;
}

function syncApprovalViewLabel() {
  const el = document.getElementById("approvalViewLabel");
  if (!el) return;
  const labels = {
    pending: "视图：我的待审批",
    purchase: "视图：采购单列表",
    sales: "视图：销售单列表",
    none: "视图：未加载"
  };
  el.textContent = labels[currentApprovalView] || "视图：未加载";
}

function setRejectInputVisible(visible) {
  const row = document.getElementById("approvalRejectRow");
  if (!row) return;
  row.style.display = visible ? "flex" : "none";
  if (!visible) {
    const commentInput = document.getElementById("approvalComment");
    if (commentInput) commentInput.value = "";
  }
}

function syncApprovalSelectedIdHint() {
  const hint = document.getElementById("approvalSelectedIdHint");
  const idInput = document.getElementById("approvalOrderId");
  if (!hint) return;
  const id = String(idInput?.value || "").trim();
  hint.textContent = id ? `当前单据：#${id}` : "当前单据：未选中";
}

function renderRoleTodoFocus() {
  if (!roleTodoList || !roleTodoHint) return;
  if (!state.token) {
    roleTodoHint.textContent = "登录后会根据角色自动生成关键待办。";
    roleTodoList.innerHTML = "";
    return;
  }
  const pendingSubmitted = (approvalRowsCache || []).filter((r) => String(r.status || "").toLowerCase() === "submitted").length;
  const arOpen = (cache.ar || []).filter((r) => Number(r.openAmount || (Number(r.totalAmount || 0) - Number(r.receivedAmount || 0))) > 0).length;
  const apOpen = (cache.ap || []).filter((r) => Number(r.openAmount || (Number(r.totalAmount || 0) - Number(r.paidAmount || 0))) > 0).length;
  const todos = [];
  if (state.role === "sales") {
    todos.push("优先检查销售草稿并提交审批。");
    if (arOpen > 0) todos.push(`有 ${arOpen} 条应收未收，建议跟进收款。`);
    todos.push("收款后刷新应收与凭证，确认状态同步。");
  } else if (state.role === "purchase") {
    todos.push("优先检查采购草稿并提交审批。");
    if (apOpen > 0) todos.push(`有 ${apOpen} 条应付未付，建议安排付款。`);
    todos.push("付款后刷新应付与凭证，确认状态同步。");
  } else if (state.role === "finance") {
    todos.push("先处理待审批单据，再执行收付款。");
    todos.push("重点核对应收/应付未清金额和凭证是否一致。");
  } else if (state.role === "warehouse") {
    todos.push("优先核对库存与商品主数据，处理异常数量。");
    todos.push("配合业务单据执行后，及时刷新库存与趋势。");
  } else {
    todos.push("先查看我的待审批列表，处理已提交单据。");
    todos.push("抽查应收/应付与凭证一致性，关注异常。");
  }
  if (pendingSubmitted > 0) todos.unshift(`当前有 ${pendingSubmitted} 条已提交单据待处理。`);
  roleTodoHint.textContent = `当前角色：${zhRole(state.role)}（动态建议）`;
  roleTodoList.innerHTML = todos.slice(0, 4).map((t) => `<li>${t}</li>`).join("");
}

function approvalStatusFilterValue() {
  const el = document.getElementById("approvalStatusFilter");
  return (el?.value || "all").trim();
}

function setApprovalStatusFilter(value) {
  const el = document.getElementById("approvalStatusFilter");
  if (!el) return;
  el.value = value;
}

function getFilteredApprovalRows(rows) {
  const status = approvalStatusFilterValue();
  const actionableOnly = Boolean(document.getElementById("chkApprovalActionableOnly")?.checked);
  return rows.filter((r) => {
    const rowStatus = String(r.status || "").toLowerCase();
    if (status && status !== "all" && rowStatus !== status) return false;
    if (!actionableOnly) return true;
    const kind = approvalRowsKind === "pending" ? String(r.orderType || approvalType || "purchase") : approvalRowsKind;
    const canSubmit = kind === "sales" ? hasPermission("sales:submit") : hasPermission("purchase:submit");
    const canApprove = kind === "sales" ? hasPermission("sales:approve") : hasPermission("purchase:approve");
    if (rowStatus === "draft") return canSubmit;
    if (rowStatus === "submitted") return canApprove;
    return false;
  });
}

function renderApprovalTableFromCache() {
  const rows = getFilteredApprovalRows(approvalRowsCache || []);
  if (approvalRowsKind === "pending") {
    renderTable(
      tableTargets.approval,
      rows,
      [
        { label: "类型", getter: (r) => zhOrderType(r.orderType) },
        { label: "ID", getter: (r) => r.id },
        { label: "单号", getter: (r) => r.orderNo },
        { label: "状态", getter: (r) => formatApprovalStatusCell(r) },
        { label: "金额", getter: (r) => r.totalAmount },
        { label: "提交时间", getter: (r) => r.submittedAt || "-" },
        { label: "最近驳回意见", getter: (r) => formatRejectSummaryCell(r) }
      ],
      {
        clickable: true,
        onRowClick: (row) => selectApprovalRow(row.orderType || approvalType, row)
      }
    );
    bindRejectSummaryCopy(tableTargets.approval);
    return;
  }
  if (approvalRowsKind === "sales") {
    renderTable(
      tableTargets.approval,
      rows,
      [
        { label: "ID", getter: (r) => r.id },
        { label: "单号", getter: (r) => r.orderNo },
        { label: "客户ID", getter: (r) => r.customerId },
        { label: "状态", getter: (r) => formatApprovalStatusCell(r) },
        { label: "金额", getter: (r) => r.totalAmount },
        { label: "创建时间", getter: (r) => r.createdAt },
        { label: "最近驳回意见", getter: (r) => formatRejectSummaryCell(r) }
      ],
      {
        clickable: true,
        onRowClick: (row) => selectApprovalRow("sales", row)
      }
    );
    bindRejectSummaryCopy(tableTargets.approval);
    return;
  }
  renderTable(
    tableTargets.approval,
    rows,
    [
      { label: "ID", getter: (r) => r.id },
      { label: "单号", getter: (r) => r.orderNo },
      { label: "供应商ID", getter: (r) => r.supplierId },
      { label: "状态", getter: (r) => formatApprovalStatusCell(r) },
      { label: "金额", getter: (r) => r.totalAmount },
      { label: "创建时间", getter: (r) => r.createdAt },
      { label: "最近驳回意见", getter: (r) => formatRejectSummaryCell(r) }
    ],
    {
      clickable: true,
      onRowClick: (row) => selectApprovalRow("purchase", row)
    }
  );
  bindRejectSummaryCopy(tableTargets.approval);
}

function bindRejectSummaryCopy(target) {
  if (!target) return;
  target.querySelectorAll(".reject-summary").forEach((el) => {
    if (el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.style.cursor = "copy";
    el.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const text = String(el.getAttribute("data-full") || "").trim();
      if (!text || text === "-") return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => log("已复制驳回意见", text))
          .catch(() => log("复制失败，请手工复制", text));
      } else {
        log("请手工复制驳回意见", text);
      }
    });
  });
}

function setApprovalQuickFilterDefault() {
  const box = document.getElementById("chkApprovalActionableOnly");
  if (!box) return;
  box.checked = currentApprovalView === "pending";
}

function applyRoleUi() {
  const guards = [
    ["btnSeed", "stock:write"],
    ["btnPurchase", "purchase:write"],
    ["btnSales", "sales:write"],
    ["btnReceipt", "sales:write"],
    ["btnPayment", "purchase:write"],
    ["btnProducts", "product:read"],
    ["btnAr", "sales:read"],
    ["btnAp", "purchase:read"],
    ["btnJournals", "purchase:read"],
    ["btnLoadPoApprovals", "purchase:read"],
    ["btnLoadSoApprovals", "sales:read"],
    ["btnLoadPendingApprovals", ["purchase:approve", "sales:approve"]],
    ["btnResetApprovalView", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["chkApprovalActionableOnly", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["btnLoadApprovalSla", ["purchase:approve", "sales:approve"]],
    ["btnLoadOverdueApprovals", ["purchase:approve", "sales:approve"]],
    ["btnLoadTimeline", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["btnTrend", "stock:read"],
    ["btnSubmitApproval", ["purchase:submit", "sales:submit"]],
    ["btnApproveApproval", ["purchase:approve", "sales:approve"]],
    ["btnRejectApproval", ["purchase:approve", "sales:approve"]],
    ["btnVoidApproval", ["purchase:approve", "sales:approve"]],
    ["btnReverseApproval", ["purchase:approve", "sales:approve"]],
    ["btnProductAdd", ["stock:write", "product:write"]],
    ["btnWebhookList", "*"],
    ["btnWebhookSave", "*"],
    ["btnWebhookDelete", "*"],
    ["btnAudit", "*"],
    ["btnAlerts", "*"],
    ["btnRunAll", "*"],
    ["navApproval", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["navAr", "sales:read"],
    ["navAp", "purchase:read"],
    ["navProducts", "product:read"],
    ["navJournals", "purchase:read"],
    ["navTrend", "stock:read"],
    ["navAudit", "*"],
    ["navAlerts", "*"],
    ["btnBizPurchase", "purchase:write"],
    ["btnBizSales", "sales:write"],
    ["btnBizAddProduct", ["stock:write", "product:write"]],
    ["btnConfirmPurchase", "purchase:write"],
    ["btnConfirmSales", "sales:write"],
    ["btnConfirmReceipt", "sales:write"],
    ["btnConfirmPayment", "purchase:write"],
    ["btnBizPending", ["purchase:approve", "sales:approve"]],
    ["btnBizSubmit", ["purchase:submit", "sales:submit"]],
    ["btnBizApprove", ["purchase:approve", "sales:approve"]],
    ["btnBizReceipt", "sales:write"],
    ["btnBizPayment", "purchase:write"],
    ["btnBizRefresh", ["product:read", "sales:read", "purchase:read", "stock:read", "*"]]
  ];
  guards.forEach(([id, perm]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ok = Array.isArray(perm) ? perm.some((p) => hasPermission(p)) : hasPermission(perm);
    el.disabled = !ok;
    el.style.opacity = ok ? "1" : "0.55";
    el.title = ok ? "" : "当前角色无权限";
  });
  const navAudit = document.getElementById("navAudit");
  if (navAudit) navAudit.style.display = hasPermission("*") ? "block" : "none";
  const navAlerts = document.getElementById("navAlerts");
  if (navAlerts) navAlerts.style.display = hasPermission("*") ? "block" : "none";
  const devOpsSection = document.getElementById("devOpsSection");
  if (devOpsSection) devOpsSection.style.display = state.canUseDevOps ? "grid" : "none";
  const userOpsSection = document.getElementById("userOpsSection");
  if (userOpsSection) userOpsSection.style.display = state.canUseDevOps ? "none" : "grid";
  const btnRunAll = document.getElementById("btnRunAll");
  if (btnRunAll) btnRunAll.style.display = state.canUseDevOps ? "" : "none";
  const logsSection = document.getElementById("logsSection");
  if (logsSection) logsSection.style.display = state.canUseDevOps ? "" : "none";
  // 正式用户区：按权限最小化显示按钮，避免“看得到但用不了”的噪音。
  const bizVisibleByPerm = [
    ["btnBizAddProduct", ["stock:write", "product:write"]],
    ["btnBizPurchase", "purchase:write"],
    ["btnBizSales", "sales:write"],
    ["btnBizPending", ["purchase:approve", "sales:approve"]],
    ["btnBizSubmit", ["purchase:submit", "sales:submit"]],
    ["btnBizApprove", ["purchase:approve", "sales:approve"]],
    ["btnBizReceipt", "sales:write"],
    ["btnBizPayment", "purchase:write"],
    ["btnBizRefresh", ["product:read", "sales:read", "purchase:read", "stock:read", "*"]]
  ];
  bizVisibleByPerm.forEach(([id, perm]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ok = Array.isArray(perm) ? perm.some((p) => hasPermission(p)) : hasPermission(perm);
    el.style.display = ok ? "" : "none";
  });
  const navVisibleByPerm = [
    ["navCreate", ["purchase:write", "sales:write", "stock:write", "product:write"]],
    ["navApproval", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["navAr", "sales:read"],
    ["navAp", "purchase:read"],
    ["navProducts", "product:read"],
    ["navJournals", "purchase:read"],
    ["navTrend", "stock:read"],
    ["navAudit", "*"],
    ["navAlerts", "*"]
  ];
  navVisibleByPerm.forEach(([id, perm]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ok = Array.isArray(perm) ? perm.some((p) => hasPermission(p)) : hasPermission(perm);
    el.style.display = ok ? "block" : "none";
  });
  const bizParamsGroup = document.getElementById("bizParamsGroup");
  const bizActionsGroup = document.getElementById("bizActionsGroup");
  const canCreateOrder = hasPermission("purchase:write") || hasPermission("sales:write");
  if (bizParamsGroup) bizParamsGroup.style.display = canCreateOrder ? "" : "none";
  const hasVisibleBizAction = ["btnBizAddProduct", "btnBizPurchase", "btnBizSales", "btnBizPending", "btnBizSubmit", "btnBizApprove", "btnBizReceipt", "btnBizPayment", "btnBizRefresh"].some((id) => {
    const el = document.getElementById(id);
    return el && el.style.display !== "none";
  });
  if (bizActionsGroup) bizActionsGroup.style.display = hasVisibleBizAction ? "" : "none";
  const activePanelId = Object.entries(panels).find(([, panel]) => panel.classList.contains("active"))?.[0];
  const activeNav = moduleNavButtons.find((btn) => btn.dataset.panel === activePanelId);
  if (!activeNav || activeNav.style.display === "none") {
    setActivePanel(getFirstVisibleNavPanel());
  }
  const panelId = Object.entries(panels).find(([, panel]) => panel.classList.contains("active"))?.[0] || "panelProducts";
  syncBizParamsHint(panelId);
  if (bizParamsWorkbench) {
    bizParamsWorkbench.style.display = canCreateOrder && panelId === "panelCreate" ? "" : "none";
  }
  applyRolePreferredBizButtons();
  applyRolePreferredParamCards();
  syncApprovalContextLabel();
  syncApprovalViewLabel();
  syncApprovalSelectedIdHint();
  renderRoleTodoFocus();
}

function paginate(key, rows) {
  const state = pagerState[key];
  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);
  renderPager(key, rows.length, totalPages);
  return pageRows;
}

function renderPager(key, totalItems, totalPages) {
  const state = pagerState[key];
  const root = pagers[key];
  root.innerHTML = "";
  const prev = document.createElement("button");
  prev.textContent = "上一页";
  prev.disabled = state.page <= 1;
  prev.onclick = () => {
    state.page -= 1;
    rerenderFromCache(key);
  };
  const next = document.createElement("button");
  next.textContent = "下一页";
  next.disabled = state.page >= totalPages;
  next.onclick = () => {
    state.page += 1;
    rerenderFromCache(key);
  };
  const info = document.createElement("span");
  info.className = "muted";
  const names = { products: "商品", ar: "应收", ap: "应付", journals: "凭证", audit: "审计", alerts: "告警" };
  info.textContent = `${names[key]} 第 ${state.page}/${totalPages} 页（共 ${totalItems} 条）`;
  root.appendChild(prev);
  root.appendChild(next);
  root.appendChild(info);
}

function downloadCsv(filename, rows, columns) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = columns.map((c) => esc(c.label)).join(",");
  const lines = rows.map((r) => columns.map((c) => esc(c.getter(r))).join(","));
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ensureToken() {
  if (!state.token) throw new Error("请先登录。");
}

function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(path, { ...options, headers }).then(async (res) => {
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const details = body.issues ? ` | ${body.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : "";
      throw new Error((body.message || `HTTP ${res.status}`) + details);
    }
    return body;
  });
}

function makeNo(prefix) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${y}${m}${day}-${rnd}`;
}

function inputText(id) {
  const el = document.getElementById(id);
  return (el?.value || "").trim();
}

function inputNum(id) {
  const raw = inputText(id);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function selectNum(id) {
  const el = document.getElementById(id);
  const raw = (el?.value || "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function setIfEmpty(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.value && val != null) el.value = String(val);
}

function renderSelectOptions(selectId, rows, labelKey = "name") {
  const el = document.getElementById(selectId);
  if (!el) return;
  const current = el.value;
  const entityText = selectId.includes("Supplier") ? "供应商" : "客户";
  const options = [`<option value="">选择${entityText}</option>`, `<option value="__add_new__">+ 新增${entityText}</option>`];
  rows.forEach((r) => {
    options.push(`<option value="${r.id}">${r.code || ""} ${r[labelKey] || ""}（ID:${r.id}）</option>`);
  });
  el.innerHTML = options.join("");
  if (current && current !== "__add_new__") el.value = current;
  updateSelectVisualState(selectId);
}

function updateSelectVisualState(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const hasValue = Boolean((el.value || "").trim());
  const requiredSelectIds = new Set(["poSupplierPick", "poProductPick", "soCustomerPick", "soProductPick", "rcCustomerPick", "pySupplierPick"]);
  const isRequired = requiredSelectIds.has(selectId);
  el.classList.toggle("has-value", hasValue);
  el.classList.toggle("placeholder", !hasValue);
  el.classList.toggle("required-empty", isRequired && !hasValue);
  const chipMap = {
    poSupplierPick: "chipPoSupplierPick",
    poProductPick: "chipPoProductPick",
    soCustomerPick: "chipSoCustomerPick",
    soProductPick: "chipSoProductPick",
    rcCustomerPick: "chipRcCustomerPick",
    pySupplierPick: "chipPySupplierPick",
    rcArPick: "chipRcArPick",
    pyApPick: "chipPyApPick"
  };
  const chipId = chipMap[selectId];
  if (chipId) {
    const chip = document.getElementById(chipId);
    if (chip) chip.classList.toggle("visible", hasValue);
  }
}

async function refreshPartyPicks() {
  if (!state.token) return;
  try {
    const [suppliers, customers, products] = await Promise.all([api("/api/suppliers"), api("/api/customers"), api("/api/products")]);
    masterPickCache.suppliers = sortByIdDesc(suppliers || []);
    masterPickCache.customers = sortByIdDesc(customers || []);
    masterPickCache.products = products || [];
    renderSelectOptions("poSupplierPick", masterPickCache.suppliers);
    renderSelectOptions("pySupplierPick", masterPickCache.suppliers);
    renderSelectOptions("soCustomerPick", masterPickCache.customers);
    renderSelectOptions("rcCustomerPick", masterPickCache.customers);
    const productOptions = ['<option value="">选择商品</option>'];
    masterPickCache.products.forEach((r) => {
      productOptions.push(`<option value="${r.id}">${r.sku || ""} ${r.name || ""}（ID:${r.id}）</option>`);
    });
    const poProductPick = document.getElementById("poProductPick");
    const soProductPick = document.getElementById("soProductPick");
    if (poProductPick) poProductPick.innerHTML = productOptions.join("");
    if (soProductPick) soProductPick.innerHTML = productOptions.join("");
    updateSelectVisualState("poProductPick");
    updateSelectVisualState("soProductPick");
    renderPurchaseAutoHint();
    await refreshSettlementPicks();
  } catch (_e) {
    // ignore on roles without supplier/customer read permission
  }
}

async function refreshSettlementPicks() {
  if (!state.token) return;
  try {
    const [arRows, apRows] = await Promise.all([api("/api/ar/invoices"), api("/api/ap/bills")]);
    const arSelect = document.getElementById("rcArPick");
    const apSelect = document.getElementById("pyApPick");
    if (arSelect) {
      const curr = arSelect.value;
      const opts = ['<option value="">自动匹配未结应收</option>'];
      (arRows || []).forEach((r) => {
        const open = Number(r.totalAmount || 0) - Number(r.receivedAmount || 0);
        opts.push(`<option value="${r.id}">${r.invoiceNo || `AR-${r.id}`} | 客户:${r.customerName || "-"} | 未收:${open.toFixed(2)}</option>`);
      });
      arSelect.innerHTML = opts.join("");
      if (curr) arSelect.value = curr;
      updateSelectVisualState("rcArPick");
    }
    if (apSelect) {
      const curr = apSelect.value;
      const opts = ['<option value="">自动匹配未结应付</option>'];
      (apRows || []).forEach((r) => {
        const open = Number(r.totalAmount || 0) - Number(r.paidAmount || 0);
        opts.push(`<option value="${r.id}">${r.billNo || `AP-${r.id}`} | 供应商:${r.supplierName || "-"} | 未付:${open.toFixed(2)}</option>`);
      });
      apSelect.innerHTML = opts.join("");
      if (curr) apSelect.value = curr;
      updateSelectVisualState("pyApPick");
    }
  } catch (_e) {
    // ignore by permission
  }
}

function syncTxnFormDefaults() {
  const poSupplierPick = document.getElementById("poSupplierPick");
  if (poSupplierPick && !poSupplierPick.value && state.supplierId) poSupplierPick.value = String(state.supplierId);
  if (poSupplierPick) poSupplierPick.dataset.prevValue = poSupplierPick.value || "";
  const pySupplierPick = document.getElementById("pySupplierPick");
  if (pySupplierPick && !pySupplierPick.value && state.supplierId) pySupplierPick.value = String(state.supplierId);
  if (pySupplierPick) pySupplierPick.dataset.prevValue = pySupplierPick.value || "";
  const soCustomerPick = document.getElementById("soCustomerPick");
  if (soCustomerPick && !soCustomerPick.value && state.customerId) soCustomerPick.value = String(state.customerId);
  if (soCustomerPick) soCustomerPick.dataset.prevValue = soCustomerPick.value || "";
  const rcCustomerPick = document.getElementById("rcCustomerPick");
  if (rcCustomerPick && !rcCustomerPick.value && state.customerId) rcCustomerPick.value = String(state.customerId);
  if (rcCustomerPick) rcCustomerPick.dataset.prevValue = rcCustomerPick.value || "";
  renderPurchaseAutoHint();
  renderSalesPreviewHint();
  renderReceiptPreviewHint();
  renderPaymentPreviewHint();
}

function renderPurchaseAutoHint() {
  const el = document.getElementById("poAutoHint");
  if (!el) return;
  const supplierText = document.getElementById("poSupplierPick")?.selectedOptions?.[0]?.textContent?.trim() || "";
  const productText = document.getElementById("poProductPick")?.selectedOptions?.[0]?.textContent?.trim() || "";
  const qty = inputNum("poQty");
  const price = inputNum("poPrice");
  const hasSupplier = Boolean(selectNum("poSupplierPick"));
  const hasProduct = Boolean(selectNum("poProductPick"));
  const missing = [];
  if (!hasSupplier) missing.push("供应商");
  if (!hasProduct) missing.push("商品");
  if (!(qty > 0)) missing.push("数量");
  if (!(price >= 0)) missing.push("单价");
  if (missing.length) {
    el.textContent = `待完善：${missing.join(" / ")}`;
    return;
  }
  el.textContent = `已自动带入：${supplierText || "供应商"}，${productText || "商品"}。可直接点击确定创建。`;
}

function renderSalesPreviewHint() {
  const el = document.getElementById("soPreviewHint");
  if (!el) return;
  const customer = document.getElementById("soCustomerPick")?.selectedOptions?.[0]?.textContent?.trim() || "-";
  const product = document.getElementById("soProductPick")?.selectedOptions?.[0]?.textContent?.trim() || "-";
  const qty = Number(inputNum("soQty") || 0);
  const price = Number(inputNum("soPrice") || 0);
  const total = qty > 0 && price >= 0 ? qty * price : 0;
  el.textContent = `预览：客户 ${customer}；商品 ${product}；数量 ${qty || "-"}；单价 ${price || "-"}；金额 ${total ? total.toFixed(2) : "-"}`;
}

function renderReceiptPreviewHint() {
  const el = document.getElementById("rcPreviewHint");
  if (!el) return;
  const customer = document.getElementById("rcCustomerPick")?.selectedOptions?.[0]?.textContent?.trim() || "-";
  const ar = document.getElementById("rcArPick")?.selectedOptions?.[0]?.textContent?.trim() || "自动匹配未结应收";
  const amount = Number(inputNum("rcAmount") || 0);
  el.textContent = `预览：客户 ${customer}；应收 ${ar}；收款金额 ${amount ? amount.toFixed(2) : "-"}`;
}

function renderPaymentPreviewHint() {
  const el = document.getElementById("pyPreviewHint");
  if (!el) return;
  const supplier = document.getElementById("pySupplierPick")?.selectedOptions?.[0]?.textContent?.trim() || "-";
  const ap = document.getElementById("pyApPick")?.selectedOptions?.[0]?.textContent?.trim() || "自动匹配未结应付";
  const amount = Number(inputNum("pyAmount") || 0);
  el.textContent = `预览：供应商 ${supplier}；应付 ${ap}；付款金额 ${amount ? amount.toFixed(2) : "-"}`;
}

function showPickOptionHint(text) {
  const el = document.getElementById("pickOptionHint");
  if (!el) return;
  if (!text) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.style.display = "";
}

function hidePickOptionHint() {
  const el = document.getElementById("pickOptionHint");
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
}

function focusFirst(ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      return;
    }
  }
}

function renderPreviewBySelectId(selectId) {
  if (selectId === "poSupplierPick" || selectId === "poProductPick") {
    renderPurchaseAutoHint();
    return;
  }
  if (selectId === "soCustomerPick" || selectId === "soProductPick") {
    renderSalesPreviewHint();
    return;
  }
  if (selectId === "rcCustomerPick" || selectId === "rcArPick") {
    renderReceiptPreviewHint();
    return;
  }
  if (selectId === "pySupplierPick" || selectId === "pyApPick") {
    renderPaymentPreviewHint();
  }
}

function listSelectOptions(selectId, label, maxCount = 6) {
  const el = document.getElementById(selectId);
  if (!el) return 0;
  const options = Array.from(el.options || [])
    .filter((o) => {
      const v = String(o.value || "").trim();
      return v !== "" && v !== "__add_new__";
    })
    .map((o) => String(o.textContent || "").trim())
    .filter(Boolean);
  if (!options.length) {
    showPickOptionHint(`${label}：暂无可选项。`);
    return 0;
  }
  const preview = options.slice(0, maxCount).join("；");
  const more = options.length > maxCount ? ` …共 ${options.length} 项` : "";
  showPickOptionHint(`${label}可选：${preview}${more}`);
  return options.length;
}

async function ensureAndShowPickOptions(selectId, label, loader, emptyHint) {
  let count = listSelectOptions(selectId, label);
  if (count > 0) return;
  if (typeof loader === "function") {
    await loader().catch(() => {});
    count = listSelectOptions(selectId, label);
  }
  if (count === 0 && emptyHint) {
    showPickOptionHint(`${label}：${emptyHint}`);
  }
}

function handleQuickAddSelect(selectId, kind, boxId, nameInputId) {
  const el = document.getElementById(selectId);
  if (!el) return false;
  if (String(el.value || "") !== "__add_new__") return false;
  closeOtherQuickPartyBoxes(boxId);
  quickAddPreviousSelectValue.set(boxId, el.dataset.prevValue || "");
  el.value = "";
  updateSelectVisualState(selectId);
  renderPreviewBySelectId(selectId);
  const typeText = kind === "supplier" ? "供应商" : "客户";
  showPickOptionHint(`正在新增${typeText}，请填写下方信息后点击确定。`);
  toggleQuickPartyBox(boxId, true, nameInputId);
  return true;
}

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const result = await api("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  state.token = result.token;
  state.username = result.user.username;
  state.role = result.user.role;
  state.canUseDevOps = false;
  try {
    const p = await api("/api/auth/permissions");
    state.permissions = p.permissions || [];
    state.canUseDevOps = Boolean(p.devOpsEnabled);
  } catch (_e) {
    state.permissions = [];
    state.canUseDevOps = false;
  }
  loginStatus.textContent = `已登录：${result.user.username}（${zhRole(result.user.role)}）`;
  loginStatus.className = "ok";
  if (loginFormStatus) {
    loginFormStatus.textContent = "登录成功，正在进入系统...";
    loginFormStatus.className = "ok";
  }
  setAuthenticatedUi(true);
  persistSession();
  applyRoleUi();
  jumpToRoleDefaultPanel();
  syncTxnFormDefaults();
  await refreshPartyPicks();
  notificationCursor = 0;
  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = setInterval(() => {
    pollNotifications().catch(() => {});
  }, 15000);
  await pollNotifications().catch(() => {});
  // 登录后默认把各栏目数据都刷新好，避免逐栏手动点刷新。
  await refreshAll({ source: "login" }).catch((e) => log("自动刷新失败", e.message || String(e)));
  if (dashboardTimer) clearInterval(dashboardTimer);
  dashboardTimer = setInterval(() => {
    refreshAll({ source: "auto" }).catch(() => {});
  }, 30000);
  log("登录", result.user);
}

async function seedMasterData() {
  ensureToken();
  const tasks = [
    api("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "SUP001", name: "Default Supplier" })
    }).catch((e) => ({ warning: e.message })),
    api("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "CUS001", name: "Default Customer" })
    }).catch((e) => ({ warning: e.message })),
    api("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "SKU001", name: "Demo Product", unit: "pcs", costPrice: 10, salePrice: 15 })
    }).catch((e) => ({ warning: e.message }))
  ];
  const created = await Promise.all(tasks);

  const suppliers = await api("/api/suppliers");
  const customers = await api("/api/customers");
  const products = await api("/api/products");
  state.supplierId = suppliers.find((x) => x.code === "SUP001")?.id || 1;
  state.customerId = customers.find((x) => x.code === "CUS001")?.id || 1;
  state.productId = products.find((x) => x.sku === "SKU001")?.id || 1;
  syncTxnFormDefaults();
  await refreshPartyPicks();
  log("主数据", { created, supplierId: state.supplierId, customerId: state.customerId, productId: state.productId });
}

async function createPurchase() {
  ensureToken();
  const orderNo = inputText("poOrderNo") || makeNo("PO");
  const supplierId = selectNum("poSupplierPick");
  const productId = selectNum("poProductPick");
  const qty = inputNum("poQty") ?? 100;
  const price = inputNum("poPrice") ?? 10;
  if (!supplierId) {
    showPickOptionHint("采购单：请先选择供应商。");
    focusFirst(["poSupplierPick"]);
    throw new Error("采购参数无效：请先选择供应商。");
  }
  if (!productId) {
    showPickOptionHint("采购单：请先选择商品。");
    focusFirst(["poProductPick"]);
    throw new Error("采购参数无效：请先选择商品。");
  }
  if (!supplierId || !productId || qty <= 0 || price < 0) {
    throw new Error("采购参数无效：请检查供应商ID、商品ID、数量、单价。");
  }
  const created = await api("/api/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderNo,
      supplierId,
      items: [{ productId, qty, price }]
    })
  });
  let submitted = null;
  if (document.getElementById("chkAutoSubmitAfterCreate")?.checked) {
    submitted = await api(`/api/purchase-orders/${created.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", comment: "控制台提交" })
    });
  }
  state.apBillId = null;
  if (hasPermission("purchase:read")) {
    try {
      await loadPurchaseApprovals();
    } catch (e) {
      log("审批列表", e.message || String(e));
    }
  }
  await refreshSettlementPicks();
  log("采购单", {
    created,
    submitted,
    hint: submitted
      ? "已按勾选自动「提交」，状态为已提交；仍未自动审批。请在「我的待审批」或下方点「通过」后再做付款演示。"
      : "状态为「草稿」。可勾选左侧「创建后自动提交」；否则请「加载采购单」点选行后在下方点「提交」→「通过」；通过后才有应付单。"
  });
}

async function createSales() {
  ensureToken();
  const orderNo = inputText("soOrderNo") || makeNo("SO");
  const customerId = selectNum("soCustomerPick");
  const productId = selectNum("soProductPick");
  const qty = inputNum("soQty") ?? 20;
  const price = inputNum("soPrice") ?? 15;
  if (!customerId) {
    showPickOptionHint("销售单：请先选择客户。");
    focusFirst(["soCustomerPick"]);
    throw new Error("销售参数无效：请先选择客户。");
  }
  if (!productId) {
    showPickOptionHint("销售单：请先选择商品。");
    focusFirst(["soProductPick"]);
    throw new Error("销售参数无效：请先选择商品。");
  }
  if (!customerId || !productId || qty <= 0 || price < 0) {
    throw new Error("销售参数无效：请检查客户ID、商品ID、数量、单价。");
  }
  const created = await api("/api/sales-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderNo,
      customerId,
      items: [{ productId, qty, price }]
    })
  });
  let submitted = null;
  if (document.getElementById("chkAutoSubmitAfterCreate")?.checked) {
    submitted = await api(`/api/sales-orders/${created.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", comment: "控制台提交" })
    });
  }
  state.arInvoiceId = null;
  if (hasPermission("sales:read")) {
    try {
      await loadSalesApprovals();
    } catch (e) {
      log("审批列表", e.message || String(e));
    }
  }
  await refreshSettlementPicks();
  log("销售单", {
    created,
    submitted,
    hint: submitted
      ? "已按勾选自动「提交」；仍未自动审批。请「我的待审批」或下方「通过」后再做收款演示。"
      : "状态为「草稿」。可勾选左侧「创建后自动提交」；否则请「加载销售单」点选行后点「提交」→「通过」；通过后才有应收单。"
  });
}

async function createReceipt() {
  ensureToken();
  const receiptNo = inputText("rcNo") || makeNo("RC");
  const customerId = selectNum("rcCustomerPick");
  const amount = inputNum("rcAmount") ?? 100;
  if (!customerId) {
    showPickOptionHint("收款单：请先选择客户。");
    focusFirst(["rcCustomerPick"]);
    throw new Error("收款参数无效：请先选择客户。");
  }
  const arFromInput = inputNum("rcArInvoiceId");
  if (arFromInput) state.arInvoiceId = arFromInput;
  if (!state.arInvoiceId) {
    const rows = await api("/api/ar/invoices");
    const open = rows.find((x) => Number(x.totalAmount) > Number(x.receivedAmount));
    state.arInvoiceId = open?.id || null;
  }
  if (!state.arInvoiceId) throw new Error("请先创建并审批销售单，或在参数里填写应收ID。");
  if (!customerId || amount <= 0) throw new Error("收款参数无效：请检查客户ID与金额。");
  const result = await api("/api/finance/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      receiptNo,
      customerId,
      arInvoiceId: state.arInvoiceId,
      amount
    })
  });
  log("收款单", result);
}

async function createPayment() {
  ensureToken();
  const paymentNo = inputText("pyNo") || makeNo("PY");
  const supplierId = selectNum("pySupplierPick");
  const amount = inputNum("pyAmount") ?? 200;
  if (!supplierId) {
    showPickOptionHint("付款单：请先选择供应商。");
    focusFirst(["pySupplierPick"]);
    throw new Error("付款参数无效：请先选择供应商。");
  }
  const apFromInput = inputNum("pyApBillId");
  if (apFromInput) state.apBillId = apFromInput;
  if (!state.apBillId) {
    const rows = await api("/api/ap/bills");
    const open = rows.find((x) => Number(x.totalAmount) > Number(x.paidAmount));
    state.apBillId = open?.id || null;
  }
  if (!state.apBillId) throw new Error("请先创建并审批采购单，或在参数里填写应付ID。");
  if (!supplierId || amount <= 0) throw new Error("付款参数无效：请检查供应商ID与金额。");
  const result = await api("/api/finance/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentNo,
      supplierId,
      apBillId: state.apBillId,
      amount
    })
  });
  log("付款单", result);
}

async function queryProducts() {
  ensureToken();
  const rows = await api("/api/products");
  cache.products = rows;
  pagerState.products.page = 1;
  rerenderFromCache("products");
  updateKpis();
  log("商品列表", rows);
}

async function addProductFromForm() {
  ensureToken();
  const sku = document.getElementById("newProductSku").value.trim();
  const name = document.getElementById("newProductName").value.trim();
  const unit = document.getElementById("newProductUnit").value.trim() || "pcs";
  const costPrice = Number(document.getElementById("newProductCost").value);
  const salePrice = Number(document.getElementById("newProductSale").value);
  if (sku.length < 2 || name.length < 2) throw new Error("SKU 与名称至少 2 个字符。");
  if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error("请填写有效的成本价（≥0）。");
  if (!Number.isFinite(salePrice) || salePrice < 0) throw new Error("请填写有效的销售价（≥0）。");
  const created = await api("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, name, unit, costPrice, salePrice })
  });
  log("新增商品", created);
  document.getElementById("newProductSku").value = "";
  document.getElementById("newProductName").value = "";
  document.getElementById("newProductUnit").value = "";
  document.getElementById("newProductCost").value = "";
  document.getElementById("newProductSale").value = "";
  await queryProducts();
  state.productId = created.id;
}

async function loadPurchaseApprovals() {
  ensureToken();
  approvalType = "purchase";
  currentApprovalView = "purchase";
  const rows = await api("/api/purchase-orders");
  approvalRowsKind = "purchase";
  approvalRowsCache = rows;
  const idInput = document.getElementById("approvalOrderId");
  if (idInput) idInput.value = "";
  syncApprovalSelectedIdHint();
  setRejectInputVisible(false);
  void enrichApprovalRejectSummaries(approvalRowsCache, "purchase");
  setApprovalStatusFilter("draft");
  setApprovalQuickFilterDefault();
  renderApprovalTableFromCache();
  log("审批-采购单", rows);
  syncApprovalContextLabel();
  syncApprovalViewLabel();
  renderRoleTodoFocus();
}

async function loadSalesApprovals() {
  ensureToken();
  approvalType = "sales";
  currentApprovalView = "sales";
  const rows = await api("/api/sales-orders");
  approvalRowsKind = "sales";
  approvalRowsCache = rows;
  const idInput = document.getElementById("approvalOrderId");
  if (idInput) idInput.value = "";
  syncApprovalSelectedIdHint();
  setRejectInputVisible(false);
  void enrichApprovalRejectSummaries(approvalRowsCache, "sales");
  setApprovalStatusFilter("draft");
  setApprovalQuickFilterDefault();
  renderApprovalTableFromCache();
  log("审批-销售单", rows);
  syncApprovalContextLabel();
  syncApprovalViewLabel();
  renderRoleTodoFocus();
}

async function loadPendingApprovals() {
  ensureToken();
  currentApprovalView = "pending";
  const rows = await api("/api/approvals/pending");
  approvalRowsKind = "pending";
  approvalRowsCache = rows;
  const idInput = document.getElementById("approvalOrderId");
  if (idInput) idInput.value = "";
  syncApprovalSelectedIdHint();
  setRejectInputVisible(false);
  void enrichApprovalRejectSummaries(approvalRowsCache, approvalType);
  setApprovalStatusFilter("all");
  setApprovalQuickFilterDefault();
  renderApprovalTableFromCache();
  log("审批-我的待审批", rows);
  syncApprovalContextLabel("mixed");
  syncApprovalViewLabel();
  renderRoleTodoFocus();
}

async function loadRoleApprovalWorkspace() {
  if (!state.token) return;
  if (hasPermission("purchase:approve") || hasPermission("sales:approve")) {
    await loadPendingApprovals();
    return;
  }
  if (state.role === "sales" && hasPermission("sales:read")) {
    await loadSalesApprovals();
    return;
  }
  if (state.role === "purchase" && hasPermission("purchase:read")) {
    await loadPurchaseApprovals();
    return;
  }
  if (hasPermission("purchase:read")) {
    await loadPurchaseApprovals();
    return;
  }
  if (hasPermission("sales:read")) {
    await loadSalesApprovals();
  }
}

function selectApprovalRow(orderType, row) {
  const idInput = document.getElementById("approvalOrderId");
  if (idInput) idInput.value = String(row.id ?? "");
  approvalType = orderType === "sales" ? "sales" : "purchase";
  syncApprovalContextLabel();
  syncApprovalSelectedIdHint();
  approvalDetail.textContent = "正在加载表头与明细…";
  void loadApprovalOrderDetail(orderType, row.id);
}

async function loadApprovalOrderDetail(orderType, id) {
  const oid = Number(id);
  if (!Number.isFinite(oid) || oid <= 0) {
    approvalDetail.textContent = "无效的单据 ID。";
    return;
  }
  const path = orderType === "sales" ? `/api/sales-orders/${oid}` : `/api/purchase-orders/${oid}`;
  try {
    const data = await api(path);
    const timeline = await api(`/api/approvals/${orderType}/${oid}/timeline`).catch(() => []);
    const rejectMeta = extractLatestRejectMeta(timeline);
    approvalDetail.textContent = orderType === "sales" ? formatSoDetail(data, rejectMeta) : formatPoDetail(data, rejectMeta);
  } catch (e) {
    const typeText = orderType === "sales" ? "销售单" : "采购单";
    approvalDetail.textContent = [
      `【${typeText}详情加载失败】`,
      `单据ID：${oid}`,
      `原因：${e.message || e}`,
      "可尝试：先点击“加载采购单/销售单”刷新列表后重试。"
    ].join("\n");
  }
}

function renderApprovalSlaCards(data) {
  const blocks = [];
  if (data.purchase) {
    blocks.push(
      `<div class="card" style="padding:8px;min-width:190px;">
        <div class="muted">采购审批</div>
        <div>待审批：<b>${data.purchase.pendingCount}</b></div>
        <div>超时24h：<b>${data.purchase.overdue24hCount}</b></div>
        <div>平均审批时长：<b>${data.purchase.avgApproveHours ?? "-"}h</b></div>
      </div>`
    );
  }
  if (data.sales) {
    blocks.push(
      `<div class="card" style="padding:8px;min-width:190px;">
        <div class="muted">销售审批</div>
        <div>待审批：<b>${data.sales.pendingCount}</b></div>
        <div>超时24h：<b>${data.sales.overdue24hCount}</b></div>
        <div>平均审批时长：<b>${data.sales.avgApproveHours ?? "-"}h</b></div>
      </div>`
    );
  }
  approvalSlaCards.innerHTML = blocks.join("");
}

async function loadApprovalSla() {
  ensureToken();
  const data = await api("/api/approvals/sla-dashboard");
  renderApprovalSlaCards(data);
  log("审批-SLA看板", data);
}

async function loadOverdueApprovals() {
  ensureToken();
  const rows = await api("/api/approvals/overdue?hours=24");
  renderTable(approvalOverdueTable, rows, [
    { label: "类型", getter: (r) => zhOrderType(r.orderType) },
    { label: "ID", getter: (r) => r.id },
    { label: "单号", getter: (r) => r.orderNo },
    { label: "金额", getter: (r) => r.totalAmount },
    { label: "提交时间", getter: (r) => r.submittedAt || "-" }
  ]);
  log("审批-超时待办", rows);
}

async function loadApprovalTimeline() {
  ensureToken();
  const id = Number(document.getElementById("approvalOrderId").value.trim());
  if (!Number.isFinite(id) || id <= 0) throw new Error("请输入有效单据ID");
  const rows = await api(`/api/approvals/${approvalType}/${id}/timeline`);
  if (!rows.length) {
    approvalTimeline.innerHTML = "<div class='muted'>暂无审批轨迹。</div>";
  } else {
    approvalTimeline.innerHTML = `<ul class="timeline">${rows
      .map(
        (r) =>
          `<li><div><b>${zhApprovalAction(r.action)}</b></div><div class="meta">${r.createdAt} · ${r.username || "system"}</div>${
            r.detail ? `<div class="meta">${r.detail}</div>` : ""
          }</li>`
      )
      .join("")}</ul>`;
  }
  log("审批-时间线", rows);
}

async function doApprovalAction(action) {
  ensureToken();
  const id = Number(document.getElementById("approvalOrderId").value.trim());
  if (!Number.isFinite(id) || id <= 0) {
    const msg = "请先在审批列表中点击一条单据。";
    showActionWarn(msg);
    showApprovalActionHint(msg);
    throw new Error(msg);
  }
  const commentInput = document.getElementById("approvalComment");
  const comment = commentInput?.value.trim() || "";
  if (action === "reject" && !comment) {
    setActivePanel("panelApproval");
    setRejectInputVisible(true);
    if (commentInput) {
      commentInput.focus();
      commentInput.placeholder = "驳回必须填写审批意见";
      commentInput.style.borderColor = "var(--danger)";
      setTimeout(() => {
        commentInput.style.borderColor = "";
      }, 1500);
    }
    const msg = "驳回前请先填写审批意见，再点击“驳回”。";
    showActionWarn(msg);
    showApprovalActionHint(msg);
    throw new Error(msg);
  }
  const orderType = approvalType === "sales" ? "sales" : "purchase";
  const needed = actionPermissionClient(orderType, action);
  if (!hasPermission(needed)) {
    throw new Error(`当前角色无权限执行「${zhApprovalAction(action)}」：缺少 ${needed}`);
  }
  const currentStatus = await resolveOrderStatus(orderType, id);
  if (action === "void" && currentStatus && currentStatus !== "draft") {
    const msg = `仅草稿状态可作废。当前状态：${zhOrderStatus(currentStatus)}。`;
    showActionWarn(msg);
    showApprovalActionHint(msg);
    throw new Error(msg);
  }
  if (currentStatus && !canTransitionOrderClient(currentStatus, action)) {
    const msg = `当前单据状态为「${zhOrderStatus(currentStatus)}」，不可执行「${zhApprovalAction(action)}」。请先切换到可执行状态。`;
    showActionWarn(msg);
    showApprovalActionHint(msg);
    throw new Error(msg);
  }
  const route = approvalType === "purchase" ? `/api/purchase-orders/${id}/action` : `/api/sales-orders/${id}/action`;
  const res = await api(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, comment })
  });
  log(`审批动作-${approvalType}-${action}`, res);
  if (action === "reject") {
    const nextStatusText = zhOrderStatus(res?.nextStatus || "draft");
    log("审批提示", `单据已驳回并回到「${nextStatusText}」，可修改后再次提交。`);
    showApprovalActionHint(`已驳回，当前状态：${nextStatusText}。`);
    if (String(res?.nextStatus || "") === "draft") {
      if (notificationBar && /已从待审批移至草稿列表/.test(String(notificationBar.textContent || ""))) {
        notificationBar.textContent = "通知：暂无新消息";
      }
      if (orderType === "sales") {
        await loadSalesApprovals();
      } else {
        await loadPurchaseApprovals();
      }
      const idInput = document.getElementById("approvalOrderId");
      if (idInput) idInput.value = String(id);
      syncApprovalSelectedIdHint();
      setRejectInputVisible(false);
      await loadApprovalOrderDetail(orderType, id);
      return;
    }
  }
  if (action !== "reject") setRejectInputVisible(false);
  await loadPendingApprovals();
  await loadApprovalOrderDetail(approvalType, id);
}

function copyApprovalDetailCurl() {
  const id = document.getElementById("approvalOrderId").value.trim();
  if (!state.token) {
    log("提示", "请先登录。");
    return;
  }
  if (!id) {
    log("提示", "请先在审批列表中点击一条单据。");
    return;
  }
  const path = approvalType === "sales" ? "sales-orders" : "purchase-orders";
  const base = window.location.origin.replace(/\/$/, "");
  const curl = `curl -sS -H "Authorization: Bearer ${state.token}" "${base}/api/${path}/${id}"`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(curl)
      .then(() => log("已复制（含 Token，勿外传）", curl))
      .catch(() => log("复制失败，请手工复制", curl));
  } else {
    log("请手工复制", curl);
  }
}

function bind(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", async () => {
    try {
      await fn();
    } catch (err) {
      const msg = err?.message || String(err);
      if (id === "btnLogin" && loginFormStatus) {
        loginFormStatus.textContent = msg;
        loginFormStatus.className = "warn";
      }
      const approvalActionIds = new Set([
        "btnSubmitApproval",
        "btnApproveApproval",
        "btnRejectApproval",
        "btnConfirmRejectInput",
        "btnVoidApproval",
        "btnReverseApproval"
      ]);
      if (approvalActionIds.has(id)) showApprovalActionHint(msg);
      log("错误", msg);
    }
  });
}

function renderProductsFromCache() {
  const rows = cache.products;
  const filtered = rows.filter((r) => textMatch(r, ["sku", "name"], filters.products.value.trim()));
  const pageRows = paginate("products", filtered);
  renderTable(
    tableTargets.products,
    pageRows,
    [
      { label: "ID", getter: (r) => r.id },
      { label: "SKU", getter: (r) => r.sku },
      { label: "名称", getter: (r) => r.name },
      { label: "单位", getter: (r) => r.unit },
      { label: "库存", getter: (r) => r.stockQty },
      { label: "成本价", getter: (r) => r.costPrice },
      { label: "销售价", getter: (r) => r.salePrice }
    ],
    {
      clickable: true,
      onRowClick: (row) => {
        if (productDetail) productDetail.textContent = formatProductDetail(row);
      }
    }
  );
}
async function queryAr() {
  ensureToken();
  const rows = await api("/api/ar/invoices");
  cache.ar = rows;
  pagerState.ar.page = 1;
  rerenderFromCache("ar");
  updateKpis();
  log("应收发票", rows);
  renderRoleTodoFocus();
}
function renderArFromCache() {
  const rows = cache.ar;
  const filtered = rows.filter((r) =>
    textMatchEx(r, ["invoiceNo", "customerName", "status"], filters.ar.value.trim(), [(row) => zhArApStatus(row.status)])
  );
  const pageRows = paginate("ar", filtered);
  renderTable(
    tableTargets.ar,
    pageRows,
    [
      { label: "ID", getter: (r) => r.id },
      { label: "发票号", getter: (r) => r.invoiceNo },
      { label: "客户", getter: (r) => r.customerName },
      { label: "总金额", getter: (r) => r.totalAmount },
      { label: "已收金额", getter: (r) => r.receivedAmount },
      { label: "状态", getter: (r) => zhArApStatus(r.status) }
    ],
    {
      clickable: true,
      onRowClick: (row) => {
        if (arDetail) arDetail.textContent = formatArInvoiceDetail(row);
      }
    }
  );
}
async function queryAp() {
  ensureToken();
  const rows = await api("/api/ap/bills");
  cache.ap = rows;
  pagerState.ap.page = 1;
  rerenderFromCache("ap");
  updateKpis();
  log("应付账单", rows);
  renderRoleTodoFocus();
}
function renderApFromCache() {
  const rows = cache.ap;
  const filtered = rows.filter((r) =>
    textMatchEx(r, ["billNo", "supplierName", "status"], filters.ap.value.trim(), [(row) => zhArApStatus(row.status)])
  );
  const pageRows = paginate("ap", filtered);
  renderTable(
    tableTargets.ap,
    pageRows,
    [
      { label: "ID", getter: (r) => r.id },
      { label: "账单号", getter: (r) => r.billNo },
      { label: "供应商", getter: (r) => r.supplierName },
      { label: "总金额", getter: (r) => r.totalAmount },
      { label: "已付金额", getter: (r) => r.paidAmount },
      { label: "状态", getter: (r) => zhArApStatus(r.status) }
    ],
    {
      clickable: true,
      onRowClick: (row) => {
        if (apDetail) apDetail.textContent = formatApBillDetail(row);
      }
    }
  );
}
async function queryJournals() {
  ensureToken();
  const rows = await api("/api/finance/journals");
  cache.journals = rows;
  pagerState.journals.page = 1;
  rerenderFromCache("journals");
  updateKpis();
  log("凭证列表", rows);
}
function renderJournalsFromCache() {
  const rows = cache.journals;
  const normalized = rows.map((r) => ({
    entryNo: r.entryNo,
    refType: r.refType,
    memo: r.memo,
    debit: (r.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0),
    credit: (r.lines || []).reduce((s, l) => s + Number(l.credit || 0), 0),
    createdAt: r.createdAt
  }));
  const filtered = normalized.filter((r) =>
    textMatchEx(r, ["entryNo", "refType", "memo"], filters.journals.value.trim(), [(row) => zhJournalRefType(row.refType)])
  );
  const pageRows = paginate("journals", filtered);
  renderTable(
    tableTargets.journals,
    pageRows,
    [
      { label: "凭证号", getter: (r) => r.entryNo },
      { label: "来源", getter: (r) => zhJournalRefType(r.refType) },
      { label: "摘要", getter: (r) => r.memo },
      { label: "借方", getter: (r) => r.debit },
      { label: "贷方", getter: (r) => r.credit },
      { label: "创建时间", getter: (r) => r.createdAt }
    ],
    {
      clickable: true,
      onRowClick: (row) => {
        const full = cache.journals.find((x) => x.entryNo === row.entryNo);
        journalDetail.textContent = formatJournalDetail(full ?? row);
      }
    }
  );
}

function rerenderFromCache(key) {
  if (key === "products") renderProductsFromCache();
  if (key === "ar") renderArFromCache();
  if (key === "ap") renderApFromCache();
  if (key === "journals") renderJournalsFromCache();
  if (key === "trend") renderTrendFromCache();
  if (key === "audit") renderAuditFromCache();
  if (key === "alerts") renderAlertsFromCache();
}

async function refreshAll({ source = "manual" } = {}) {
  ensureToken();
  const tasks = [];
  if (hasPermission("product:read")) tasks.push(queryProducts());
  if (hasPermission("sales:read")) tasks.push(queryAr());
  if (hasPermission("purchase:read")) tasks.push(queryAp(), queryJournals());
  if (hasPermission("stock:read")) tasks.push(queryTrend());
  if (hasPermission("*")) tasks.push(queryAudit());
  if (hasPermission("*")) tasks.push(queryAlerts());
  // 审批栏目自动刷新：优先我的待审批；否则退化到采购或销售列表。
  if (hasPermission("purchase:approve") || hasPermission("sales:approve")) {
    tasks.push(loadPendingApprovals());
    if (hasPermission("purchase:approve") || hasPermission("sales:approve")) tasks.push(loadApprovalSla());
  } else if (hasPermission("purchase:read")) {
    tasks.push(loadPurchaseApprovals());
  } else if (hasPermission("sales:read")) {
    tasks.push(loadSalesApprovals());
  }
  await Promise.all(tasks);
  if (hasPermission("stock:read")) {
    try {
      const kpi = await api("/api/finance/reports/kpi-summary");
      kpiAr.textContent = Number(kpi.openAr || 0).toFixed(2);
      kpiAp.textContent = Number(kpi.openAp || 0).toFixed(2);
      kpiStock.textContent = Number(kpi.inventoryQty ?? 0).toFixed(2);
      if (kpiStockValue) kpiStockValue.textContent = `库存成本金额 ${Number(kpi.inventoryValue || 0).toFixed(2)}`;
      kpiJe.textContent = String(kpi.journalCount || 0);
    } catch (_e) {
      // ignore summary failure, individual tables still render
    }
  }
  renderRoleTodoFocus();
  if (source === "manual") log("刷新", "看板已刷新。");
}

async function queryAudit() {
  ensureToken();
  if (!hasPermission("*")) throw new Error("仅管理员可查看审计日志。");
  const rows = await api("/api/audit-logs");
  cache.audit = rows;
  pagerState.audit.page = 1;
  rerenderFromCache("audit");
  log("审计日志", rows);
}

function renderAuditFromCache() {
  const rows = cache.audit;
  const filtered = rows.filter((r) =>
    textMatch(r, ["username", "action", "entityType", "entityId"], filters.audit.value.trim())
  );
  const pageRows = paginate("audit", filtered);
  renderTable(tableTargets.audit, pageRows, [
    { label: "时间", getter: (r) => r.createdAt },
    { label: "用户", getter: (r) => r.username || "-" },
    { label: "动作", getter: (r) => r.action },
    { label: "实体", getter: (r) => `${r.entityType}:${r.entityId || ""}` },
    { label: "详情", getter: (r) => r.detail || "" }
  ]);
}

async function queryAlerts() {
  ensureToken();
  if (!hasPermission("*")) throw new Error("仅管理员可查看告警事件。");
  const rows = await api("/api/alerts/events");
  cache.alerts = rows;
  pagerState.alerts.page = 1;
  rerenderFromCache("alerts");
  log("告警事件", rows);
}

function renderAlertsFromCache() {
  const rows = cache.alerts;
  const pageRows = paginate("alerts", rows);
  renderTable(tableTargets.alerts, pageRows, [
    { label: "时间", getter: (r) => r.createdAt },
    { label: "级别", getter: (r) => zhAlertLevel(r.level) },
    { label: "事件类型", getter: (r) => zhEventType(r.eventType) },
    { label: "实体", getter: (r) => `${r.entityType}:${r.entityId || ""}` },
    { label: "消息", getter: (r) => r.message }
  ]);
}

async function runAll() {
  try {
    output.textContent = "";
    await login();
    await seedMasterData();
    await createPurchase();
    await createSales();
    try {
      await createReceipt();
    } catch (e) {
      log("跳过收款", e.message || String(e));
    }
    try {
      await createPayment();
    } catch (e) {
      log("跳过付款", e.message || String(e));
    }
    await queryProducts();
    await queryAr();
    await queryAp();
    await queryJournals();
    if (hasPermission("*")) await queryAudit();
    log("完成", "业务流程已尽量执行。采购/销售为草稿时不会自动收付款；请在审批工作台提交并审批通过后再创建收款/付款。");
  } catch (err) {
    log("错误", err.message || String(err));
  }
}

function setActivePanel(panelId) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.panel === panelId);
  });
  moduleNavButtons.forEach((btn) => {
    btn.classList.toggle("nav-active", btn.dataset.panel === panelId);
  });
  Object.entries(panels).forEach(([id, panel]) => {
    panel.classList.toggle("active", id === panelId);
  });
  if (currentModuleTitle) currentModuleTitle.textContent = panelTitles[panelId] || "数据看板";
  persistCurrentPanel(panelId);
  if (bizParamsWorkbench) {
    const canUseParams = hasPermission("purchase:write") || hasPermission("sales:write");
    const shouldShow = canUseParams && panelId === "panelCreate";
    bizParamsWorkbench.style.display = shouldShow ? "" : "none";
  }
  syncBizParamsHint(panelId);
}

function getFirstVisibleNavPanel() {
  for (const btn of moduleNavButtons) {
    if (btn.style.display !== "none") return btn.dataset.panel;
  }
  return "panelProducts";
}

function getRolePreset() {
  return roleWorkspacePreset[state.role] || roleWorkspacePreset.admin;
}

function applyRolePreferredBizButtons() {
  const preset = getRolePreset();
  const preferred = new Set(preset.preferredBizButtons || []);
  const createButtonIds = ["btnBizAddProduct", "btnBizPurchase", "btnBizSales", "btnBizReceipt", "btnBizPayment"];
  const approvalButtonIds = ["btnBizPending", "btnBizSubmit", "btnBizApprove", "btnBizRefresh"];
  const bizActionButtons = document.getElementById("bizActionButtons");
  if (bizActionButtons) {
    createButtonIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) bizActionButtons.appendChild(el);
    });
  }
  const bizApprovalButtons = document.getElementById("bizApprovalButtons");
  if (bizApprovalButtons) {
    approvalButtonIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) bizApprovalButtons.appendChild(el);
    });
  }
  [...createButtonIds, ...approvalButtonIds].forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.style.display === "none") return;
    if (createButtonIds.includes(id)) {
      // 创建中心保持统一视觉，不做弱化区分。
      el.style.opacity = "1";
      el.style.boxShadow = "";
      return;
    }
    const focus = preferred.has(id);
    el.style.opacity = focus ? "1" : "0.72";
    el.style.boxShadow = focus ? "0 4px 14px rgba(79,140,255,.28)" : "";
  });
}

function applyRolePreferredParamCards() {
  const preset = getRolePreset();
  const preferred = new Set(preset.preferredParamCards || []);
  const allCards = ["paramCardPurchase", "paramCardSales", "paramCardReceipt", "paramCardPayment"];
  const order = [...(preset.preferredParamCards || [])];
  allCards.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });
  const grid = document.getElementById("bizParamGrid");
  if (grid) {
    order.forEach((id) => {
      const card = document.getElementById(id);
      if (card) grid.appendChild(card);
    });
  }
  const maxOpenCards = 1;
  let openCount = 0;
  allCards.forEach((id) => {
    const card = document.getElementById(id);
    if (!card) return;
    const fold = card.querySelector("details");
    if (!fold) return;
    const isPreferred = preferred.has(id);
    const shouldOpen = isPreferred && openCount < maxOpenCards;
    fold.open = shouldOpen;
    if (shouldOpen) openCount += 1;
    card.style.opacity = isPreferred ? "1" : "0.82";
  });
}

function syncBizParamsHint(panelId) {
  if (!bizParamsHint) return;
  const text = panelId === "panelCreate" ? "填写参数后点击确定创建单据" : "";
  bizParamsHint.textContent = text;
}

function openParamWorkbenchFor(cardId, focusInputId) {
  closeOtherQuickPartyBoxes("");
  const allCards = ["paramCardPurchase", "paramCardSales", "paramCardReceipt", "paramCardPayment"];
  allCards.forEach((id) => {
    const card = document.getElementById(id);
    if (!card) return;
    const fold = card.querySelector("details");
    if (!fold) return;
    fold.open = id === cardId;
  });
  const card = document.getElementById(cardId);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = document.getElementById(focusInputId);
  if (input) input.focus();
  if (cardId === "paramCardPurchase") renderPurchaseAutoHint();
}

function jumpToRoleDefaultPanel() {
  const remembered = restoreCurrentPanel();
  if (remembered && panels[remembered]) {
    const navBtnRemembered = moduleNavButtons.find((btn) => btn.dataset.panel === remembered && btn.style.display !== "none");
    if (navBtnRemembered) {
      setActivePanel(remembered);
      if (remembered === "panelApproval") void loadRoleApprovalWorkspace();
      return;
    }
  }
  const preset = getRolePreset();
  const navBtn = moduleNavButtons.find((btn) => btn.dataset.panel === preset.defaultPanel && btn.style.display !== "none");
  if (navBtn) {
    setActivePanel(preset.defaultPanel);
    if (preset.defaultPanel === "panelApproval") {
      void loadRoleApprovalWorkspace();
    }
    return;
  }
  setActivePanel(getFirstVisibleNavPanel());
}

bind("btnLogin", login);
bind("btnSwitchAccount", async () => {
  state.token = "";
  state.permissions = [];
  state.role = "";
  state.username = "";
  persistSession();
  if (dashboardTimer) clearInterval(dashboardTimer);
  if (notificationTimer) clearInterval(notificationTimer);
  loginStatus.textContent = "未登录";
  loginStatus.className = "warn";
  if (loginFormStatus) {
    loginFormStatus.textContent = "请输入账号密码登录。";
    loginFormStatus.className = "muted";
  }
  setAuthenticatedUi(false);
});
bind("btnSeed", seedMasterData);
bind("btnPurchase", createPurchase);
bind("btnSales", createSales);
bind("btnReceipt", createReceipt);
bind("btnPayment", createPayment);
bind("btnProducts", queryProducts);
bind("btnProductAdd", addProductFromForm);
bind("btnLoadPoApprovals", loadPurchaseApprovals);
bind("btnLoadSoApprovals", loadSalesApprovals);
bind("btnLoadPendingApprovals", loadPendingApprovals);
bind("btnResetApprovalView", loadRoleApprovalWorkspace);
bind("btnLoadApprovalSla", loadApprovalSla);
bind("btnLoadOverdueApprovals", loadOverdueApprovals);
bind("btnLoadTimeline", loadApprovalTimeline);
bind("btnSubmitApproval", async () => doApprovalAction("submit"));
bind("btnApproveApproval", async () => doApprovalAction("approve"));
bind("btnRejectApproval", async () => {
  const id = Number(document.getElementById("approvalOrderId").value.trim());
  if (!Number.isFinite(id) || id <= 0) throw new Error("请先在审批列表中点击一条单据。");
  setRejectInputVisible(true);
  const commentInput = document.getElementById("approvalComment");
  if (commentInput) {
    commentInput.placeholder = "请填写驳回意见（必填）";
    commentInput.focus();
  }
});
bind("btnConfirmRejectInput", async () => doApprovalAction("reject"));
bind("btnCancelRejectInput", async () => {
  setRejectInputVisible(false);
  const commentInput = document.getElementById("approvalComment");
  if (commentInput) commentInput.placeholder = "请填写驳回意见（必填）";
});
bind("btnVoidApproval", async () => doApprovalAction("void"));
bind("btnReverseApproval", async () => doApprovalAction("reverse"));
bind("btnCopyApprovalDetailCurl", async () => copyApprovalDetailCurl());
bind("btnBizPurchase", async () => {
  setActivePanel("panelCreate");
  openParamWorkbenchFor("paramCardPurchase", "poOrderNo");
});
bind("btnBizAddProduct", async () => {
  setActivePanel("panelCreate");
  const sku = document.getElementById("newProductSku");
  if (sku) sku.focus();
});
bind("btnBizSales", async () => {
  setActivePanel("panelCreate");
  openParamWorkbenchFor("paramCardSales", "soOrderNo");
});
bind("btnBizPending", async () => {
  setActivePanel("panelApproval");
  await loadPendingApprovals();
});
bind("btnBizSubmit", async () => {
  setActivePanel("panelApproval");
  await doApprovalAction("submit");
});
bind("btnBizApprove", async () => {
  setActivePanel("panelApproval");
  await doApprovalAction("approve");
});
bind("btnBizReceipt", async () => {
  setActivePanel("panelCreate");
  openParamWorkbenchFor("paramCardReceipt", "rcNo");
});
bind("btnBizPayment", async () => {
  setActivePanel("panelCreate");
  openParamWorkbenchFor("paramCardPayment", "pyNo");
});
bind("btnBizRefresh", refreshAll);
bind("btnConfirmQuickAddSupplier", async () =>
  quickCreateParty("supplier", "inputQuickAddSupplierCode", "inputQuickAddSupplierName", "boxQuickAddSupplier", "poSupplierPick")
);
bind("btnCancelQuickAddSupplier", async () => cancelQuickPartyBox("boxQuickAddSupplier", "poSupplierPick"));
bind("btnConfirmQuickAddCustomerSales", async () =>
  quickCreateParty(
    "customer",
    "inputQuickAddCustomerSalesCode",
    "inputQuickAddCustomerSalesName",
    "boxQuickAddCustomerSales",
    "soCustomerPick"
  )
);
bind("btnCancelQuickAddCustomerSales", async () => cancelQuickPartyBox("boxQuickAddCustomerSales", "soCustomerPick"));
bind("btnConfirmQuickAddCustomerReceipt", async () =>
  quickCreateParty(
    "customer",
    "inputQuickAddCustomerReceiptCode",
    "inputQuickAddCustomerReceiptName",
    "boxQuickAddCustomerReceipt",
    "rcCustomerPick"
  )
);
bind("btnCancelQuickAddCustomerReceipt", async () => cancelQuickPartyBox("boxQuickAddCustomerReceipt", "rcCustomerPick"));
bind("btnConfirmQuickAddSupplierPayment", async () =>
  quickCreateParty(
    "supplier",
    "inputQuickAddSupplierPaymentCode",
    "inputQuickAddSupplierPaymentName",
    "boxQuickAddSupplierPayment",
    "pySupplierPick"
  )
);
bind("btnCancelQuickAddSupplierPayment", async () => cancelQuickPartyBox("boxQuickAddSupplierPayment", "pySupplierPick"));
bind("btnConfirmPurchase", createPurchase);
bind("btnConfirmSales", createSales);
bind("btnConfirmReceipt", createReceipt);
bind("btnConfirmPayment", createPayment);
bind("btnAr", queryAr);
bind("btnAp", queryAp);
bind("btnJournals", queryJournals);
bind("btnTrend", queryTrend);
bind("btnAudit", queryAudit);
bind("btnAlerts", queryAlerts);
bind("btnRefreshAll", refreshAll);
bind("btnRunAll", runAll);


filters.products.addEventListener("input", () => cache.products.length && rerenderFromCache("products"));
filters.ar.addEventListener("input", () => cache.ar.length && rerenderFromCache("ar"));
filters.ap.addEventListener("input", () => cache.ap.length && rerenderFromCache("ap"));
filters.journals.addEventListener("input", () => cache.journals.length && rerenderFromCache("journals"));
filters.audit.addEventListener("input", () => cache.audit.length && rerenderFromCache("audit"));

bind("btnExportProducts", async () => {
  ensureToken();
  if (!cache.products.length) await queryProducts();
  downloadCsv("products.csv", cache.products, [
    { label: "ID", getter: (r) => r.id },
    { label: "SKU", getter: (r) => r.sku },
    { label: "名称", getter: (r) => r.name },
    { label: "单位", getter: (r) => r.unit },
    { label: "库存数量", getter: (r) => r.stockQty },
    { label: "成本价", getter: (r) => r.costPrice },
    { label: "销售价", getter: (r) => r.salePrice }
  ]);
});
bind("btnExportAr", async () => {
  ensureToken();
  if (!cache.ar.length) await queryAr();
  downloadCsv("ar_invoices.csv", cache.ar, [
    { label: "ID", getter: (r) => r.id },
    { label: "发票号", getter: (r) => r.invoiceNo },
    { label: "客户", getter: (r) => r.customerName },
    { label: "总金额", getter: (r) => r.totalAmount },
    { label: "已收金额", getter: (r) => r.receivedAmount },
    { label: "状态", getter: (r) => zhArApStatus(r.status) },
    { label: "创建时间", getter: (r) => r.createdAt }
  ]);
});
bind("btnExportAp", async () => {
  ensureToken();
  if (!cache.ap.length) await queryAp();
  downloadCsv("ap_bills.csv", cache.ap, [
    { label: "ID", getter: (r) => r.id },
    { label: "账单号", getter: (r) => r.billNo },
    { label: "供应商", getter: (r) => r.supplierName },
    { label: "总金额", getter: (r) => r.totalAmount },
    { label: "已付金额", getter: (r) => r.paidAmount },
    { label: "状态", getter: (r) => zhArApStatus(r.status) },
    { label: "创建时间", getter: (r) => r.createdAt }
  ]);
});
bind("btnExportJournals", async () => {
  ensureToken();
  if (!cache.journals.length) await queryJournals();
  downloadCsv(
    "journals.csv",
    cache.journals.map((r) => ({
      entryNo: r.entryNo,
      refType: r.refType,
      memo: r.memo,
      debit: (r.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0),
      credit: (r.lines || []).reduce((s, l) => s + Number(l.credit || 0), 0),
      createdAt: r.createdAt
    })),
    [
      { label: "凭证号", getter: (r) => r.entryNo },
      { label: "来源", getter: (r) => zhJournalRefType(r.refType) },
      { label: "摘要", getter: (r) => r.memo },
      { label: "借方", getter: (r) => r.debit },
      { label: "贷方", getter: (r) => r.credit },
      { label: "创建时间", getter: (r) => r.createdAt }
    ]
  );
});

bind("btnExportAudit", async () => {
  ensureToken();
  if (!cache.audit.length) await queryAudit();
  downloadCsv("audit_logs.csv", cache.audit, [
    { label: "时间", getter: (r) => r.createdAt },
    { label: "用户", getter: (r) => r.username || "" },
    { label: "动作", getter: (r) => r.action },
    { label: "实体类型", getter: (r) => r.entityType },
    { label: "实体ID", getter: (r) => r.entityId || "" },
    { label: "详情", getter: (r) => r.detail || "" }
  ]);
});
bind("btnExportAlerts", async () => {
  ensureToken();
  if (!cache.alerts.length) await queryAlerts();
  downloadCsv("alert_events.csv", cache.alerts, [
    { label: "时间", getter: (r) => r.createdAt },
    { label: "级别", getter: (r) => zhAlertLevel(r.level) },
    { label: "事件类型", getter: (r) => zhEventType(r.eventType) },
    { label: "实体类型", getter: (r) => r.entityType },
    { label: "实体ID", getter: (r) => r.entityId || "" },
    { label: "消息", getter: (r) => r.message }
  ]);
});

bind("btnClearLogs", async () => {
  output.textContent = "";
});
document.getElementById("approvalStatusFilter")?.addEventListener("change", () => {
  renderApprovalTableFromCache();
});
document.getElementById("chkApprovalActionableOnly")?.addEventListener("change", () => {
  renderApprovalTableFromCache();
});
document.getElementById("poSupplierPick")?.addEventListener("change", (e) => {
  if (handleQuickAddSelect("poSupplierPick", "supplier", "boxQuickAddSupplier", "inputQuickAddSupplierName")) return;
  const v = Number(e.target.value || 0);
  if (v > 0) state.supplierId = v;
  e.target.dataset.prevValue = v > 0 ? String(v) : "";
  updateSelectVisualState("poSupplierPick");
  renderPurchaseAutoHint();
  hidePickOptionHint();
});
document.getElementById("poSupplierPick")?.addEventListener("focus", () => {
  void ensureAndShowPickOptions("poSupplierPick", "供应商", refreshPartyPicks, "暂无可选项，请先初始化主数据。");
});
document.getElementById("poSupplierPick")?.addEventListener("click", () => {
  void ensureAndShowPickOptions("poSupplierPick", "供应商", refreshPartyPicks, "暂无可选项，请先初始化主数据。");
});
document.getElementById("pySupplierPick")?.addEventListener("change", (e) => {
  if (handleQuickAddSelect("pySupplierPick", "supplier", "boxQuickAddSupplierPayment", "inputQuickAddSupplierPaymentName")) return;
  const v = Number(e.target.value || 0);
  if (v > 0) state.supplierId = v;
  e.target.dataset.prevValue = v > 0 ? String(v) : "";
  updateSelectVisualState("pySupplierPick");
  renderPaymentPreviewHint();
  hidePickOptionHint();
});
document.getElementById("pySupplierPick")?.addEventListener("focus", () => {
  void ensureAndShowPickOptions("pySupplierPick", "供应商", refreshPartyPicks, "暂无可选项，请先初始化主数据。");
});
document.getElementById("pySupplierPick")?.addEventListener("click", () => {
  void ensureAndShowPickOptions("pySupplierPick", "供应商", refreshPartyPicks, "暂无可选项，请先初始化主数据。");
});
document.getElementById("soCustomerPick")?.addEventListener("change", (e) => {
  if (handleQuickAddSelect("soCustomerPick", "customer", "boxQuickAddCustomerSales", "inputQuickAddCustomerSalesName")) return;
  const v = Number(e.target.value || 0);
  if (v > 0) state.customerId = v;
  e.target.dataset.prevValue = v > 0 ? String(v) : "";
  updateSelectVisualState("soCustomerPick");
  renderSalesPreviewHint();
  hidePickOptionHint();
});
document.getElementById("rcCustomerPick")?.addEventListener("change", (e) => {
  if (handleQuickAddSelect("rcCustomerPick", "customer", "boxQuickAddCustomerReceipt", "inputQuickAddCustomerReceiptName")) return;
  const v = Number(e.target.value || 0);
  if (v > 0) state.customerId = v;
  e.target.dataset.prevValue = v > 0 ? String(v) : "";
  updateSelectVisualState("rcCustomerPick");
  renderReceiptPreviewHint();
  hidePickOptionHint();
});
document.getElementById("poProductPick")?.addEventListener("change", (e) => {
  const v = Number(e.target.value || 0);
  if (v > 0) document.getElementById("poProductId").value = String(v);
  updateSelectVisualState("poProductPick");
  renderPurchaseAutoHint();
  hidePickOptionHint();
});
document.getElementById("poProductPick")?.addEventListener("focus", () => {
  void ensureAndShowPickOptions("poProductPick", "商品", refreshPartyPicks, "暂无可选项，请先初始化主数据。");
});
document.getElementById("poProductPick")?.addEventListener("click", () => {
  void ensureAndShowPickOptions("poProductPick", "商品", refreshPartyPicks, "暂无可选项，请先初始化主数据。");
});
document.getElementById("poQty")?.addEventListener("input", () => {
  renderPurchaseAutoHint();
});
document.getElementById("poPrice")?.addEventListener("input", () => {
  renderPurchaseAutoHint();
});
document.getElementById("soProductPick")?.addEventListener("change", (e) => {
  const v = Number(e.target.value || 0);
  if (v > 0) document.getElementById("soProductId").value = String(v);
  updateSelectVisualState("soProductPick");
  renderSalesPreviewHint();
  hidePickOptionHint();
});
document.getElementById("soQty")?.addEventListener("input", () => {
  renderSalesPreviewHint();
});
document.getElementById("soPrice")?.addEventListener("input", () => {
  renderSalesPreviewHint();
});
document.getElementById("rcArPick")?.addEventListener("change", (e) => {
  const v = Number(e.target.value || 0);
  document.getElementById("rcArInvoiceId").value = v > 0 ? String(v) : "";
  updateSelectVisualState("rcArPick");
  renderReceiptPreviewHint();
  hidePickOptionHint();
});
document.getElementById("rcArPick")?.addEventListener("focus", () => {
  void ensureAndShowPickOptions("rcArPick", "应收单据", refreshSettlementPicks, "暂无可选项，请先审批通过销售单。");
});
document.getElementById("rcArPick")?.addEventListener("click", () => {
  void ensureAndShowPickOptions("rcArPick", "应收单据", refreshSettlementPicks, "暂无可选项，请先审批通过销售单。");
});
document.getElementById("pyApPick")?.addEventListener("change", (e) => {
  const v = Number(e.target.value || 0);
  document.getElementById("pyApBillId").value = v > 0 ? String(v) : "";
  updateSelectVisualState("pyApPick");
  renderPaymentPreviewHint();
  hidePickOptionHint();
});
document.getElementById("rcAmount")?.addEventListener("input", () => {
  renderReceiptPreviewHint();
});
document.getElementById("pyAmount")?.addEventListener("input", () => {
  renderPaymentPreviewHint();
});
document.getElementById("pyApPick")?.addEventListener("focus", () => {
  void ensureAndShowPickOptions("pyApPick", "应付单据", refreshSettlementPicks, "暂无可选项，请先审批通过采购单。");
});
document.getElementById("pyApPick")?.addEventListener("click", () => {
  void ensureAndShowPickOptions("pyApPick", "应付单据", refreshSettlementPicks, "暂无可选项，请先审批通过采购单。");
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => setActivePanel(btn.dataset.panel));
});
moduleNavButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    setActivePanel(btn.dataset.panel);
    if (btn.dataset.panel === "panelApproval") await loadRoleApprovalWorkspace();
  });
});

if (restoreSession()) {
  setAuthenticatedUi(true);
  if (loginStatus) {
    loginStatus.textContent = `已登录：${state.username || "-"}（${zhRole(state.role || "admin")}）`;
    loginStatus.className = "ok";
  }
  applyRoleUi();
  jumpToRoleDefaultPanel();
  syncTxnFormDefaults();
  refreshPartyPicks().catch(() => {});
  refreshAll({ source: "auto" }).catch(() => {});
} else {
  setAuthenticatedUi(false);
  applyRoleUi();
}
