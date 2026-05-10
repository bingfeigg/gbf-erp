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
const STORAGE_APPROVAL_COL_PREF_KEY = "gbf_erp_approval_col_pref_v1";

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
const appVersionInline = document.getElementById("appVersionInline");
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

async function loadAppVersionInline() {
  if (!appVersionInline) return;
  try {
    const resp = await fetch("/api/version", { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const info = await resp.json();
    const versionRaw = String(info?.version || "").trim();
    const commitRaw = String(info?.commit || "").trim();
    const builtAtRaw = String(info?.builtAt || "").trim();
    const label = `${versionRaw ? `v${versionRaw}` : "v-"}${commitRaw ? ` (${commitRaw})` : ""}`;
    appVersionInline.textContent = label;
    appVersionInline.title = builtAtRaw ? `构建时间：${builtAtRaw}` : "版本信息";
    appVersionInline.classList.remove("hidden");
  } catch (_e) {
    appVersionInline.classList.add("hidden");
  }
}

void loadAppVersionInline();

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

function loadApprovalColumnPrefs() {
  const defaults = { amount: true, time: true, reject: true };
  try {
    const raw = localStorage.getItem(STORAGE_APPROVAL_COL_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      amount: parsed.amount !== false,
      time: parsed.time !== false,
      reject: parsed.reject !== false
    };
  } catch (_e) {
    return defaults;
  }
}

function saveApprovalColumnPrefs(prefs) {
  try {
    localStorage.setItem(
      STORAGE_APPROVAL_COL_PREF_KEY,
      JSON.stringify({
        amount: prefs.amount !== false,
        time: prefs.time !== false,
        reject: prefs.reject !== false
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
  panelProductCreate: document.getElementById("panelProductCreate"),
  panelDocCreate: document.getElementById("panelDocCreate"),
  panelPurchaseExec: document.getElementById("panelPurchaseExec"),
  panelSalesExec: document.getElementById("panelSalesExec"),
  panelProducts: document.getElementById("panelProducts"),
  panelApproval: document.getElementById("panelApproval"),
  panelAr: document.getElementById("panelAr"),
  panelAp: document.getElementById("panelAp"),
  panelJournals: document.getElementById("panelJournals"),
  panelTrend: document.getElementById("panelTrend"),
  panelAudit: document.getElementById("panelAudit"),
  panelAlerts: document.getElementById("panelAlerts")
};
