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
const STORAGE_PAGER_PREF_KEY = "gbf_erp_pager_pref_v1";

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
const trendDays = document.getElementById("trendDays");
const trendViewMode = document.getElementById("trendViewMode");
const trendHint = document.getElementById("trendHint");
const journalDetail = document.getElementById("journalDetail");
const productDetail = document.getElementById("productDetail");
const arDetail = document.getElementById("arDetail");
const apDetail = document.getElementById("apDetail");
const approvalDetail = document.getElementById("approvalDetail");
const actionToast = document.getElementById("actionToast");
const whSuggestBox = document.getElementById("whSuggestBox");
const locSuggestBox = document.getElementById("locSuggestBox");
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
const executionOrderCache = { purchase: [], sales: [] };
const executionOrderItemsCache = new Map();
const reminderCache = { receipts: [], deliveries: [] };
const settlementPickCache = { ar: [], ap: [] };
let approvalSelectedRow = null;
const EXEC_BATCH_SEQ_KEY = "gbf_erp_exec_batch_seq_v1";
const REMINDER_PREF_KEY = "gbf_erp_reminder_pref_v1";
const serverPager = {
  ar: { page: 1, pageSize: 10, total: 0 },
  ap: { page: 1, pageSize: 10, total: 0 },
  remindReceipts: { page: 1, pageSize: 10, total: 0 },
  remindDeliveries: { page: 1, pageSize: 10, total: 0 }
};

function invalidateExecutionOrderItems(orderType, orderId) {
  const key = `${orderType}:${orderId}`;
  executionOrderItemsCache.delete(key);
}

function loadBatchSeqState() {
  try {
    const raw = localStorage.getItem(EXEC_BATCH_SEQ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_e) {
    return {};
  }
}

function saveBatchSeqState(stateObj) {
  try {
    localStorage.setItem(EXEC_BATCH_SEQ_KEY, JSON.stringify(stateObj || {}));
  } catch (_e) {
    // ignore
  }
}

function loadReminderPrefs() {
  const defaults = { warnDays: 2, dangerDays: 7 };
  try {
    const raw = localStorage.getItem(REMINDER_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      warnDays: Math.max(1, Number(parsed.warnDays || defaults.warnDays)),
      dangerDays: Math.max(1, Number(parsed.dangerDays || defaults.dangerDays))
    };
  } catch (_e) {
    return defaults;
  }
}

function saveReminderPrefs(prefs) {
  try {
    localStorage.setItem(REMINDER_PREF_KEY, JSON.stringify(prefs));
  } catch (_e) {
    // ignore
  }
}

function loadPagerPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_PAGER_PREF_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return {
      approvalPageSize: Math.max(1, Number(p.approvalPageSize || 10)),
      arPageSize: Math.max(1, Number(p.arPageSize || 10)),
      apPageSize: Math.max(1, Number(p.apPageSize || 10)),
      remindReceiptsPageSize: Math.max(1, Number(p.remindReceiptsPageSize || 10)),
      remindDeliveriesPageSize: Math.max(1, Number(p.remindDeliveriesPageSize || 10))
    };
  } catch (_e) {
    return {
      approvalPageSize: 10,
      arPageSize: 10,
      apPageSize: 10,
      remindReceiptsPageSize: 10,
      remindDeliveriesPageSize: 10
    };
  }
}

function savePagerPrefs() {
  try {
    localStorage.setItem(
      STORAGE_PAGER_PREF_KEY,
      JSON.stringify({
        approvalPageSize: approvalPager.pageSize,
        arPageSize: serverPager.ar.pageSize,
        apPageSize: serverPager.ap.pageSize,
        remindReceiptsPageSize: serverPager.remindReceipts.pageSize,
        remindDeliveriesPageSize: serverPager.remindDeliveries.pageSize
      })
    );
  } catch (_e) {
    // ignore
  }
}

function batchSeqKey(args) {
  const { orderType, orderId, productId } = args;
  return `${orderType}:${orderId}:${productId}`;
}

function getNextBatchNo(args) {
  const { orderType, orderId, productId } = args;
  if (!orderId || !productId) return "";
  const stateObj = loadBatchSeqState();
  const key = batchSeqKey({ orderType, orderId, productId });
  const next = Number(stateObj[key] || 0) + 1;
  const prefix = orderType === "sales" ? "SB" : "PB";
  return `${prefix}-${orderId}-${productId}-${next}`;
}

function bumpBatchSeq(args) {
  const { orderType, orderId, productId } = args;
  if (!orderId || !productId) return;
  const stateObj = loadBatchSeqState();
  const key = batchSeqKey({ orderType, orderId, productId });
  const next = Number(stateObj[key] || 0) + 1;
  stateObj[key] = next;
  saveBatchSeqState(stateObj);
}

async function refreshExecutionAfterAction(orderType, orderId) {
  invalidateExecutionOrderItems(orderType, orderId);
  const batchInput = document.getElementById(orderType === "sales" ? "execSalesBatchNo" : "execPurchaseBatchNo");
  if (batchInput) batchInput.value = "";
  await refreshExecutionPicks();
  await applyExecutionOrderSelection(orderType, orderId);
}
let notificationCursor = 0;
let notificationTimer = null;
let dashboardTimer = null;
let approvalType = "purchase";
let currentApprovalView = "none";
let approvalRowsCache = [];
let approvalRowsKind = "purchase";
const approvalCheckedIds = new Set();
const executionSubmitting = { purchase: false, sales: false };
const approvalPager = { page: 1, pageSize: 10, total: 0 };
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

function renderRemindersTable(targetId, rows, kind) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const filterId = targetId === "remindReceiptsTable" ? "filterRemindReceipts" : "filterRemindDeliveries";
  const sortId = targetId === "remindReceiptsTable" ? "sortRemindReceipts" : "sortRemindDeliveries";
  const warnDays = Number(document.getElementById("remindWarnDays")?.value || 2);
  const dangerDays = Number(document.getElementById("remindDangerDays")?.value || 7);
  const q = String(document.getElementById(filterId)?.value || "").trim().toLowerCase();
  let filtered = (rows || []).filter((r) => {
    if (!q) return true;
    return String(r.orderNo || "").toLowerCase().includes(q) || String(r.orderId || "").toLowerCase().includes(q);
  });
  const sortMode = String(document.getElementById(sortId)?.value || "age_desc");
  filtered = [...filtered].sort((a, b) => {
    if (sortMode === "qty_desc") return Number(b.remainingQty || 0) - Number(a.remainingQty || 0);
    return Number(b.ageDays || 0) - Number(a.ageDays || 0);
  });
  if (!filtered.length) {
    target.innerHTML = "<div class='muted' style='padding:10px;'>暂无数据</div>";
    return;
  }
  renderTable(
    target,
    filtered,
    [
      { label: "订单ID", getter: (r) => r.orderId },
      { label: "单号", getter: (r) => r.orderNo || "-" },
      {
        label: "剩余数量",
        getter: (r) => {
          const v = Number(r.remainingQty || 0);
          const tone = v >= 100 ? "badge-danger" : v >= 20 ? "badge-warn" : "";
          return `<span class="badge ${tone}">${v.toFixed(2)}</span>`;
        }
      },
      {
        label: "超期(天)",
        getter: (r) => {
          const d = Number(r.ageDays || 0);
          const tone = d >= dangerDays ? "badge-danger" : d >= warnDays ? "badge-warn" : "";
          return `<span class="badge ${tone}">${Number.isFinite(d) ? d : "-"}</span>`;
        }
      }
    ],
    {
      clickable: false
    }
  );
  log(kind, { count: (rows || []).length, sample: (rows || []).slice(0, 10) });
}

async function loadRemindReceipts() {
  ensureToken();
  const meta = serverPager.remindReceipts;
  const payload = await api(`/api/reminders/purchase-receipts?page=${meta.page}&pageSize=${meta.pageSize}`);
  const { rows, total, page, pageSize } = normalizePagedRows(payload);
  meta.total = total;
  meta.page = page;
  meta.pageSize = pageSize;
  reminderCache.receipts = rows || [];
  renderRemindersTable("remindReceiptsTable", rows, "催收货列表");
  syncSimplePager("remindReceipts", "催收货");
  showActionOk(`催收货加载完成：${(rows || []).length} 条`);
}

async function loadRemindDeliveries() {
  ensureToken();
  const meta = serverPager.remindDeliveries;
  const payload = await api(`/api/reminders/sales-deliveries?page=${meta.page}&pageSize=${meta.pageSize}`);
  const { rows, total, page, pageSize } = normalizePagedRows(payload);
  meta.total = total;
  meta.page = page;
  meta.pageSize = pageSize;
  reminderCache.deliveries = rows || [];
  renderRemindersTable("remindDeliveriesTable", rows, "催发货列表");
  syncSimplePager("remindDeliveries", "催发货");
  showActionOk(`催发货加载完成：${(rows || []).length} 条`);
}
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
  let dataRows = rows || [];
  const totalCount = dataRows.length;
  const truncated = totalCount > 1200;
  if (truncated) {
    dataRows = dataRows.slice(0, 1200);
  }
  if (!dataRows || dataRows.length === 0) {
    target.innerHTML = "<div class='muted' style='padding:8px;'>暂无数据</div>";
    return;
  }
  const classifyHeader = (label) => {
    const text = String(label || "");
    if (text === "选") return "th-check";
    if (text === "ID") return "th-idcol";
    if (text === "单号") return "th-orderno";
    if (text === "阶段") return "th-stage";
    if (text === "状态") return "th-status";
    if (/(金额|借方|贷方|余额|成本|价格|数量|库存|openAmount|paid|received)/i.test(text)) return "th-amount";
    if (/(级别|动作|类型)/i.test(text)) return "th-status";
    if (/(时间|日期|created|submitted|approved)/i.test(text)) return "th-time";
    if (/(^ID$|编号|单号|发票号|账单号|凭证号|SKU)/i.test(text)) return "th-id";
    return "";
  };
  const classifyCell = (label) => {
    const text = String(label || "");
    if (text === "选") return "td-check";
    if (text === "ID") return "td-idcol";
    if (text === "单号") return "td-orderno";
    if (text === "阶段") return "td-stage";
    if (text === "状态") return "td-status";
    if (/(金额|借方|贷方|余额|成本|价格|数量|库存|openAmount|paid|received)/i.test(text)) return "td-amount";
    if (/(时间|日期|created|submitted|approved)/i.test(text)) return "td-time";
    return "";
  };
  const stickyFirstCol = opts.stickyFirstCol !== false;
  const header = columns
    .map((c, idx) => {
      const cls = classifyHeader(c.label);
      const merged = `${cls}${idx === 0 && stickyFirstCol ? " first-col" : ""}`.trim();
      return `<th class="${merged}">${c.label}</th>`;
    })
    .join("");
  const body = dataRows
    .map((row, idx) => {
      const cells = columns
        .map((c, colIdx) => {
          const v = c.getter(row);
          const base = [colIdx === 0 && stickyFirstCol ? "first-col" : "", classifyCell(c.label)].filter(Boolean).join(" ");
          const cls = base ? ` class="${base}"` : "";
          return `<td${cls}>${v == null ? "" : String(v)}</td>`;
        })
        .join("");
      const rowAttr = opts.clickable ? `data-row-idx="${idx}" style="cursor:pointer;"` : "";
      return `<tr ${rowAttr}>${cells}</tr>`;
    })
    .join("");
  const hint = truncated
    ? `<div class="muted" style="padding:6px 8px;">数据较大，仅渲染前 1200 条（总计 ${totalCount} 条）。请继续使用筛选缩小范围。</div>`
    : "";
  target.innerHTML = `${hint}<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  if (opts.clickable && typeof opts.onRowClick === "function") {
    target.querySelectorAll("tr[data-row-idx]").forEach((tr) => {
      tr.addEventListener("click", () => {
        target.querySelectorAll("tr.row-selected").forEach((el) => el.classList.remove("row-selected"));
        tr.classList.add("row-selected");
        const idx = Number(tr.getAttribute("data-row-idx"));
        opts.onRowClick(dataRows[idx]);
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
  return zhOrderStatus(status);
}

function formatApprovalStatusCell(row) {
  const statusText = zhApprovalRowStatus(row);
  const isRejected = String(row?.status || "") === "rejected";
  if (!isRejected) return statusText;
  return `<span style="color:var(--danger);font-weight:700;" title="该单据已驳回">${escapeHtml(statusText)}</span>`;
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
  const totalQty = (data.items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
  const receivedQty = (data.items || []).reduce((s, it) => s + Number(it.receivedQty || 0), 0);
  const fulfillment = fulfillmentStatusFromQty(totalQty, receivedQty);
  const stage = combinedStageLabel({ approvalStatus: o.status, fulfillment, settlement: o.paymentStatus, kind: "purchase" });
  const lines = (data.items || []).map(
    (it, i) =>
      [
        `${i + 1}. ${it.sku ?? "-"} / ${it.productName ?? "-"}`,
        `   数量 ${fmtMoney(it.qty)} | 已收 ${fmtMoney(it.receivedQty ?? 0)} | 单价 ${fmtMoney(it.price)} | 小计 ${fmtMoney(it.amount)}`
      ].join("\n")
  );
  return [
    `采购单 ${o.orderNo ?? "-"}（ID ${o.id ?? "-"}）`,
    `状态：${zhOrderStatus(o.status)}`,
    `阶段：${stage}`,
    `供应商：${o.supplierName ?? "-"}（${o.supplierCode ?? "-"} / #${o.supplierId ?? "-"}）`,
    `合计金额：${fmtMoney(o.totalAmount)}`,
    `应付：${zhPaymentStatus(o.paymentStatus)}     未付余额：${fmtMoney(o.billOpenAmount ?? 0)}`,
    `收货进度：${fmtMoney(receivedQty)} / ${fmtMoney(totalQty)}     剩余未收：${fmtMoney(Math.max(0, totalQty - receivedQty))}`,
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
  const totalQty = (data.items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
  const deliveredQty = (data.items || []).reduce((s, it) => s + Number(it.deliveredQty || 0), 0);
  const fulfillment = fulfillmentStatusFromQty(totalQty, deliveredQty);
  const stage = combinedStageLabel({ approvalStatus: o.status, fulfillment, settlement: o.receiptStatus, kind: "sales" });
  const lines = (data.items || []).map(
    (it, i) =>
      [
        `${i + 1}. ${it.sku ?? "-"} / ${it.productName ?? "-"}`,
        `   数量 ${fmtMoney(it.qty)} | 已发 ${fmtMoney(it.deliveredQty ?? 0)} | 单价 ${fmtMoney(it.price)} | 小计 ${fmtMoney(it.amount)}`
      ].join("\n")
  );
  return [
    `销售单 ${o.orderNo ?? "-"}（ID ${o.id ?? "-"}）`,
    `状态：${zhOrderStatus(o.status)}`,
    `阶段：${stage}`,
    `客户：${o.customerName ?? "-"}（${o.customerCode ?? "-"} / #${o.customerId ?? "-"}）`,
    `合计金额：${fmtMoney(o.totalAmount)}`,
    `应收：${zhReceiptStatus(o.receiptStatus)}     未收余额：${fmtMoney(o.invoiceOpenAmount ?? 0)}`,
    `发货进度：${fmtMoney(deliveredQty)} / ${fmtMoney(totalQty)}     剩余未发：${fmtMoney(Math.max(0, totalQty - deliveredQty))}`,
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

function renderApprovalDetailHtml(orderType, data, rejectMeta = null) {
  const o = data?.order || {};
  const isSales = orderType === "sales";
  const items = Array.isArray(data?.items) ? data.items : [];
  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0);
  const doneQty = items.reduce((s, it) => s + Number(isSales ? it.deliveredQty || 0 : it.receivedQty || 0), 0);
  const fulfillment = fulfillmentStatusFromQty(totalQty, doneQty);
  const stage = combinedStageLabel({
    approvalStatus: o.status,
    fulfillment,
    settlement: isSales ? o.receiptStatus : o.paymentStatus,
    kind: isSales ? "sales" : "purchase"
  });
  const counterpart = isSales
    ? `${o.customerName || "-"}（${o.customerCode || "-"} / #${o.customerId || "-"}）`
    : `${o.supplierName || "-"}（${o.supplierCode || "-"} / #${o.supplierId || "-"}）`;
  const openAmount = Number(isSales ? o.invoiceOpenAmount || 0 : o.billOpenAmount || 0);
  const actionBar = (() => {
    const oid = Number(o.id || 0);
    const ono = String(o.orderNo || "");
    if (!(oid > 0)) return "";
    const execBtn = isSales
      ? `<button class="secondary" type="button" onclick="jumpFromApprovalDetail('exec','sales',${oid},'${escapeHtml(ono)}')">去销售发货</button>`
      : `<button class="secondary" type="button" onclick="jumpFromApprovalDetail('exec','purchase',${oid},'${escapeHtml(ono)}')">去采购收货</button>`;
    const settleBtn = isSales
      ? `<button class="secondary" type="button" onclick="jumpFromApprovalDetail('settle','sales',${oid},'${escapeHtml(ono)}')">去销售收款</button>`
      : `<button class="secondary" type="button" onclick="jumpFromApprovalDetail('settle','purchase',${oid},'${escapeHtml(ono)}')">去采购付款</button>`;
    return `<div class="approval-detail-actions">${execBtn}${settleBtn}</div>`;
  })();
  const itemRows = items
    .map((it) => {
      const done = Number(isSales ? it.deliveredQty || 0 : it.receivedQty || 0);
      return `<tr>
        <td>${escapeHtml(it.sku || "-")}</td>
        <td>${escapeHtml(it.productName || "-")}</td>
        <td class="amount">${fmtMoney(it.qty)}</td>
        <td class="amount">${fmtMoney(done)}</td>
        <td class="amount">${fmtMoney(it.price)}</td>
        <td class="amount">${fmtMoney(it.amount)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="approval-detail-panel">
    <div class="approval-detail-head">
      <div class="approval-detail-title">${escapeHtml(isSales ? "销售单" : "采购单")} ${escapeHtml(o.orderNo || "-")}（ID ${escapeHtml(o.id || "-")}）</div>
      ${stageBadgeHtml(stage)}
    </div>
    ${actionBar}
    <div class="approval-detail-kpi">
      <div class="k"><div class="l">合计金额</div><div class="v">${fmtMoney(o.totalAmount)}</div></div>
      <div class="k"><div class="l">${isSales ? "未收金额" : "未付金额"}</div><div class="v">${fmtMoney(openAmount)}</div></div>
      <div class="k"><div class="l">${isSales ? "发货进度" : "收货进度"}</div><div class="v">${fmtMoney(doneQty)} / ${fmtMoney(totalQty)}</div></div>
      <div class="k"><div class="l">状态</div><div class="v">${escapeHtml(zhOrderStatus(o.status))}</div></div>
    </div>
    <div class="approval-detail-meta">
      <div class="m">${escapeHtml(isSales ? "客户" : "供应商")}：${escapeHtml(counterpart)}</div>
      <div class="m">创建：${escapeHtml(o.createdAt || "-")}　提交：${escapeHtml(o.submittedAt || "-")}</div>
      <div class="m">通过：${escapeHtml(o.approvedAt || "-")}　驳回：${escapeHtml(rejectMeta?.rejectedAt || o.rejectedAt || "-")}</div>
      <div class="m">驳回意见：${escapeHtml(rejectMeta?.rejectComment || "-")}</div>
    </div>
    <div class="approval-items-wrap">
      <table class="approval-items-table">
        <thead><tr>
          <th>SKU</th><th>商品</th><th>数量</th><th>${isSales ? "已发" : "已收"}</th><th>单价</th><th>小计</th>
        </tr></thead>
        <tbody>${itemRows || `<tr><td colspan="6" class="muted">暂无明细</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

async function jumpFromApprovalDetail(kind, orderType, orderId, orderNo = "") {
  try {
    if (kind === "exec") {
      setActivePanel("panelCreate");
      // execution section is in create panel; prefill ids and refresh picks
      if (orderType === "sales") {
        const pick = document.getElementById("execSalesOrderPick");
        const idInput = document.getElementById("execSalesOrderId");
        if (idInput) idInput.value = String(orderId);
        await refreshExecutionPicks();
        if (pick) pick.value = String(orderId);
        await applyExecutionOrderSelection("sales", orderId);
        const qty = document.getElementById("execSalesQty");
        if (qty) qty.focus();
      } else {
        const pick = document.getElementById("execPurchaseOrderPick");
        const idInput = document.getElementById("execPurchaseOrderId");
        if (idInput) idInput.value = String(orderId);
        await refreshExecutionPicks();
        if (pick) pick.value = String(orderId);
        await applyExecutionOrderSelection("purchase", orderId);
        const qty = document.getElementById("execPurchaseQty");
        if (qty) qty.focus();
      }
      showActionOk(`已跳转执行区：${orderType === "sales" ? "销售发货" : "采购收货"}（订单ID ${orderId}${orderNo ? ` / ${orderNo}` : ""}）`);
      return;
    }

    if (kind === "settle") {
      setActivePanel("panelCreate");
      await refreshSettlementPicks();
      if (orderType === "sales") {
        // auto match AR invoice by refType/refId
        const hit = (settlementPickCache.ar || []).find((x) => x.refType === "sales_order" && Number(x.refId || 0) === Number(orderId));
        const arPick = document.getElementById("rcArPick");
        if (hit && arPick) {
          arPick.value = String(hit.id);
          arPick.dispatchEvent(new Event("change"));
        } else {
          showActionWarn("未找到该订单对应的应收单据，请先在“应收单据”下拉中手动选择。");
          if (arPick) arPick.focus();
        }
        const amount = document.getElementById("rcAmount");
        if (amount) amount.focus();
      } else {
        const hit = (settlementPickCache.ap || []).find(
          (x) => x.refType === "purchase_order" && Number(x.refId || 0) === Number(orderId)
        );
        const apPick = document.getElementById("pyApPick");
        if (hit && apPick) {
          apPick.value = String(hit.id);
          apPick.dispatchEvent(new Event("change"));
        } else {
          showActionWarn("未找到该订单对应的应付单据，请先在“应付单据”下拉中手动选择。");
          if (apPick) apPick.focus();
        }
        const amount = document.getElementById("pyAmount");
        if (amount) amount.focus();
      }
      showActionOk(`已跳转资金区：${orderType === "sales" ? "销售收款" : "采购付款"}（订单ID ${orderId}${orderNo ? ` / ${orderNo}` : ""}）`);
    }
  } catch (e) {
    showActionWarn(e?.message || String(e));
  }
}

// expose for inline onclick
window.jumpFromApprovalDetail = jumpFromApprovalDetail;

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
  const stageKey = arStageKeyFromRow(row);
  const stageLabel = stageLabelFromKey(stageKey, "sales");
  return [
    `【应收发票】${fmtMaybe(row.invoiceNo)}（ID ${fmtMaybe(row.id)}）`,
    `客户：${fmtMaybe(row.customerName)}（#${fmtMaybe(row.customerId)}）`,
    `阶段：${stageLabel}（依据：${zhArFulfillmentStatus(row.fulfillmentStatus)} + 已收 ${fmtMoney(received)} / ${fmtMoney(total)}）`,
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
  const stageKey = apStageKeyFromRow(row);
  const stageLabel = stageLabelFromKey(stageKey, "purchase");
  return [
    `【应付账单】${fmtMaybe(row.billNo)}（ID ${fmtMaybe(row.id)}）`,
    `供应商：${fmtMaybe(row.supplierName)}（#${fmtMaybe(row.supplierId)}）`,
    `阶段：${stageLabel}（依据：${zhApFulfillmentStatus(row.fulfillmentStatus)} + 已付 ${fmtMoney(paid)} / ${fmtMoney(total)}）`,
    `状态：${zhArApStatus(row.status)}     未付余额：${fmtMoney(open)}`,
    `总金额：${fmtMoney(total)}     已付：${fmtMoney(paid)}`,
    `来源：${fmtMaybe(row.refType)} #${fmtMaybe(row.refId)}`,
    `时间：${fmtMaybe(row.createdAt)}`
  ].join("\n");
}

function renderJournalDetailHtml(entry) {
  const lines = Array.isArray(entry?.lines) ? entry.lines : [];
  const debit = (entry.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = (entry.lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
  const rowsHtml = lines
    .map((l, i) => {
      const debitVal = Number(l.debit || 0);
      const creditVal = Number(l.credit || 0);
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(l.accountCode || "-")}</td>
        <td>${escapeHtml(l.accountName || "-")}</td>
        <td class="td-amount">${fmtMoney(debitVal)}</td>
        <td class="td-amount">${fmtMoney(creditVal)}</td>
        <td>${escapeHtml(l.memo || "-")}</td>
      </tr>`;
    })
    .join("");

  return `<div class="journal-detail-view">
    <div class="journal-detail-kpi">
      <div class="k"><div class="l">凭证号</div><div class="v">${escapeHtml(fmtMaybe(entry.entryNo))}</div></div>
      <div class="k"><div class="l">来源</div><div class="v">${escapeHtml(zhJournalRefType(entry.refType))}</div></div>
      <div class="k"><div class="l">借方合计</div><div class="v">${fmtMoney(debit)}</div></div>
      <div class="k"><div class="l">贷方合计</div><div class="v">${fmtMoney(credit)}</div></div>
    </div>
    <div class="journal-detail-meta">
      <div>参考：${escapeHtml(fmtMaybe(entry.refType))} #${escapeHtml(fmtMaybe(entry.refId))}</div>
      <div>摘要：${escapeHtml(fmtMaybe(entry.memo))}</div>
      <div>时间：${escapeHtml(fmtMaybe(entry.createdAt))}</div>
      <div>分录：共 ${lines.length} 行</div>
    </div>
    <div class="journal-lines-wrap">
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>科目编码</th>
            <th>科目名称</th>
            <th class="th-amount">借方</th>
            <th class="th-amount">贷方</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || "<tr><td colspan='6' class='muted'>无分录明细</td></tr>"}</tbody>
      </table>
    </div>
    <details class="journal-raw">
      <summary>查看原始数据</summary>
      <pre>${escapeHtml(JSON.stringify(entry, null, 2))}</pre>
    </details>
  </div>`;
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
  // Keep tooltip as full label; allow visible shorten later if needed.
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

function showActionWarn(message) {
  if (!notificationBar) return;
  notificationBar.textContent = `提示：${message}`;
}

function showActionOk(message) {
  if (!notificationBar) return;
  notificationBar.textContent = `成功：${message}`;
}

let actionToastTimer = null;
function showActionToast(type, message) {
  if (!actionToast) return;
  actionToast.textContent = message;
  actionToast.classList.remove("success", "error");
  actionToast.classList.add(type === "success" ? "success" : "error", "show");
  if (actionToastTimer) clearTimeout(actionToastTimer);
  actionToastTimer = setTimeout(() => {
    actionToast.classList.remove("show");
  }, 3600);
}

function showInlineFeedback(targetId, type, message) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("success", "error", "info");
  const cls = type === "success" ? "success" : type === "error" ? "error" : "info";
  el.classList.add(cls, "show");
}

function clearInlineFeedback() {
  [
    "poActionFeedback",
    "soActionFeedback",
    "rcActionFeedback",
    "pyActionFeedback",
    "execPurchaseFeedback",
    "execSalesFeedback",
    "whLocActionFeedback"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("show", "success", "error");
    el.textContent = "";
  });
}

function autoSelectIfSingle(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return false;
  const opts = Array.from(el.options || []);
  const candidates = opts.filter((o) => String(o.value || "").trim() !== "");
  if (candidates.length === 1) {
    el.value = String(candidates[0].value);
    return true;
  }
  return false;
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
  const viewMode = String(trendViewMode?.value || "all");
  const days = Math.max(1, Number(trendDays?.value || 14));
  if (trendHint) {
    const viewText = viewMode === "trade" ? "销售/采购" : viewMode === "cash" ? "收款/付款" : "销售/采购/收款/付款";
    trendHint.textContent = `最近${days}天交易趋势（${viewText}）。`;
  }
  if (!rows.length) {
    trendChart.innerHTML = "<div class='muted'>暂无趋势数据</div>";
    return;
  }
  const maxVal = rows.reduce(
    (m, r) =>
      Math.max(
        m,
        viewMode === "cash" ? 0 : Number(r.salesAmount || 0),
        viewMode === "cash" ? 0 : Number(r.purchaseAmount || 0),
        viewMode === "trade" ? 0 : Number(r.receiptAmount || 0),
        viewMode === "trade" ? 0 : Number(r.paymentAmount || 0)
      ),
    1
  );
  const showTrade = viewMode !== "cash";
  const showCash = viewMode !== "trade";
  const legendItems = [];
  if (showTrade) {
    legendItems.push(`<span class="item"><span class="dot sales"></span>销售</span>`);
    legendItems.push(`<span class="item"><span class="dot purchase"></span>采购</span>`);
  }
  if (showCash) {
    legendItems.push(`<span class="item"><span class="dot receipt"></span>收款</span>`);
    legendItems.push(`<span class="item"><span class="dot payment"></span>付款</span>`);
  }
  const legendHtml = `<div class="trend-legend">${legendItems.join("")}</div>`;
  const rowsHtml = rows
    .map((r, idx) => {
      const salesPct = Math.min(100, Math.round((Number(r.salesAmount || 0) / maxVal) * 100));
      const purchasePct = Math.min(100, Math.round((Number(r.purchaseAmount || 0) / maxVal) * 100));
      const receiptPct = Math.min(100, Math.round((Number(r.receiptAmount || 0) / maxVal) * 100));
      const paymentPct = Math.min(100, Math.round((Number(r.paymentAmount || 0) / maxVal) * 100));
      const sales = Number(r.salesAmount || 0);
      const purchase = Number(r.purchaseAmount || 0);
      const receipt = Number(r.receiptAmount || 0);
      const payment = Number(r.paymentAmount || 0);
      const net = receipt - payment;
      const netClass = net >= 0 ? "ok" : "warn";
      const prev = idx > 0 ? rows[idx - 1] : null;
      const prevNet = prev ? Number(prev.receiptAmount || 0) - Number(prev.paymentAmount || 0) : null;
      const delta = prevNet == null ? null : net - prevNet;
      const deltaArrow = delta == null ? "—" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
      const deltaClass = delta == null ? "muted" : delta > 0 ? "ok" : delta < 0 ? "warn" : "muted";
      const abnormal = Math.abs(net) >= maxVal * 0.75 || (delta != null && Math.abs(delta) >= maxVal * 0.5);
      const bars = [];
      if (showTrade) {
        bars.push(`<div class="trend-bar" title="销售 ${sales.toFixed(2)}"><div class="trend-fill sales" style="width:${Math.max(2, salesPct)}%"></div></div>`);
        bars.push(`<div class="trend-bar" title="采购 ${purchase.toFixed(2)}"><div class="trend-fill purchase" style="width:${Math.max(2, purchasePct)}%"></div></div>`);
      }
      if (showCash) {
        bars.push(`<div class="trend-bar" title="收款 ${receipt.toFixed(2)}"><div class="trend-fill receipt" style="width:${Math.max(2, receiptPct)}%"></div></div>`);
        bars.push(`<div class="trend-bar" title="付款 ${payment.toFixed(2)}"><div class="trend-fill payment" style="width:${Math.max(2, paymentPct)}%"></div></div>`);
      }
      const valueRows = [];
      if (showTrade) valueRows.push(`<div>销 ${sales.toFixed(0)} / 采 ${purchase.toFixed(0)}</div>`);
      if (showCash) valueRows.push(`<div>收 ${receipt.toFixed(0)} / 付 ${payment.toFixed(0)}</div>`);
      return `<div class="trend-row ${abnormal ? "abnormal" : ""}">
        <div class="muted">${r.day}</div>
        <div class="trend-bars">${bars.join("")}</div>
        <div class="trend-values">
          ${valueRows.join("")}
          <div class="net ${netClass}">净流入 ${net >= 0 ? "+" : ""}${net.toFixed(0)}</div>
          <div class="delta ${deltaClass}">较前日 ${deltaArrow} ${delta == null ? "-" : `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}`}</div>
        </div>
      </div>`;
    })
    .join("");
  trendChart.innerHTML = `${legendHtml}${rowsHtml}`;
}

async function queryTrend() {
  ensureToken();
  const days = Math.max(1, Number(trendDays?.value || 14));
  const rows = await api(`/api/finance/reports/trend?days=${days}`);
  cache.trend = rows;
  if (trendHint) {
    const viewMode = String(trendViewMode?.value || "all");
    const viewText = viewMode === "trade" ? "销售/采购" : viewMode === "cash" ? "收款/付款" : "销售/采购/收款/付款";
    trendHint.textContent = `最近${days}天交易趋势（${viewText}，实际返回 ${rows.length} 天）。`;
  }
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

function resetApprovalListFilters() {
  setApprovalStatusFilter("all");
  const stageEl = document.getElementById("approvalStageFilter");
  if (stageEl) stageEl.value = "all";
  const searchEl = document.getElementById("approvalSearch");
  if (searchEl) searchEl.value = "";
  const box = document.getElementById("chkApprovalActionableOnly");
  if (box) box.checked = false;
}

function approvalStageFilterValue() {
  const el = document.getElementById("approvalStageFilter");
  return (el?.value || "all").trim();
}

function approvalSearchValue() {
  const el = document.getElementById("approvalSearch");
  return String(el?.value || "").trim().toLowerCase();
}

function approvalSortValue() {
  const el = document.getElementById("approvalSort");
  return (el?.value || "id_desc").trim();
}

function approvalStageKeyFromRow(r) {
  const kind = approvalRowsKind === "pending" ? String(r.orderType || approvalType || "purchase") : approvalRowsKind;
  if (kind === "sales") {
    const f = fulfillmentStatusFromQty(r.totalQty, r.deliveredQty);
    const label = combinedStageLabel({ approvalStatus: r.status, fulfillment: f, settlement: r.receiptStatus, kind: "sales" });
    if (label === "待执行") return "todo";
    if (label === "执行中") return "doing";
    if (label === "已执行待结算") return "wait_settle";
    if (label === "结算中") return "settling";
    if (label === "已完成") return "done";
    if (String(label).startsWith("异常")) return "abnormal";
    return "other";
  }
  const f = fulfillmentStatusFromQty(r.totalQty, r.receivedQty);
  const label = combinedStageLabel({ approvalStatus: r.status, fulfillment: f, settlement: r.paymentStatus, kind: "purchase" });
  if (label === "待执行") return "todo";
  if (label === "执行中") return "doing";
  if (label === "已执行待结算") return "wait_settle";
  if (label === "结算中") return "settling";
  if (label === "已完成") return "done";
  if (String(label).startsWith("异常")) return "abnormal";
  return "other";
}

function approvalCheckCell(row) {
  const id = Number(row?.id || 0);
  const checked = id > 0 && approvalCheckedIds.has(id) ? "checked" : "";
  return `<input type="checkbox" class="approval-row-check" data-id="${id}" ${checked} onclick="event.stopPropagation();" />`;
}

function bindApprovalChecks(target) {
  if (!target) return;
  target.querySelectorAll(".approval-row-check").forEach((el) => {
    if (el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener("change", (e) => {
      const id = Number(e.target?.getAttribute("data-id") || 0);
      if (!(id > 0)) return;
      if (e.target.checked) approvalCheckedIds.add(id);
      else approvalCheckedIds.delete(id);
      const input = document.getElementById("approvalBatchIds");
      if (input) input.value = Array.from(approvalCheckedIds).join(",");
    });
  });
}

function supplierDisplayById(id) {
  const n = Number(id || 0);
  if (!(n > 0)) return "-";
  const hit = (masterPickCache.suppliers || []).find((s) => Number(s.id || 0) === n);
  if (!hit) return `#${n}`;
  const name = String(hit.name || "").trim();
  const code = String(hit.code || "").trim();
  if (name && code) return `${name}（${code}） (#${n})`;
  return `${name || code || `#${n}`} (#${n})`;
}

function getFilteredApprovalRows(rows) {
  const status = approvalStatusFilterValue();
  const stage = approvalStageFilterValue();
  const q = approvalSearchValue();
  const sortMode = approvalSortValue();
  const actionableOnly = Boolean(document.getElementById("chkApprovalActionableOnly")?.checked);
  const filtered = rows.filter((r) => {
    const rowStatus = String(r.status || "").toLowerCase();
    if (status && status !== "all" && rowStatus !== status) return false;
    if (stage && stage !== "all") {
      const k = approvalStageKeyFromRow(r);
      if (k !== stage) return false;
    }
    if (q) {
      const hay = `${r.id || ""} ${r.orderNo || ""} ${r.customerId || ""} ${r.supplierId || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (!actionableOnly) return true;
    const kind = approvalRowsKind === "pending" ? String(r.orderType || approvalType || "purchase") : approvalRowsKind;
    const canSubmit = kind === "sales" ? hasPermission("sales:submit") : hasPermission("purchase:submit");
    const canApprove = kind === "sales" ? hasPermission("sales:approve") : hasPermission("purchase:approve");
    if (rowStatus === "draft") return canSubmit;
    if (rowStatus === "submitted") return canApprove;
    return false;
  });

  if (sortMode === "stage_abnormal_first") {
    const weight = (r) => {
      const k = approvalStageKeyFromRow(r);
      if (k === "abnormal") return 0;
      if (k === "todo") return 1;
      if (k === "doing") return 2;
      if (k === "wait_settle") return 3;
      if (k === "settling") return 4;
      if (k === "done") return 5;
      return 9;
    };
    return [...filtered].sort((a, b) => weight(a) - weight(b) || Number(b.id || 0) - Number(a.id || 0));
  }
  return filtered;
}

function renderApprovalTableFromCache() {
  const rows = getFilteredApprovalRows(approvalRowsCache || []);
  if (approvalRowsKind === "pending") {
    renderTable(
      tableTargets.approval,
      rows,
      [
        { label: "选", getter: (r) => approvalCheckCell(r) },
        { label: "类型", getter: (r) => zhOrderType(r.orderType) },
        { label: "ID", getter: (r) => r.id },
        { label: "单号", getter: (r) => `<span title="${escapeHtml(r.orderNo || "-")}">${escapeHtml(r.orderNo || "-")}</span>` },
        {
          label: "阶段",
          getter: (r) => {
            const kind = String(r.orderType || approvalType || "purchase");
            if (kind === "sales") {
              const fulfillment = fulfillmentStatusFromQty(r.totalQty, r.deliveredQty);
              return stageBadgeHtml(
                combinedStageLabel({
                approvalStatus: r.status,
                fulfillment,
                settlement: r.receiptStatus,
                kind: "sales"
                })
              );
            }
            const fulfillment = fulfillmentStatusFromQty(r.totalQty, r.receivedQty);
            return stageBadgeHtml(
              combinedStageLabel({
              approvalStatus: r.status,
              fulfillment,
              settlement: r.paymentStatus,
              kind: "purchase"
              })
            );
          }
        },
        { label: "状态", getter: (r) => formatApprovalStatusCell(r) },
        { label: "金额", getter: (r) => r.totalAmount },
        { label: "提交时间", getter: (r) => r.submittedAt || "-" },
        { label: "最近驳回意见", getter: (r) => formatRejectSummaryCell(r) }
      ],
      {
        clickable: true,
        onRowClick: (row) => selectApprovalRow(row.orderType || approvalType, row),
        stickyFirstCol: false
      }
    );
    bindApprovalChecks(tableTargets.approval);
    bindRejectSummaryCopy(tableTargets.approval);
    return;
  }
  if (approvalRowsKind === "sales") {
    renderTable(
      tableTargets.approval,
      rows,
      [
        { label: "选", getter: (r) => approvalCheckCell(r) },
        { label: "ID", getter: (r) => r.id },
        { label: "单号", getter: (r) => `<span title="${escapeHtml(r.orderNo || "-")}">${escapeHtml(r.orderNo || "-")}</span>` },
        { label: "客户", getter: (r) => r.customerId },
        {
          label: "阶段",
          getter: (r) => {
            const fulfillment = fulfillmentStatusFromQty(r.totalQty, r.deliveredQty);
            return stageBadgeHtml(
              combinedStageLabel({
                approvalStatus: r.status,
                fulfillment,
                settlement: r.receiptStatus,
                kind: "sales"
              })
            );
          }
        },
        { label: "状态", getter: (r) => formatApprovalStatusCell(r) },
        { label: "金额", getter: (r) => r.totalAmount },
        { label: "创建时间", getter: (r) => r.createdAt },
        { label: "最近驳回意见", getter: (r) => formatRejectSummaryCell(r) }
      ],
      {
        clickable: true,
        onRowClick: (row) => selectApprovalRow("sales", row),
        stickyFirstCol: false
      }
    );
    bindApprovalChecks(tableTargets.approval);
    bindRejectSummaryCopy(tableTargets.approval);
    return;
  }
  renderTable(
    tableTargets.approval,
    rows,
    [
      { label: "选", getter: (r) => approvalCheckCell(r) },
      { label: "ID", getter: (r) => r.id },
      { label: "单号", getter: (r) => `<span title="${escapeHtml(r.orderNo || "-")}">${escapeHtml(r.orderNo || "-")}</span>` },
        { label: "供应商", getter: (r) => supplierDisplayById(r.supplierId) },
      {
        label: "阶段",
        getter: (r) => {
          const fulfillment = fulfillmentStatusFromQty(r.totalQty, r.receivedQty);
          return stageBadgeHtml(
            combinedStageLabel({
              approvalStatus: r.status,
              fulfillment,
              settlement: r.paymentStatus,
              kind: "purchase"
            })
          );
        }
      },
      { label: "状态", getter: (r) => formatApprovalStatusCell(r) },
      { label: "金额", getter: (r) => r.totalAmount },
      { label: "创建时间", getter: (r) => r.createdAt },
      { label: "最近驳回意见", getter: (r) => formatRejectSummaryCell(r) }
    ],
    {
      clickable: true,
      onRowClick: (row) => selectApprovalRow("purchase", row),
      stickyFirstCol: false
    }
  );
  bindApprovalChecks(tableTargets.approval);
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

function normalizePagedRows(payload) {
  if (Array.isArray(payload)) return { rows: payload, total: payload.length, page: 1, pageSize: payload.length || approvalPager.pageSize };
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const total = Number(payload?.total || rows.length);
  const page = Number(payload?.page || 1);
  const pageSize = Number(payload?.pageSize || approvalPager.pageSize);
  return { rows, total, page, pageSize };
}

function syncSimplePager(kind, label) {
  const meta = serverPager[kind];
  const info = document.getElementById(
    kind === "ar"
      ? "pagerAr"
      : kind === "ap"
      ? "pagerAp"
      : kind === "remindReceipts"
      ? "remindReceiptsPagerInfo"
      : "remindDeliveriesPagerInfo"
  );
  if (!meta) return;
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / Math.max(1, meta.pageSize)));
  if (kind === "ar" || kind === "ap") {
    const root = kind === "ar" ? pagers.ar : pagers.ap;
    if (!root) return;
    root.innerHTML = "";
    const prev = document.createElement("button");
    prev.textContent = "上一页";
    prev.disabled = meta.page <= 1;
    prev.onclick = async () => {
      meta.page = Math.max(1, meta.page - 1);
      if (kind === "ar") await queryAr();
      else await queryAp();
    };
    const next = document.createElement("button");
    next.textContent = "下一页";
    next.disabled = meta.page >= totalPages;
    next.onclick = async () => {
      meta.page += 1;
      if (kind === "ar") await queryAr();
      else await queryAp();
    };
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = `${label} 第 ${meta.page}/${totalPages} 页（共 ${meta.total} 条）`;
    const size = document.createElement("select");
    [10, 20, 50, 100].forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = `${v}/页`;
      if (meta.pageSize === v) opt.selected = true;
      size.appendChild(opt);
    });
    size.onchange = async () => {
      meta.pageSize = Number(size.value || 10);
      meta.page = 1;
      savePagerPrefs();
      if (kind === "ar") await queryAr();
      else await queryAp();
    };
    const jump = document.createElement("input");
    jump.type = "number";
    jump.min = "1";
    jump.placeholder = "页码";
    jump.style.maxWidth = "78px";
    const jumpBtn = document.createElement("button");
    jumpBtn.textContent = "跳转";
    jumpBtn.className = "secondary";
    jumpBtn.onclick = async () => {
      const v = Number(jump.value || 0);
      if (!(v > 0)) return;
      meta.page = v;
      if (kind === "ar") await queryAr();
      else await queryAp();
    };
    root.appendChild(prev);
    root.appendChild(next);
    root.appendChild(size);
    root.appendChild(jump);
    root.appendChild(jumpBtn);
    root.appendChild(span);
    return;
  }
  if (info) info.textContent = `分页：第 ${meta.page}/${totalPages} 页，共 ${meta.total} 条`;
  const prevBtn = document.getElementById(kind === "remindReceipts" ? "btnRemindReceiptsPrev" : "btnRemindDeliveriesPrev");
  const nextBtn = document.getElementById(kind === "remindReceipts" ? "btnRemindReceiptsNext" : "btnRemindDeliveriesNext");
  if (prevBtn) prevBtn.disabled = meta.page <= 1;
  if (nextBtn) nextBtn.disabled = meta.page >= totalPages;
}

function syncApprovalPagerInfo() {
  const info = document.getElementById("approvalPagerInfo");
  const prev = document.getElementById("btnApprovalPrev");
  const next = document.getElementById("btnApprovalNext");
  if (!info) return;
  const totalPages = Math.max(1, Math.ceil((approvalPager.total || 0) / Math.max(1, approvalPager.pageSize)));
  info.textContent = `分页：第 ${approvalPager.page}/${totalPages} 页，共 ${approvalPager.total} 条`;
  if (prev) prev.disabled = approvalPager.page <= 1;
  if (next) next.disabled = approvalPager.page >= totalPages;
}

function initServerPagerUiDefaults() {
  const map = [
    ["approvalPageSize", approvalPager.pageSize || 10],
    ["remindReceiptsPageSize", serverPager.remindReceipts.pageSize],
    ["remindDeliveriesPageSize", serverPager.remindDeliveries.pageSize]
  ];
  map.forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (el) el.value = String(v);
  });
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
    ["btnLoadAbnormalApprovals", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["btnResetApprovalView", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["chkApprovalActionableOnly", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["btnLoadApprovalSla", ["purchase:approve", "sales:approve"]],
    ["btnLoadOverdueApprovals", ["purchase:approve", "sales:approve"]],
    ["btnLoadTimeline", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["btnTrend", "stock:read"],
    ["btnSubmitApproval", ["purchase:submit", "sales:submit"]],
    ["btnApproveApproval", ["purchase:approve", "sales:approve"]],
    ["btnSelectAllApprovalRows", ["purchase:approve", "sales:approve"]],
    ["btnFillBatchIds", ["purchase:approve", "sales:approve"]],
    ["btnBatchApprove", ["purchase:approve", "sales:approve"]],
    ["btnRejectApproval", ["purchase:approve", "sales:approve"]],
    ["btnBatchReject", ["purchase:approve", "sales:approve"]],
    ["btnJumpAbnormal", ["purchase:read", "sales:read", "purchase:approve", "sales:approve"]],
    ["btnVoidApproval", ["purchase:approve", "sales:approve"]],
    ["btnReverseApproval", ["purchase:approve", "sales:approve"]],
    ["btnProductAdd", ["stock:write", "product:write"]],
    ["btnWebhookList", "*"],
    ["btnWebhookSave", "*"],
    ["btnWebhookDelete", "*"],
    ["btnAudit", "*"],
    ["btnAlerts", "*"],
    ["btnRunAll", "*"],
    ["btnDataChecks", "*"],
    ["btnRemindReceipts", "purchase:read"],
    ["btnRemindDeliveries", "sales:read"],
    ["btnSaveReminderPref", ["purchase:read", "sales:read"]],
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
    ["btnCreateReceiptFlow", "purchase:write"],
    ["btnCreateDeliveryFlow", "sales:write"],
    ["btnCreatePurchaseReturnFlow", "purchase:write"],
    ["btnCreateSalesReturnFlow", "sales:write"],
    ["btnWarehouseCreate", "stock:write"],
    ["btnLocationCreate", "stock:write"],
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

async function runDataChecks() {
  ensureToken();
  if (!hasPermission("*")) throw new Error("仅管理员可执行一致性检查。");
  const res = await api("/api/ops/data-checks");
  const po = res.purchasePaidButNotReceived || [];
  const so = res.salesReceivedButNotShipped || [];
  log("一致性检查", {
    purchasePaidButNotReceived: { count: po.length, sample: po.slice(0, 10) },
    salesReceivedButNotShipped: { count: so.length, sample: so.slice(0, 10) }
  });
  showActionOk(`一致性检查完成：采购异常${po.length}条，销售异常${so.length}条（详情见日志）`);
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

function handleAuthExpired(message = "登录已过期，请重新登录。") {
  state.token = "";
  state.username = "";
  state.role = "";
  state.permissions = [];
  state.canUseDevOps = false;
  localStorage.removeItem(STORAGE_SESSION_KEY);
  setAuthenticatedUi(false);
  if (loginStatus) {
    loginStatus.textContent = message;
    loginStatus.className = "warn";
  }
  showActionWarn(message);
}

function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(path, { ...options, headers }).then(async (res) => {
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const rawMessage = String(body.message || `HTTP ${res.status}`);
      const authExpired =
        res.status === 401 ||
        /token expired|jwt expired|unauthorized|invalid token|forbidden/i.test(rawMessage);
      if (authExpired) {
        handleAuthExpired("登录已过期，请重新登录。");
        throw new Error("登录已过期，请重新登录。");
      }
      const details = body.issues ? ` | ${body.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : "";
      throw new Error(rawMessage + details);
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
    const execPurchaseProductPick = document.getElementById("execPurchaseProductPick");
    const execSalesProductPick = document.getElementById("execSalesProductPick");
    if (execPurchaseProductPick) execPurchaseProductPick.innerHTML = productOptions.join("");
    if (execSalesProductPick) execSalesProductPick.innerHTML = productOptions.join("");
    updateSelectVisualState("poProductPick");
    updateSelectVisualState("soProductPick");
    renderPurchaseAutoHint();
    await refreshSettlementPicks();
    await refreshExecutionPicks();
  } catch (_e) {
    // ignore on roles without supplier/customer read permission
  }
}

async function refreshExecutionPicks() {
  if (!state.token) return;
  try {
    const [warehouses, locations, purchaseOrders, salesOrders] = await Promise.all([
      api("/api/warehouses"),
      api("/api/locations"),
      api("/api/purchase-orders?page=1&pageSize=200&status=approved"),
      api("/api/sales-orders?page=1&pageSize=200&status=approved")
    ]);
    const { rows: poRows } = normalizePagedRows(purchaseOrders);
    const { rows: soRows } = normalizePagedRows(salesOrders);
    const purchaseWarehousePick = document.getElementById("execPurchaseWarehousePick");
    const purchaseLocationPick = document.getElementById("execPurchaseLocationPick");
    const salesWarehousePick = document.getElementById("execSalesWarehousePick");
    const salesLocationPick = document.getElementById("execSalesLocationPick");
    executionOrderCache.purchase = (poRows || []).filter((x) => x.status === "approved" && Number(x.remainingQty ?? 0) > 0.0001);
    executionOrderCache.sales = (soRows || []).filter((x) => x.status === "approved" && Number(x.remainingQty ?? 0) > 0.0001);
    if (purchaseWarehousePick) {
      const opts = ['<option value="">仓库（可选）</option>'];
      (warehouses || []).forEach((w) => opts.push(`<option value="${w.id}">${w.code} ${w.name}</option>`));
      purchaseWarehousePick.innerHTML = opts.join("");
    }
    if (salesWarehousePick) {
      const opts = ['<option value="">仓库（可选）</option>'];
      (warehouses || []).forEach((w) => opts.push(`<option value="${w.id}">${w.code} ${w.name}</option>`));
      salesWarehousePick.innerHTML = opts.join("");
    }
    // 如果仓库只有一个，则采购/销售执行默认带上该仓库，并自动加载其库位；库位若也只有一个则继续默认带上。
    if (purchaseWarehousePick) {
      const selected = autoSelectIfSingle("execPurchaseWarehousePick");
      if (selected) {
        const whId = Number(purchaseWarehousePick.value || 0);
        const locRows = whId > 0 ? await api(`/api/locations?warehouseId=${whId}`) : locations;
        if (purchaseLocationPick) {
          const opts = ['<option value="">库位（可选）</option>'];
          (locRows || []).forEach((l) => opts.push(`<option value="${l.id}">${l.code} ${l.name}</option>`));
          purchaseLocationPick.innerHTML = opts.join("");
          autoSelectIfSingle("execPurchaseLocationPick");
        }
      } else if (purchaseLocationPick) {
        const opts = ['<option value="">库位（可选）</option>'];
        (locations || []).forEach((l) => opts.push(`<option value="${l.id}">WH#${l.warehouseId} ${l.code} ${l.name}</option>`));
        purchaseLocationPick.innerHTML = opts.join("");
      }
    }
    if (salesWarehousePick) {
      const selected = autoSelectIfSingle("execSalesWarehousePick");
      if (selected) {
        const whId = Number(salesWarehousePick.value || 0);
        const locRows = whId > 0 ? await api(`/api/locations?warehouseId=${whId}`) : locations;
        if (salesLocationPick) {
          const opts = ['<option value="">库位（可选）</option>'];
          (locRows || []).forEach((l) => opts.push(`<option value="${l.id}">${l.code} ${l.name}</option>`));
          salesLocationPick.innerHTML = opts.join("");
          autoSelectIfSingle("execSalesLocationPick");
        }
      } else if (salesLocationPick) {
        const opts = ['<option value="">库位（可选）</option>'];
        (locations || []).forEach((l) => opts.push(`<option value="${l.id}">WH#${l.warehouseId} ${l.code} ${l.name}</option>`));
        salesLocationPick.innerHTML = opts.join("");
      }
    }

    // 仓库&库位创建面板的仓库下拉
    const newLocWarehousePick = document.getElementById("newLocationWarehousePick");
    if (newLocWarehousePick) {
      const opts = ['<option value="">选择仓库</option>'];
      (warehouses || []).forEach((w) => opts.push(`<option value="${w.id}">${w.code} ${w.name}</option>`));
      newLocWarehousePick.innerHTML = opts.join("");
      autoSelectIfSingle("newLocationWarehousePick");
    }
    rerenderExecutionOrderOptions("purchase");
    rerenderExecutionOrderOptions("sales");
  } catch (_e) {
    // ignore by permission
  }
}

async function createWarehouseFromForm() {
  ensureToken();
  const code = inputText("newWarehouseCode");
  const name = inputText("newWarehouseName");
  if (name.length < 2) throw new Error("仓库名称至少 2 个字符。");
  const created = await api("/api/warehouses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.length >= 2 ? code : undefined, name })
  });
  document.getElementById("newWarehouseCode").value = "";
  document.getElementById("newWarehouseName").value = "";
  await refreshExecutionPicks();
  log("创建仓库", created);
}

async function createLocationFromForm() {
  ensureToken();
  const warehouseId = selectNum("newLocationWarehousePick");
  const code = inputText("newLocationCode");
  const name = inputText("newLocationName");
  if (!warehouseId) throw new Error("请先选择仓库。");
  if (name.length < 2) throw new Error("库位名称至少 2 个字符。");
  const created = await api("/api/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ warehouseId, code: code.length >= 2 ? code : undefined, name })
  });
  document.getElementById("newLocationCode").value = "";
  document.getElementById("newLocationName").value = "";
  await refreshExecutionPicks();
  log("创建库位", created);
}

async function showExistingWarehousesHint() {
  // legacy fallback (kept for compatibility)
  ensureToken();
  const rows = await api("/api/warehouses");
  const preview = (rows || []).slice(0, 8).map((w) => `${w.code || "-"} ${w.name || "-"}(ID:${w.id})`).join("；");
  const more = (rows || []).length > 8 ? ` …等${rows.length}个` : "";
  showInlineFeedback("whLocActionFeedback", "info", `已有仓库：${preview || "暂无"}${more}`);
}

async function showExistingLocationsHint() {
  // legacy fallback (kept for compatibility)
  ensureToken();
  const warehouseId = Number(selectNum("newLocationWarehousePick") || 0);
  const path = warehouseId > 0 ? `/api/locations?warehouseId=${warehouseId}` : "/api/locations";
  const rows = await api(path);
  const preview = (rows || []).slice(0, 10).map((l) => `${l.code || "-"} ${l.name || "-"}(ID:${l.id})`).join("；");
  const more = (rows || []).length > 10 ? ` …等${rows.length}个` : "";
  showInlineFeedback("whLocActionFeedback", "info", `已有库位：${preview || "暂无"}${more}`);
}

function hideWhLocSuggest() {
  if (whSuggestBox) {
    whSuggestBox.classList.remove("show");
    whSuggestBox.innerHTML = "";
  }
  if (locSuggestBox) {
    locSuggestBox.classList.remove("show");
    locSuggestBox.innerHTML = "";
  }
}

function showWhLocSuggest(targetEl, title, items) {
  if (!targetEl) return;
  const html = [];
  html.push(`<div class="suggest-title">${title}</div>`);
  if (!items.length) {
    html.push(`<div class="suggest-item"><div>暂无数据</div><div class="muted">你可以直接创建新的。</div></div>`);
  } else {
    items.slice(0, 20).forEach((x) => {
      html.push(`<div class="suggest-item"><div>${x.primary}</div><div class="muted">${x.secondary}</div></div>`);
    });
    if (items.length > 20) {
      html.push(`<div class="suggest-item"><div class="muted">… 还有 ${items.length - 20} 条未展示</div></div>`);
    }
  }
  targetEl.innerHTML = html.join("");
  targetEl.classList.add("show");
}

async function showExistingWarehousesDropdown(anchorEl) {
  ensureToken();
  const rows = await api("/api/warehouses");
  const items = (rows || []).map((w) => ({
    primary: `${w.code || "-"}  ${w.name || "-"}`,
    secondary: `ID:${w.id}`
  }));
  if (locSuggestBox) {
    locSuggestBox.classList.remove("show");
    locSuggestBox.innerHTML = "";
  }
  showWhLocSuggest(whSuggestBox, "已有仓库", items);
}

async function showExistingLocationsDropdown(anchorEl) {
  ensureToken();
  const warehouseId = Number(selectNum("newLocationWarehousePick") || 0);
  const rows = await api(warehouseId > 0 ? `/api/locations?warehouseId=${warehouseId}` : "/api/locations");
  const items = (rows || []).map((l) => ({
    primary: `${l.code || "-"}  ${l.name || "-"}`,
    secondary: `ID:${l.id}  |  仓库ID:${l.warehouseId}`
  }));
  if (whSuggestBox) {
    whSuggestBox.classList.remove("show");
    whSuggestBox.innerHTML = "";
  }
  showWhLocSuggest(locSuggestBox, warehouseId > 0 ? `已有库位（仓库ID:${warehouseId}）` : "已有库位", items);
}

function rerenderExecutionOrderOptions(type) {
  const orderPick = document.getElementById(type === "sales" ? "execSalesOrderPick" : "execPurchaseOrderPick");
  if (!orderPick) return;
  const rows = type === "sales" ? executionOrderCache.sales : executionOrderCache.purchase;
  const label = type === "sales" ? "SO" : "PO";
  const opts = ['<option value="">选择已审批订单</option>'];
  rows.forEach((r) => {
    const settlementText =
      type === "sales"
        ? `${zhReceiptStatus(r.receiptStatus)} | 未收:${Number(r.invoiceOpenAmount || 0).toFixed(2)}`
        : `${zhPaymentStatus(r.paymentStatus)} | 未付:${Number(r.billOpenAmount || 0).toFixed(2)}`;
    opts.push(
      `<option value="${r.id}">${label}#${r.id} ${r.orderNo || ""} 金额:${Number(r.totalAmount || 0).toFixed(2)} | ${settlementText}</option>`
    );
  });
  orderPick.innerHTML = opts.join("");
}

async function loadExecutionOrderItems(orderType, orderId) {
  const key = `${orderType}:${orderId}`;
  if (executionOrderItemsCache.has(key)) return executionOrderItemsCache.get(key);
  const path = orderType === "sales" ? `/api/sales-orders/${orderId}` : `/api/purchase-orders/${orderId}`;
  const detail = await api(path);
  const items = detail?.items || [];
  executionOrderItemsCache.set(key, items);
  return items;
}

async function applyExecutionOrderSelection(orderType, orderId) {
  if (!orderId) return;
  const orderIdInput = document.getElementById(orderType === "sales" ? "execSalesOrderId" : "execPurchaseOrderId");
  if (orderIdInput) orderIdInput.value = String(orderId);
  const items = await loadExecutionOrderItems(orderType, orderId);
  const productPick = document.getElementById(orderType === "sales" ? "execSalesProductPick" : "execPurchaseProductPick");
  const batchInput = document.getElementById(orderType === "sales" ? "execSalesBatchNo" : "execPurchaseBatchNo");
  if (!productPick) return;
  const opts = ['<option value="">选择商品</option>'];
  const enriched = (items || []).map((it) => {
    const remaining = Number(
      it.remainingQty ?? (Number(it.qty || 0) - Number(orderType === "sales" ? it.deliveredQty || 0 : it.receivedQty || 0))
    );
    return { ...it, remainingQty: remaining };
  });
  enriched.forEach((it) => {
    const remaining = Number(it.remainingQty || 0);
    const hint = orderType === "sales" ? `剩余未发:${remaining}` : `剩余未收:${remaining}`;
    opts.push(`<option value="${it.productId}">${it.sku || ""} ${it.productName || ""}（${hint} / 订单:${it.qty}）</option>`);
  });
  productPick.innerHTML = opts.join("");

  // Auto-select first remaining item; quantity stays manual.
  const first = enriched.find((x) => Number(x.remainingQty || 0) > 0.0001) || enriched[0];
  if (first && Number(first.productId) > 0) {
    productPick.value = String(first.productId);
    if (batchInput) {
      batchInput.value = getNextBatchNo({ orderType, orderId, productId: Number(first.productId) });
    }
  }
  void validateExecutionQty(orderType);
}

async function validateExecutionQty(orderType) {
  try {
    const orderId = Number(inputNum(orderType === "sales" ? "execSalesOrderId" : "execPurchaseOrderId") || 0);
    const productId = Number(selectNum(orderType === "sales" ? "execSalesProductPick" : "execPurchaseProductPick") || 0);
    const qty = Number(inputNum(orderType === "sales" ? "execSalesQty" : "execPurchaseQty") || 0);
    const feedbackId = orderType === "sales" ? "execSalesFeedback" : "execPurchaseFeedback";
    const btnIds =
      orderType === "sales" ? ["btnCreateDeliveryFlow", "btnCreateSalesReturnFlow"] : ["btnCreateReceiptFlow", "btnCreatePurchaseReturnFlow"];
    if (!orderId || !productId || !(qty > 0)) {
      btnIds.forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
      });
      return true;
    }
    const items = await loadExecutionOrderItems(orderType, orderId);
    const item = (items || []).find((x) => Number(x.productId || 0) === productId);
    const remaining = Number(
      item?.remainingQty ?? (Number(item?.qty || 0) - Number(orderType === "sales" ? item?.deliveredQty || 0 : item?.receivedQty || 0))
    );
    const ok = qty <= remaining + 0.0001;
    btnIds.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !ok;
    });
    if (!ok) {
      showInlineFeedback(feedbackId, "error", `数量超出剩余可执行：${qty} > ${Math.max(0, remaining).toFixed(2)}`);
    } else {
      clearInlineFeedback(feedbackId);
    }
    return ok;
  } catch (_e) {
    return true;
  }
}

async function refreshSettlementPicks() {
  if (!state.token) return;
  try {
    const [arPayload, apPayload] = await Promise.all([
      api("/api/ar/invoices?page=1&pageSize=200"),
      api("/api/ap/bills?page=1&pageSize=200")
    ]);
    const { rows: arRows } = normalizePagedRows(arPayload);
    const { rows: apRows } = normalizePagedRows(apPayload);
    settlementPickCache.ar = (arRows || []).filter((r) => Number(r.totalAmount || 0) - Number(r.receivedAmount || 0) > 0.0001);
    settlementPickCache.ap = (apRows || []).filter((r) => Number(r.totalAmount || 0) - Number(r.paidAmount || 0) > 0.0001);
    renderSettlementPicksFromCache();
  } catch (_e) {
    // ignore by permission
  }
}

function renderSettlementPicksFromCache() {
  const arRows = settlementPickCache.ar || [];
  const apRows = settlementPickCache.ap || [];
  const pickedCustomerId = Number(selectNum("rcCustomerPick") || 0);
  const pickedSupplierId = Number(selectNum("pySupplierPick") || 0);
  try {
    const arSelect = document.getElementById("rcArPick");
    const apSelect = document.getElementById("pyApPick");
    if (arSelect) {
      const curr = arSelect.value;
      const opts = ['<option value="">请选择应收单据（未结）</option>'];
      (arRows || []).forEach((r) => {
        if (pickedCustomerId > 0 && Number(r.customerId || 0) !== pickedCustomerId) return;
        const open = Number(r.totalAmount || 0) - Number(r.receivedAmount || 0);
        opts.push(
          `<option value="${r.id}" data-customer-id="${Number(r.customerId || 0)}">${r.invoiceNo || `AR-${r.id}`} | 客户:${r.customerName || "-"} | 未收:${open.toFixed(2)} | ${zhArFulfillmentStatus(r.fulfillmentStatus)}</option>`
        );
      });
      arSelect.innerHTML = opts.join("");
      if (curr) arSelect.value = curr;
      updateSelectVisualState("rcArPick");
    }
    if (apSelect) {
      const curr = apSelect.value;
      const opts = ['<option value="">请选择应付单据（未结）</option>'];
      (apRows || []).forEach((r) => {
        if (pickedSupplierId > 0 && Number(r.supplierId || 0) !== pickedSupplierId) return;
        const open = Number(r.totalAmount || 0) - Number(r.paidAmount || 0);
        opts.push(
          `<option value="${r.id}" data-supplier-id="${Number(r.supplierId || 0)}">${r.billNo || `AP-${r.id}`} | 供应商:${r.supplierName || "-"} | 未付:${open.toFixed(2)} | ${zhApFulfillmentStatus(r.fulfillmentStatus)}</option>`
        );
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
  const ar = document.getElementById("rcArPick")?.selectedOptions?.[0]?.textContent?.trim() || "未选择应收单据";
  const amount = Number(inputNum("rcAmount") || 0);
  el.textContent = `预览：客户 ${customer}；应收 ${ar}；收款金额 ${amount ? amount.toFixed(2) : "-"}`;
}

function renderPaymentPreviewHint() {
  const el = document.getElementById("pyPreviewHint");
  if (!el) return;
  const supplier = document.getElementById("pySupplierPick")?.selectedOptions?.[0]?.textContent?.trim() || "-";
  const ap = document.getElementById("pyApPick")?.selectedOptions?.[0]?.textContent?.trim() || "未选择应付单据";
  const amount = Number(inputNum("pyAmount") || 0);
  el.textContent = `预览：供应商 ${supplier}；应付 ${ap}；付款金额 ${amount ? amount.toFixed(2) : "-"}`;
}

function pickOpenAmount(kind) {
  if (kind === "receipt") {
    const id = Number(selectNum("rcArPick") || 0);
    const row = (settlementPickCache.ar || []).find((x) => Number(x.id || 0) === id);
    return row ? Math.max(0, Number(row.totalAmount || 0) - Number(row.receivedAmount || 0)) : 0;
  }
  const id = Number(selectNum("pyApPick") || 0);
  const row = (settlementPickCache.ap || []).find((x) => Number(x.id || 0) === id);
  return row ? Math.max(0, Number(row.totalAmount || 0) - Number(row.paidAmount || 0)) : 0;
}

function applyAmountShortcut(kind, ratio) {
  const open = pickOpenAmount(kind);
  const targetId = kind === "receipt" ? "rcAmount" : "pyAmount";
  const input = document.getElementById(targetId);
  if (!input) return;
  const v = ratio <= 0 ? 0 : open * ratio;
  input.value = v > 0 ? v.toFixed(2) : "";
  if (kind === "receipt") renderReceiptPreviewHint();
  else renderPaymentPreviewHint();
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
    const pickId = Number(selectNum("rcArPick") || 0);
    if (pickId > 0) state.arInvoiceId = pickId;
  }
  if (!state.arInvoiceId) {
    const pickedCustomerId = Number(customerId || 0);
    const openForCustomer = (settlementPickCache.ar || []).filter(
      (x) => Number(x.customerId || 0) === pickedCustomerId && Number(x.totalAmount || 0) - Number(x.receivedAmount || 0) > 0.0001
    );
    if (openForCustomer.length === 1) {
      state.arInvoiceId = Number(openForCustomer[0].id || 0) || null;
      const sel = document.getElementById("rcArPick");
      if (sel) sel.value = String(state.arInvoiceId || "");
      updateSelectVisualState("rcArPick");
      renderReceiptPreviewHint();
    }
  }
  if (!state.arInvoiceId) {
    showPickOptionHint("收款单：请选择要收款的应收单据（未结）。");
    focusFirst(["rcArPick"]);
    throw new Error("收款参数无效：请先选择应收单据（未结）。");
  }
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
    const pickId = Number(selectNum("pyApPick") || 0);
    if (pickId > 0) state.apBillId = pickId;
  }
  if (!state.apBillId) {
    const pickedSupplierId = Number(supplierId || 0);
    const openForSupplier = (settlementPickCache.ap || []).filter(
      (x) => Number(x.supplierId || 0) === pickedSupplierId && Number(x.totalAmount || 0) - Number(x.paidAmount || 0) > 0.0001
    );
    if (openForSupplier.length === 1) {
      state.apBillId = Number(openForSupplier[0].id || 0) || null;
      const sel = document.getElementById("pyApPick");
      if (sel) sel.value = String(state.apBillId || "");
      updateSelectVisualState("pyApPick");
      renderPaymentPreviewHint();
    }
  }
  if (!state.apBillId) {
    showPickOptionHint("付款单：请选择要付款的应付单据（未结）。");
    focusFirst(["pyApPick"]);
    throw new Error("付款参数无效：请先选择应付单据（未结）。");
  }
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

function readExecPayload(prefix) {
  const orderId = Number(inputNum(`${prefix}OrderId`) || 0);
  const productId = Number(selectNum(`${prefix}ProductPick`) || 0);
  const qty = Number(inputNum(`${prefix}Qty`) || 0);
  const warehouseId = Number(selectNum(`${prefix}WarehousePick`) || 0);
  const locationId = Number(selectNum(`${prefix}LocationPick`) || 0);
  const batchNo = inputText(`${prefix}BatchNo`) || undefined;
  if (!orderId || !productId || !(qty > 0)) throw new Error("执行参数无效：请填写订单ID、商品和数量。");
  return {
    orderId,
    warehouseId: warehouseId || undefined,
    locationId: locationId || undefined,
    items: [{ productId, qty, batchNo }]
  };
}

async function createPurchaseReceiptFlow() {
  if (executionSubmitting.purchase) throw new Error("采购执行处理中，请勿重复提交。");
  executionSubmitting.purchase = true;
  const btnA = document.getElementById("btnCreateReceiptFlow");
  const btnB = document.getElementById("btnCreatePurchaseReturnFlow");
  if (btnA) btnA.disabled = true;
  if (btnB) btnB.disabled = true;
  try {
  ensureToken();
  const payload = readExecPayload("execPurchase");
  const result = await api(`/api/purchase-orders/${payload.orderId}/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  bumpBatchSeq({ orderType: "purchase", orderId: payload.orderId, productId: payload.items?.[0]?.productId });
  await refreshExecutionAfterAction("purchase", payload.orderId);
  await refreshAll({ source: "manual" });
  log("采购收货", result);
  } finally {
    executionSubmitting.purchase = false;
    if (btnA) btnA.disabled = false;
    if (btnB) btnB.disabled = false;
  }
}

async function createSalesDeliveryFlow() {
  if (executionSubmitting.sales) throw new Error("销售执行处理中，请勿重复提交。");
  executionSubmitting.sales = true;
  const btnA = document.getElementById("btnCreateDeliveryFlow");
  const btnB = document.getElementById("btnCreateSalesReturnFlow");
  if (btnA) btnA.disabled = true;
  if (btnB) btnB.disabled = true;
  try {
  ensureToken();
  const payload = readExecPayload("execSales");
  const result = await api(`/api/sales-orders/${payload.orderId}/deliveries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  bumpBatchSeq({ orderType: "sales", orderId: payload.orderId, productId: payload.items?.[0]?.productId });
  await refreshExecutionAfterAction("sales", payload.orderId);
  await refreshAll({ source: "manual" });
  log("销售发货", result);
  } finally {
    executionSubmitting.sales = false;
    if (btnA) btnA.disabled = false;
    if (btnB) btnB.disabled = false;
  }
}

async function createPurchaseReturnFlow() {
  if (executionSubmitting.purchase) throw new Error("采购执行处理中，请勿重复提交。");
  executionSubmitting.purchase = true;
  const btnA = document.getElementById("btnCreateReceiptFlow");
  const btnB = document.getElementById("btnCreatePurchaseReturnFlow");
  if (btnA) btnA.disabled = true;
  if (btnB) btnB.disabled = true;
  try {
  ensureToken();
  const payload = readExecPayload("execPurchase");
  const result = await api(`/api/purchase-orders/${payload.orderId}/returns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  bumpBatchSeq({ orderType: "purchase", orderId: payload.orderId, productId: payload.items?.[0]?.productId });
  await refreshExecutionAfterAction("purchase", payload.orderId);
  await refreshAll({ source: "manual" });
  log("采购退货", result);
  } finally {
    executionSubmitting.purchase = false;
    if (btnA) btnA.disabled = false;
    if (btnB) btnB.disabled = false;
  }
}

async function createSalesReturnFlow() {
  if (executionSubmitting.sales) throw new Error("销售执行处理中，请勿重复提交。");
  executionSubmitting.sales = true;
  const btnA = document.getElementById("btnCreateDeliveryFlow");
  const btnB = document.getElementById("btnCreateSalesReturnFlow");
  if (btnA) btnA.disabled = true;
  if (btnB) btnB.disabled = true;
  try {
  ensureToken();
  const payload = readExecPayload("execSales");
  const result = await api(`/api/sales-orders/${payload.orderId}/returns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  bumpBatchSeq({ orderType: "sales", orderId: payload.orderId, productId: payload.items?.[0]?.productId });
  await refreshExecutionAfterAction("sales", payload.orderId);
  await refreshAll({ source: "manual" });
  log("销售退货", result);
  } finally {
    executionSubmitting.sales = false;
    if (btnA) btnA.disabled = false;
    if (btnB) btnB.disabled = false;
  }
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
  const payload = await api(
    `/api/purchase-orders?page=${approvalPager.page}&pageSize=${approvalPager.pageSize}&q=${encodeURIComponent(
      approvalSearchValue()
    )}&status=${encodeURIComponent(approvalStatusFilterValue())}&stage=${encodeURIComponent(
      approvalStageFilterValue()
    )}&actionableOnly=${document.getElementById("chkApprovalActionableOnly")?.checked ? "1" : "0"}`
  );
  const { rows, total, page, pageSize } = normalizePagedRows(payload);
  approvalPager.total = total;
  approvalPager.page = page;
  approvalPager.pageSize = pageSize;
  approvalRowsKind = "purchase";
  approvalRowsCache = rows;
  approvalCheckedIds.clear();
  const idInput = document.getElementById("approvalOrderId");
  if (idInput) idInput.value = "";
  syncApprovalSelectedIdHint();
  setRejectInputVisible(false);
  void enrichApprovalRejectSummaries(approvalRowsCache, "purchase");
  setApprovalStatusFilter("all");
  setApprovalQuickFilterDefault();
  renderApprovalTableFromCache();
  syncApprovalPagerInfo();
  log("审批-采购单", rows);
  syncApprovalContextLabel();
  syncApprovalViewLabel();
  renderRoleTodoFocus();
}

async function loadSalesApprovals() {
  ensureToken();
  approvalType = "sales";
  currentApprovalView = "sales";
  const payload = await api(
    `/api/sales-orders?page=${approvalPager.page}&pageSize=${approvalPager.pageSize}&q=${encodeURIComponent(
      approvalSearchValue()
    )}&status=${encodeURIComponent(approvalStatusFilterValue())}&stage=${encodeURIComponent(
      approvalStageFilterValue()
    )}&actionableOnly=${document.getElementById("chkApprovalActionableOnly")?.checked ? "1" : "0"}`
  );
  const { rows, total, page, pageSize } = normalizePagedRows(payload);
  approvalPager.total = total;
  approvalPager.page = page;
  approvalPager.pageSize = pageSize;
  approvalRowsKind = "sales";
  approvalRowsCache = rows;
  approvalCheckedIds.clear();
  const idInput = document.getElementById("approvalOrderId");
  if (idInput) idInput.value = "";
  syncApprovalSelectedIdHint();
  setRejectInputVisible(false);
  void enrichApprovalRejectSummaries(approvalRowsCache, "sales");
  setApprovalStatusFilter("all");
  setApprovalQuickFilterDefault();
  renderApprovalTableFromCache();
  syncApprovalPagerInfo();
  log("审批-销售单", rows);
  syncApprovalContextLabel();
  syncApprovalViewLabel();
  renderRoleTodoFocus();
}

async function loadPendingApprovals() {
  ensureToken();
  currentApprovalView = "pending";
  const payload = await api(
    `/api/approvals/pending?page=${approvalPager.page}&pageSize=${approvalPager.pageSize}&q=${encodeURIComponent(
      approvalSearchValue()
    )}&status=${encodeURIComponent(approvalStatusFilterValue())}&stage=${encodeURIComponent(approvalStageFilterValue())}`
  );
  const { rows, total, page, pageSize } = normalizePagedRows(payload);
  approvalPager.total = total;
  approvalPager.page = page;
  approvalPager.pageSize = pageSize;
  approvalRowsKind = "pending";
  approvalRowsCache = rows;
  approvalCheckedIds.clear();
  const idInput = document.getElementById("approvalOrderId");
  if (idInput) idInput.value = "";
  syncApprovalSelectedIdHint();
  setRejectInputVisible(false);
  void enrichApprovalRejectSummaries(approvalRowsCache, approvalType);
  // pending view: default to actionable submitted items
  setApprovalStatusFilter("submitted");
  const box = document.getElementById("chkApprovalActionableOnly");
  if (box) box.checked = true;
  setApprovalQuickFilterDefault();
  renderApprovalTableFromCache();
  syncApprovalPagerInfo();
  log("审批-我的待审批", rows);
  syncApprovalContextLabel("mixed");
  syncApprovalViewLabel();
  renderRoleTodoFocus();
}

async function loadAbnormalApprovals() {
  ensureToken();
  approvalPager.page = 1;
  resetApprovalListFilters();
  const stageEl = document.getElementById("approvalStageFilter");
  if (stageEl) stageEl.value = "abnormal";
  if (hasPermission("purchase:read")) {
    await loadPurchaseApprovals();
  } else if (hasPermission("sales:read")) {
    await loadSalesApprovals();
  } else if (hasPermission("purchase:approve") || hasPermission("sales:approve")) {
    await loadPendingApprovals();
  }
  setApprovalStatusFilter("all");
  const box = document.getElementById("chkApprovalActionableOnly");
  if (box) box.checked = false;
  if (stageEl) stageEl.value = "abnormal";
  renderApprovalTableFromCache();
  syncApprovalPagerInfo();
  const shown = getFilteredApprovalRows(approvalRowsCache || []);
  if (!shown.length) {
    showActionWarn("当前没有异常单据。");
  }
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
  approvalSelectedRow = row || null;
  approvalType = orderType === "sales" ? "sales" : "purchase";
  syncApprovalContextLabel();
  syncApprovalSelectedIdHint();
  approvalDetail.innerHTML = "<div class='muted'>正在加载表头与明细…</div>";
  void loadApprovalOrderDetail(orderType, row.id);
  // Auto-load timeline when a row is selected.
  approvalTimeline.innerHTML = "<div class='muted'>正在加载审批时间轴…</div>";
  void loadApprovalTimeline().catch((e) => {
    approvalTimeline.innerHTML = `<div class='warn'>审批时间轴加载失败：${escapeHtml(e?.message || String(e))}</div>`;
  });
}

async function loadApprovalOrderDetail(orderType, id) {
  const oid = Number(id);
  if (!Number.isFinite(oid) || oid <= 0) {
    approvalDetail.innerHTML = "<div class='warn'>无效的单据 ID。</div>";
    return;
  }
  const path = orderType === "sales" ? `/api/sales-orders/${oid}` : `/api/purchase-orders/${oid}`;
  try {
    const data = await api(path);
    const timeline = await api(`/api/approvals/${orderType}/${oid}/timeline`).catch(() => []);
    const rejectMeta = extractLatestRejectMeta(timeline);
    approvalDetail.innerHTML = renderApprovalDetailHtml(orderType, data, rejectMeta);
  } catch (e) {
    const typeText = orderType === "sales" ? "销售单" : "采购单";
    approvalDetail.innerHTML = `<div class="warn">【${typeText}详情加载失败】</div>
      <div class="muted">单据ID：${oid}</div>
      <div class="muted">原因：${escapeHtml(e.message || e)}</div>
      <div class="muted">可尝试：先点击“加载采购单/销售单”刷新列表后重试。</div>`;
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
    const parseDetail = (v) => {
      if (!v) return null;
      if (typeof v === "object") return v;
      try {
        return JSON.parse(String(v));
      } catch (_e) {
        return null;
      }
    };
    const humanAction = (action) => {
      const s = String(action || "");
      const tail = s.includes(".") ? s.split(".").pop() : s;
      const zh = zhApprovalAction(tail);
      if (zh && zh !== tail) return zh;
      if (tail === "create") return "创建";
      if (tail === "submit") return "提交";
      if (tail === "approve") return "审批通过";
      if (tail === "reject") return "驳回";
      if (tail === "void") return "作废";
      if (tail === "reverse") return "冲销";
      return s || "未知动作";
    };
    approvalTimeline.innerHTML = `<div class="approval-timeline-list">${rows
      .map((r) => {
        const d = parseDetail(r.detail);
        const fromTo =
          d && (d.from || d.to)
            ? `<div class="approval-timeline-line"><span class="muted">状态流转：</span>${escapeHtml(
                zhOrderStatus(d.from || "-")
              )} → ${escapeHtml(zhOrderStatus(d.to || "-"))}</div>`
            : "";
        const comment = d && d.comment ? `<div class="approval-timeline-line"><span class="muted">审批意见：</span>${escapeHtml(d.comment)}</div>` : "";
        const biz =
          d && (d.orderNo || d.totalAmount != null || d.supplierId || d.customerId)
            ? `<div class="approval-timeline-line"><span class="muted">业务信息：</span>${escapeHtml(
                [d.orderNo ? `单号 ${d.orderNo}` : "", d.supplierId ? `供应商 ${d.supplierId}` : "", d.customerId ? `客户 ${d.customerId}` : "", d.totalAmount != null ? `金额 ${d.totalAmount}` : ""]
                  .filter(Boolean)
                  .join("，")
              )}</div>`
            : "";
        const raw = r.detail
          ? `<details class="approval-timeline-raw"><summary>展开原始详情</summary><pre>${escapeHtml(
              typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail, null, 2)
            )}</pre></details>`
          : "";
        return `<div class="approval-timeline-item">
          <div class="approval-timeline-title">${escapeHtml(humanAction(r.action))}</div>
          <div class="approval-timeline-meta">${escapeHtml(r.createdAt || "-")} · ${escapeHtml(r.username || "system")}</div>
          ${fromTo}
          ${comment}
          ${biz}
          ${raw}
        </div>`;
      })
      .join("")}</div>`;
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
    const nextStatusText = zhOrderStatus(res?.nextStatus || "rejected");
    log("审批提示", `单据已驳回，状态变更为「${nextStatusText}」。可修改后再次提交。`);
    showApprovalActionHint(`已驳回，当前状态：${nextStatusText}。`);
  }
  if (action !== "reject") setRejectInputVisible(false);
  await loadPendingApprovals();
  await loadApprovalOrderDetail(approvalType, id);
}

async function doApprovalActionById(orderType, id, action, comment = "") {
  const route = orderType === "purchase" ? `/api/purchase-orders/${id}/action` : `/api/sales-orders/${id}/action`;
  return api(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, comment })
  });
}

async function doBatchApprovalAction(action) {
  ensureToken();
  const raw = String(document.getElementById("approvalBatchIds")?.value || "").trim();
  const typedIds = raw
    .split(/[,\s]+/)
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  const ids = approvalCheckedIds.size ? Array.from(approvalCheckedIds) : typedIds;
  if (!ids.length) throw new Error("请先输入批量审批ID。");
  const comment = String(document.getElementById("approvalComment")?.value || "").trim();
  if (action === "reject" && !comment) throw new Error("批量驳回前请填写驳回意见。");
  const okToRun = window.confirm(`将批量执行「${zhApprovalAction(action)}」共 ${ids.length} 条，是否继续？`);
  if (!okToRun) return;
  const mixed = approvalRowsKind === "pending";
  const items = ids
    .map((id) => {
      const row = (approvalRowsCache || []).find((x) => Number(x.id || 0) === id);
      const t =
        approvalRowsKind === "pending"
          ? String(row?.orderType || approvalType || "purchase")
          : String(approvalType || "purchase");
      return { orderType: t === "sales" ? "sales" : "purchase", id };
    })
    .filter((x) => x.id > 0);
  const payload = mixed ? { orderType: "mixed", action, items, comment: comment || undefined } : { orderType: approvalType, action, ids, comment: comment || undefined };
  const result = await api("/api/approvals/batch-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const ok = Number(result?.successCount || 0);
  const fail = Number(result?.failureCount || 0);
  const failures = Array.isArray(result?.failures) ? result.failures : [];
  showActionOk(`批量${zhApprovalAction(action)}完成：成功 ${ok}，失败 ${fail}`);
  if (fail > 0 && failures.length) {
    downloadCsv(
      `approval_batch_failures_${Date.now()}.csv`,
      failures,
      [
        { label: "ID", getter: (r) => r.id },
        { label: "失败原因", getter: (r) => r.reason }
      ]
    );
  }
  if (currentApprovalView === "pending") await loadPendingApprovals();
  else if (approvalType === "sales") await loadSalesApprovals();
  else await loadPurchaseApprovals();
}

function fillBatchIdsFromCurrentFilter() {
  const rows = getFilteredApprovalRows(approvalRowsCache || []);
  const ids = rows
    .map((r) => Number(r.id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);
  const input = document.getElementById("approvalBatchIds");
  if (!input) return;
  input.value = ids.join(",");
  if (!ids.length) {
    showActionWarn("当前筛选结果没有可填充的ID。");
    return;
  }
  showActionOk(`已填充 ${ids.length} 条ID。`);
}

function selectAllApprovalRows() {
  const rows = getFilteredApprovalRows(approvalRowsCache || []);
  rows.forEach((r) => {
    const id = Number(r?.id || 0);
    if (id > 0) approvalCheckedIds.add(id);
  });
  const input = document.getElementById("approvalBatchIds");
  if (input) input.value = Array.from(approvalCheckedIds).join(",");
  renderApprovalTableFromCache();
  showActionOk(`已勾选 ${approvalCheckedIds.size} 条。`);
}

function jumpToAbnormalReason() {
  if (!approvalSelectedRow) {
    showActionWarn("请先在审批列表选择一条单据。");
    return;
  }
  const kind = approvalRowsKind === "pending" ? String(approvalSelectedRow.orderType || approvalType || "purchase") : approvalRowsKind;
  const stageKey = kind === "sales" ? approvalStageKeyFromRow(approvalSelectedRow) : approvalStageKeyFromRow(approvalSelectedRow);
  if (stageKey !== "abnormal") {
    showActionWarn("当前单据不是异常阶段。");
    return;
  }
  document.getElementById("approvalOrderId").value = String(approvalSelectedRow.id || "");
  loadApprovalTimeline();
  showApprovalActionHint("已定位异常：请先看时间轴，再看右侧单据详情中的阶段依据。");
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
      const successTips = {
        btnConfirmPurchase: "采购单已创建",
        btnConfirmSales: "销售单已创建",
        btnConfirmReceipt: "收款单已创建",
        btnConfirmPayment: "付款单已创建",
        btnCreateReceiptFlow: "采购收货已提交",
        btnCreateDeliveryFlow: "销售发货已提交",
        btnCreatePurchaseReturnFlow: "采购退货已提交",
        btnCreateSalesReturnFlow: "销售退货已提交",
        btnWarehouseCreate: "仓库已创建",
        btnLocationCreate: "库位已创建"
      };
      const inlineSuccessMap = {
        btnConfirmPurchase: "poActionFeedback",
        btnConfirmSales: "soActionFeedback",
        btnConfirmReceipt: "rcActionFeedback",
        btnConfirmPayment: "pyActionFeedback",
        btnCreateReceiptFlow: "execPurchaseFeedback",
        btnCreatePurchaseReturnFlow: "execPurchaseFeedback",
        btnCreateDeliveryFlow: "execSalesFeedback",
        btnCreateSalesReturnFlow: "execSalesFeedback",
        btnWarehouseCreate: "whLocActionFeedback",
        btnLocationCreate: "whLocActionFeedback"
      };
      clearInlineFeedback();
      if (successTips[id]) {
        showActionOk(successTips[id]);
        if (inlineSuccessMap[id]) {
          showInlineFeedback(inlineSuccessMap[id], "success", `成功：${successTips[id]}`);
        } else {
          showActionToast("success", successTips[id]);
        }
      }
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
      const inlineErrorMap = {
        btnConfirmPurchase: "poActionFeedback",
        btnConfirmSales: "soActionFeedback",
        btnConfirmReceipt: "rcActionFeedback",
        btnConfirmPayment: "pyActionFeedback",
        btnCreateReceiptFlow: "execPurchaseFeedback",
        btnCreatePurchaseReturnFlow: "execPurchaseFeedback",
        btnCreateDeliveryFlow: "execSalesFeedback",
        btnCreateSalesReturnFlow: "execSalesFeedback",
        btnWarehouseCreate: "whLocActionFeedback",
        btnLocationCreate: "whLocActionFeedback"
      };
      clearInlineFeedback();
      if (approvalActionIds.has(id)) showApprovalActionHint(msg);
      if (id !== "btnLogin") {
        showActionWarn(msg);
        if (inlineErrorMap[id]) {
          showInlineFeedback(inlineErrorMap[id], "error", `失败：${msg}`);
        } else {
          showActionToast("error", msg);
        }
      }
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
  const meta = serverPager.ar;
  const payload = await api(`/api/ar/invoices?page=${meta.page}&pageSize=${meta.pageSize}`);
  const { rows, total, page, pageSize } = normalizePagedRows(payload);
  meta.total = total;
  meta.page = page;
  meta.pageSize = pageSize;
  cache.ar = rows;
  rerenderFromCache("ar");
  syncSimplePager("ar", "应收");
  updateKpis();
  log("应收发票", rows);
  renderRoleTodoFocus();
}
function renderArFromCache() {
  const rows = cache.ar;
  const stageFilter = String(document.getElementById("arStageFilter")?.value || "all");
  const sortMode = String(document.getElementById("arSort")?.value || "id_desc");
  let filtered = rows.filter((r) =>
    textMatchEx(r, ["invoiceNo", "customerName", "status"], filters.ar.value.trim(), [
      (row) => zhArApStatus(row.status),
      (row) => zhArFulfillmentStatus(row.fulfillmentStatus),
      (row) => stageLabelFromKey(arStageKeyFromRow(row), "sales")
    ])
  );
  if (stageFilter !== "all") {
    filtered = filtered.filter((r) => arStageKeyFromRow(r) === stageFilter);
  }
  if (sortMode === "stage_abnormal_first") {
    const weight = (r) => {
      const k = arStageKeyFromRow(r);
      if (k === "abnormal") return 0;
      if (k === "todo") return 1;
      if (k === "doing") return 2;
      if (k === "wait_settle") return 3;
      if (k === "settling") return 4;
      if (k === "done") return 5;
      return 9;
    };
    filtered = [...filtered].sort((a, b) => weight(a) - weight(b) || Number(b.id || 0) - Number(a.id || 0));
  }
  renderTable(
    tableTargets.ar,
    filtered,
    [
      { label: "ID", getter: (r) => r.id },
      { label: "发票号", getter: (r) => r.invoiceNo },
      { label: "客户", getter: (r) => r.customerName },
      { label: "阶段", getter: (r) => stageBadgeHtml(stageLabelFromKey(arStageKeyFromRow(r), "sales")) },
      { label: "发货", getter: (r) => zhArFulfillmentStatus(r.fulfillmentStatus) },
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
  const meta = serverPager.ap;
  const payload = await api(`/api/ap/bills?page=${meta.page}&pageSize=${meta.pageSize}`);
  const { rows, total, page, pageSize } = normalizePagedRows(payload);
  meta.total = total;
  meta.page = page;
  meta.pageSize = pageSize;
  cache.ap = rows;
  rerenderFromCache("ap");
  syncSimplePager("ap", "应付");
  updateKpis();
  log("应付账单", rows);
  renderRoleTodoFocus();
}
function renderApFromCache() {
  const rows = cache.ap;
  const stageFilter = String(document.getElementById("apStageFilter")?.value || "all");
  const sortMode = String(document.getElementById("apSort")?.value || "id_desc");
  let filtered = rows.filter((r) =>
    textMatchEx(r, ["billNo", "supplierName", "status"], filters.ap.value.trim(), [
      (row) => zhArApStatus(row.status),
      (row) => zhApFulfillmentStatus(row.fulfillmentStatus),
      (row) => stageLabelFromKey(apStageKeyFromRow(row), "purchase")
    ])
  );
  if (stageFilter !== "all") {
    filtered = filtered.filter((r) => apStageKeyFromRow(r) === stageFilter);
  }
  if (sortMode === "stage_abnormal_first") {
    const weight = (r) => {
      const k = apStageKeyFromRow(r);
      if (k === "abnormal") return 0;
      if (k === "todo") return 1;
      if (k === "doing") return 2;
      if (k === "wait_settle") return 3;
      if (k === "settling") return 4;
      if (k === "done") return 5;
      return 9;
    };
    filtered = [...filtered].sort((a, b) => weight(a) - weight(b) || Number(b.id || 0) - Number(a.id || 0));
  }
  renderTable(
    tableTargets.ap,
    filtered,
    [
      { label: "ID", getter: (r) => r.id },
      { label: "账单号", getter: (r) => r.billNo },
      { label: "供应商", getter: (r) => r.supplierName },
      { label: "阶段", getter: (r) => stageBadgeHtml(stageLabelFromKey(apStageKeyFromRow(r), "purchase")) },
      { label: "收货", getter: (r) => zhApFulfillmentStatus(r.fulfillmentStatus) },
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
        journalDetail.innerHTML = renderJournalDetailHtml(full ?? row);
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
  const appShell = document.getElementById("appShell");
  if (appShell) {
    const formPanels = new Set(["panelCreate", "panelTrend"]);
    const mode = formPanels.has(panelId) ? "form" : "table";
    appShell.classList.toggle("mode-form", mode === "form");
    appShell.classList.toggle("mode-table", mode === "table");
  }
  const mainWorkspaceCard = document.getElementById("mainWorkspaceCard");
  if (mainWorkspaceCard) {
    mainWorkspaceCard.style.display = panelId === "panelCreate" ? "" : "none";
  }
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.panel === panelId);
  });
  moduleNavButtons.forEach((btn) => {
    btn.classList.toggle("nav-active", btn.dataset.panel === panelId);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
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
bind("btnLoadPoApprovals", async () => {
  resetApprovalListFilters();
  approvalPager.page = 1;
  await loadPurchaseApprovals();
});
bind("btnLoadSoApprovals", async () => {
  resetApprovalListFilters();
  approvalPager.page = 1;
  await loadSalesApprovals();
});
bind("btnLoadPendingApprovals", async () => {
  approvalPager.page = 1;
  await loadPendingApprovals();
});
bind("btnLoadAbnormalApprovals", async () => {
  approvalPager.page = 1;
  await loadAbnormalApprovals();
});
bind("btnResetApprovalView", loadRoleApprovalWorkspace);
bind("btnLoadApprovalSla", loadApprovalSla);
bind("btnLoadOverdueApprovals", loadOverdueApprovals);
bind("btnLoadTimeline", loadApprovalTimeline);
bind("btnApprovalPrev", async () => {
  approvalPager.page = Math.max(1, approvalPager.page - 1);
  if (currentApprovalView === "pending") await loadPendingApprovals();
  else if (currentApprovalView === "sales") await loadSalesApprovals();
  else await loadPurchaseApprovals();
});
bind("btnApprovalNext", async () => {
  approvalPager.page += 1;
  if (currentApprovalView === "pending") await loadPendingApprovals();
  else if (currentApprovalView === "sales") await loadSalesApprovals();
  else await loadPurchaseApprovals();
});
bind("btnApprovalJump", async () => {
  const v = Number(document.getElementById("approvalPageJump")?.value || 0);
  if (!(v > 0)) return;
  approvalPager.page = v;
  if (currentApprovalView === "pending") await loadPendingApprovals();
  else if (currentApprovalView === "sales") await loadSalesApprovals();
  else await loadPurchaseApprovals();
});
document.getElementById("approvalPageSize")?.addEventListener("change", async (e) => {
      approvalPager.pageSize = Number(e.target.value || 10);
  approvalPager.page = 1;
  savePagerPrefs();
  if (currentApprovalView === "pending") await loadPendingApprovals();
  else if (currentApprovalView === "sales") await loadSalesApprovals();
  else await loadPurchaseApprovals();
});
bind("btnSubmitApproval", async () => doApprovalAction("submit"));
bind("btnApproveApproval", async () => doApprovalAction("approve"));
bind("btnSelectAllApprovalRows", selectAllApprovalRows);
bind("btnFillBatchIds", fillBatchIdsFromCurrentFilter);
bind("btnBatchApprove", async () => doBatchApprovalAction("approve"));
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
bind("btnBatchReject", async () => doBatchApprovalAction("reject"));
bind("btnCancelRejectInput", async () => {
  setRejectInputVisible(false);
  const commentInput = document.getElementById("approvalComment");
  if (commentInput) commentInput.placeholder = "请填写驳回意见（必填）";
});
bind("btnVoidApproval", async () => doApprovalAction("void"));
bind("btnReverseApproval", async () => doApprovalAction("reverse"));
bind("btnJumpAbnormal", jumpToAbnormalReason);
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
bind("btnRcAmountFull", () => applyAmountShortcut("receipt", 1));
bind("btnRcAmountHalf", () => applyAmountShortcut("receipt", 0.5));
bind("btnRcAmountClear", () => applyAmountShortcut("receipt", 0));
bind("btnPyAmountFull", () => applyAmountShortcut("payment", 1));
bind("btnPyAmountHalf", () => applyAmountShortcut("payment", 0.5));
bind("btnPyAmountClear", () => applyAmountShortcut("payment", 0));
bind("btnWarehouseCreate", createWarehouseFromForm);
bind("btnLocationCreate", createLocationFromForm);
bind("btnCreateReceiptFlow", createPurchaseReceiptFlow);
bind("btnCreateDeliveryFlow", createSalesDeliveryFlow);
bind("btnCreatePurchaseReturnFlow", createPurchaseReturnFlow);
bind("btnCreateSalesReturnFlow", createSalesReturnFlow);
bind("btnAr", async () => {
  serverPager.ar.page = 1;
  await queryAr();
});
bind("btnAp", async () => {
  serverPager.ap.page = 1;
  await queryAp();
});
bind("btnJournals", queryJournals);
bind("btnTrend", queryTrend);
bind("btnAudit", queryAudit);
bind("btnAlerts", queryAlerts);
bind("btnRefreshAll", refreshAll);
bind("btnRunAll", runAll);
trendDays?.addEventListener("change", () => {
  void queryTrend();
});
trendViewMode?.addEventListener("change", () => {
  if (cache.trend.length) {
    renderTrendFromCache();
    return;
  }
  void queryTrend();
});


filters.products.addEventListener("input", () => cache.products.length && rerenderFromCache("products"));
filters.ar.addEventListener("input", () => cache.ar.length && rerenderFromCache("ar"));
filters.ap.addEventListener("input", () => cache.ap.length && rerenderFromCache("ap"));
filters.journals.addEventListener("input", () => cache.journals.length && rerenderFromCache("journals"));
filters.audit.addEventListener("input", () => cache.audit.length && rerenderFromCache("audit"));

document.getElementById("filterRemindReceipts")?.addEventListener("input", () => {
  renderRemindersTable("remindReceiptsTable", reminderCache.receipts, "催收货列表");
});
document.getElementById("filterRemindDeliveries")?.addEventListener("input", () => {
  renderRemindersTable("remindDeliveriesTable", reminderCache.deliveries, "催发货列表");
});

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
    { label: "阶段", getter: (r) => stageLabelFromKey(arStageKeyFromRow(r), "sales") },
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
    { label: "阶段", getter: (r) => stageLabelFromKey(apStageKeyFromRow(r), "purchase") },
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

bind("btnDataChecks", runDataChecks);
bind("btnRemindReceipts", async () => {
  serverPager.remindReceipts.page = 1;
  await loadRemindReceipts();
});
bind("btnRemindDeliveries", async () => {
  serverPager.remindDeliveries.page = 1;
  await loadRemindDeliveries();
});
bind("btnRemindReceiptsPrev", async () => {
  serverPager.remindReceipts.page = Math.max(1, serverPager.remindReceipts.page - 1);
  await loadRemindReceipts();
});
bind("btnRemindReceiptsNext", async () => {
  serverPager.remindReceipts.page += 1;
  await loadRemindReceipts();
});
bind("btnRemindDeliveriesPrev", async () => {
  serverPager.remindDeliveries.page = Math.max(1, serverPager.remindDeliveries.page - 1);
  await loadRemindDeliveries();
});
bind("btnRemindDeliveriesNext", async () => {
  serverPager.remindDeliveries.page += 1;
  await loadRemindDeliveries();
});
bind("btnRemindReceiptsJump", async () => {
  const v = Number(document.getElementById("remindReceiptsPageJump")?.value || 0);
  if (v > 0) serverPager.remindReceipts.page = v;
  await loadRemindReceipts();
});
bind("btnRemindDeliveriesJump", async () => {
  const v = Number(document.getElementById("remindDeliveriesPageJump")?.value || 0);
  if (v > 0) serverPager.remindDeliveries.page = v;
  await loadRemindDeliveries();
});
document.getElementById("remindReceiptsPageSize")?.addEventListener("change", async (e) => {
  serverPager.remindReceipts.pageSize = Number(e.target.value || 10);
  serverPager.remindReceipts.page = 1;
  savePagerPrefs();
  await loadRemindReceipts();
});
document.getElementById("remindDeliveriesPageSize")?.addEventListener("change", async (e) => {
  serverPager.remindDeliveries.pageSize = Number(e.target.value || 10);
  serverPager.remindDeliveries.page = 1;
  savePagerPrefs();
  await loadRemindDeliveries();
});
bind("btnSaveReminderPref", () => {
  const prefs = {
    warnDays: Number(document.getElementById("remindWarnDays")?.value || 2),
    dangerDays: Number(document.getElementById("remindDangerDays")?.value || 7)
  };
  if (prefs.dangerDays < prefs.warnDays) {
    showActionWarn("高危天数不能小于预警天数。");
    return;
  }
  saveReminderPrefs(prefs);
  if (reminderCache.receipts.length) renderRemindersTable("remindReceiptsTable", reminderCache.receipts || [], "催收货列表");
  if (reminderCache.deliveries.length) renderRemindersTable("remindDeliveriesTable", reminderCache.deliveries || [], "催发货列表");
  showActionOk(`提醒规则已保存：黄灯 ${prefs.warnDays} 天，红灯 ${prefs.dangerDays} 天。`);
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
document.getElementById("approvalStageFilter")?.addEventListener("change", () => {
  renderApprovalTableFromCache();
});
document.getElementById("approvalSort")?.addEventListener("change", () => {
  renderApprovalTableFromCache();
});
document.getElementById("approvalSearch")?.addEventListener("input", () => {
  renderApprovalTableFromCache();
});
document.getElementById("arStageFilter")?.addEventListener("change", () => {
  renderArFromCache();
});
document.getElementById("arSort")?.addEventListener("change", () => {
  renderArFromCache();
});
document.getElementById("apStageFilter")?.addEventListener("change", () => {
  renderApFromCache();
});
document.getElementById("apSort")?.addEventListener("change", () => {
  renderApFromCache();
});
document.getElementById("sortRemindReceipts")?.addEventListener("change", () => {
  renderRemindersTable("remindReceiptsTable", reminderCache.receipts || [], "催收货列表");
});
document.getElementById("sortRemindDeliveries")?.addEventListener("change", () => {
  renderRemindersTable("remindDeliveriesTable", reminderCache.deliveries || [], "催发货列表");
});
document.getElementById("remindWarnDays")?.addEventListener("input", () => {
  const preset = document.getElementById("remindRulePreset");
  if (preset) preset.value = "custom";
  if (reminderCache.receipts.length) renderRemindersTable("remindReceiptsTable", reminderCache.receipts || [], "催收货列表");
  if (reminderCache.deliveries.length) renderRemindersTable("remindDeliveriesTable", reminderCache.deliveries || [], "催发货列表");
});
document.getElementById("remindDangerDays")?.addEventListener("input", () => {
  const preset = document.getElementById("remindRulePreset");
  if (preset) preset.value = "custom";
  if (reminderCache.receipts.length) renderRemindersTable("remindReceiptsTable", reminderCache.receipts || [], "催收货列表");
  if (reminderCache.deliveries.length) renderRemindersTable("remindDeliveriesTable", reminderCache.deliveries || [], "催发货列表");
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
  renderSettlementPicksFromCache();
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
  renderSettlementPicksFromCache();
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
  if (v > 0) {
    const row = (settlementPickCache.ar || []).find((x) => Number(x.id || 0) === v);
    const open = row ? Math.max(0, Number(row.totalAmount || 0) - Number(row.receivedAmount || 0)) : 0;
    const amountInput = document.getElementById("rcAmount");
    if (amountInput && (!String(amountInput.value || "").trim() || Number(amountInput.value || 0) <= 0)) {
      amountInput.value = open > 0 ? open.toFixed(2) : "";
    }
  }
  if (v > 0) {
    const selected = e.target.selectedOptions?.[0];
    const cid = Number(selected?.dataset?.customerId || 0);
    if (cid > 0) {
      const customerPick = document.getElementById("rcCustomerPick");
      if (customerPick) {
        customerPick.value = String(cid);
        customerPick.dataset.prevValue = String(cid);
      }
      state.customerId = cid;
      updateSelectVisualState("rcCustomerPick");
    }
  }
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
  if (v > 0) {
    const row = (settlementPickCache.ap || []).find((x) => Number(x.id || 0) === v);
    const open = row ? Math.max(0, Number(row.totalAmount || 0) - Number(row.paidAmount || 0)) : 0;
    const amountInput = document.getElementById("pyAmount");
    if (amountInput && (!String(amountInput.value || "").trim() || Number(amountInput.value || 0) <= 0)) {
      amountInput.value = open > 0 ? open.toFixed(2) : "";
    }
  }
  if (v > 0) {
    const selected = e.target.selectedOptions?.[0];
    const sid = Number(selected?.dataset?.supplierId || 0);
    if (sid > 0) {
      const supplierPick = document.getElementById("pySupplierPick");
      if (supplierPick) {
        supplierPick.value = String(sid);
        supplierPick.dataset.prevValue = String(sid);
      }
      state.supplierId = sid;
      updateSelectVisualState("pySupplierPick");
    }
  }
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
document.getElementById("execPurchaseWarehousePick")?.addEventListener("change", async (e) => {
  const warehouseId = Number(e.target.value || 0);
  try {
    const rows = warehouseId > 0 ? await api(`/api/locations?warehouseId=${warehouseId}`) : await api("/api/locations");
    const locationPick = document.getElementById("execPurchaseLocationPick");
    if (locationPick) {
      const opts = ['<option value="">库位（可选）</option>'];
      (rows || []).forEach((l) => opts.push(`<option value="${l.id}">${l.code} ${l.name}</option>`));
      locationPick.innerHTML = opts.join("");
    }
  } catch (_e) {
    // ignore by permission
  }
});
document.getElementById("execSalesWarehousePick")?.addEventListener("change", async (e) => {
  const warehouseId = Number(e.target.value || 0);
  try {
    const rows = warehouseId > 0 ? await api(`/api/locations?warehouseId=${warehouseId}`) : await api("/api/locations");
    const locationPick = document.getElementById("execSalesLocationPick");
    if (locationPick) {
      const opts = ['<option value="">库位（可选）</option>'];
      (rows || []).forEach((l) => opts.push(`<option value="${l.id}">${l.code} ${l.name}</option>`));
      locationPick.innerHTML = opts.join("");
    }
  } catch (_e) {
    // ignore by permission
  }
});
document.getElementById("execPurchaseOrderPick")?.addEventListener("change", async (e) => {
  const orderId = Number(e.target.value || 0);
  const batchInput = document.getElementById("execPurchaseBatchNo");
  const qtyInput = document.getElementById("execPurchaseQty");
  if (batchInput) batchInput.value = "";
  if (qtyInput) qtyInput.value = "";
  if (!orderId) return;
  try {
    await applyExecutionOrderSelection("purchase", orderId);
    await validateExecutionQty("purchase");
  } catch (err) {
    const msg = err?.message || String(err);
    showActionWarn(msg);
    showActionToast("error", msg);
  }
});
document.getElementById("execSalesOrderPick")?.addEventListener("change", async (e) => {
  const orderId = Number(e.target.value || 0);
  const batchInput = document.getElementById("execSalesBatchNo");
  const qtyInput = document.getElementById("execSalesQty");
  if (batchInput) batchInput.value = "";
  if (qtyInput) qtyInput.value = "";
  if (!orderId) return;
  try {
    await applyExecutionOrderSelection("sales", orderId);
    await validateExecutionQty("sales");
  } catch (err) {
    const msg = err?.message || String(err);
    showActionWarn(msg);
    showActionToast("error", msg);
  }
});

document.getElementById("execPurchaseProductPick")?.addEventListener("change", () => {
  const orderId = Number(inputNum("execPurchaseOrderId") || 0);
  const productId = Number(selectNum("execPurchaseProductPick") || 0);
  const batchInput = document.getElementById("execPurchaseBatchNo");
  const qtyInput = document.getElementById("execPurchaseQty");
  if (qtyInput) qtyInput.value = "";
  if (batchInput && !String(batchInput.value || "").trim()) {
    batchInput.value = getNextBatchNo({ orderType: "purchase", orderId, productId });
  }
  void validateExecutionQty("purchase");
});

document.getElementById("execSalesProductPick")?.addEventListener("change", () => {
  const orderId = Number(inputNum("execSalesOrderId") || 0);
  const productId = Number(selectNum("execSalesProductPick") || 0);
  const batchInput = document.getElementById("execSalesBatchNo");
  const qtyInput = document.getElementById("execSalesQty");
  if (qtyInput) qtyInput.value = "";
  if (batchInput && !String(batchInput.value || "").trim()) {
    batchInput.value = getNextBatchNo({ orderType: "sales", orderId, productId });
  }
  void validateExecutionQty("sales");
});
document.getElementById("execPurchaseQty")?.addEventListener("input", () => {
  void validateExecutionQty("purchase");
});
document.getElementById("execSalesQty")?.addEventListener("input", () => {
  void validateExecutionQty("sales");
});

// 仓库/库位管理：聚焦输入框时提示已有项，避免重复创建
["newWarehouseCode", "newWarehouseName"].forEach((id) => {
  document.getElementById(id)?.addEventListener("focus", () => {
    const el = document.getElementById(id);
    showExistingWarehousesDropdown(el).catch(() => {});
  });
  document.getElementById(id)?.addEventListener("click", () => {
    const el = document.getElementById(id);
    showExistingWarehousesDropdown(el).catch(() => {});
  });
});
["newLocationCode", "newLocationName", "newLocationWarehousePick"].forEach((id) => {
  document.getElementById(id)?.addEventListener("focus", () => {
    const el = document.getElementById(id);
    showExistingLocationsDropdown(el).catch(() => {});
  });
  document.getElementById(id)?.addEventListener("click", () => {
    const el = document.getElementById(id);
    showExistingLocationsDropdown(el).catch(() => {});
  });
});
document.getElementById("newLocationWarehousePick")?.addEventListener("change", () => {
  const el = document.getElementById("newLocationWarehousePick");
  showExistingLocationsDropdown(el).catch(() => {});
});

// 点击空白处收起下拉提示
document.addEventListener("click", (e) => {
  if (!whSuggestBox && !locSuggestBox) return;
  const target = e.target;
  const ids = new Set(["newWarehouseCode", "newWarehouseName", "newLocationWarehousePick", "newLocationCode", "newLocationName"]);
  const isInput = target && target.id && ids.has(target.id);
  const inWh = whSuggestBox ? whSuggestBox.contains(target) : false;
  const inLoc = locSuggestBox ? locSuggestBox.contains(target) : false;
  if (!isInput && !inWh && !inLoc) hideWhLocSuggest();
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

document.addEventListener("keydown", (e) => {
  const activeTag = String(document.activeElement?.tagName || "").toLowerCase();
  if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;
  if (!e.altKey) return;
  if (e.key === "a" || e.key === "A") {
    e.preventDefault();
    void doApprovalAction("approve").catch(() => {});
  } else if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    const id = Number(document.getElementById("approvalOrderId")?.value || 0);
    if (id > 0) {
      setRejectInputVisible(true);
      const commentInput = document.getElementById("approvalComment");
      if (commentInput) commentInput.focus();
    }
  } else if (e.key === "s" || e.key === "S") {
    e.preventDefault();
    void doApprovalAction("submit").catch(() => {});
  }
});

const reminderPrefs = loadReminderPrefs();
const remindWarnInput = document.getElementById("remindWarnDays");
const remindDangerInput = document.getElementById("remindDangerDays");
if (remindWarnInput) remindWarnInput.value = String(reminderPrefs.warnDays);
if (remindDangerInput) remindDangerInput.value = String(reminderPrefs.dangerDays);
const remindPresetPick = document.getElementById("remindRulePreset");
if (remindPresetPick) {
  const key = `${Number(reminderPrefs.warnDays || 0)},${Number(reminderPrefs.dangerDays || 0)}`;
  const known = new Set(["2,7", "1,3", "3,7", "5,10"]);
  remindPresetPick.value = known.has(key) ? key : "custom";
  remindPresetPick.addEventListener("change", () => {
    const v = String(remindPresetPick.value || "");
    if (v === "custom") return;
    const parts = v.split(",").map((x) => Number(x));
    const warn = Number(parts[0] || 0);
    const danger = Number(parts[1] || 0);
    if (remindWarnInput) remindWarnInput.value = warn > 0 ? String(warn) : "";
    if (remindDangerInput) remindDangerInput.value = danger > 0 ? String(danger) : "";
    if (reminderCache.receipts.length) renderRemindersTable("remindReceiptsTable", reminderCache.receipts || [], "催收货列表");
    if (reminderCache.deliveries.length) renderRemindersTable("remindDeliveriesTable", reminderCache.deliveries || [], "催发货列表");
  });
}
const pagerPrefs = loadPagerPrefs();
approvalPager.pageSize = pagerPrefs.approvalPageSize;
serverPager.ar.pageSize = pagerPrefs.arPageSize;
serverPager.ap.pageSize = pagerPrefs.apPageSize;
serverPager.remindReceipts.pageSize = pagerPrefs.remindReceiptsPageSize;
serverPager.remindDeliveries.pageSize = pagerPrefs.remindDeliveriesPageSize;
initServerPagerUiDefaults();

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
