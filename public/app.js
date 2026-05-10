const panelTitles = {
  panelProductCreate: "商品创建",
  panelDocCreate: "单据创建",
  panelPurchaseExec: "采购执行",
  panelSalesExec: "销售执行",
  panelApproval: "审批工作台",
  panelAr: "应收管理",
  panelAp: "应付管理",
  panelProducts: "商品库存",
  panelJournals: "凭证中心",
  panelTrend: "趋势图表",
  panelAudit: "审计日志",
  panelAlerts: "告警事件"
};
const ROLE_ALIAS = {
  root: "admin"
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
  }
};
const roleTodoConfig = {
  sales: {
    base: ["销售单草稿：提交审批后再发货、开票与收款。", "收款后打开「应收」「凭证」核对余额与入账。"],
    withCounters: ({ arOpen }) => (arOpen > 0 ? [`应收：当前 ${arOpen} 笔未结清，建议跟进收款。`] : [])
  },
  purchase: {
    base: ["采购单草稿：审批通过后再收货；付款前确认已收齐货。", "付款后在「应付」「凭证」核对付款与账面。"],
    withCounters: ({ apOpen }) => (apOpen > 0 ? [`应付：当前 ${apOpen} 笔未结清，建议安排付款。`] : [])
  },
  finance: {
    base: ["先处理「我的待审批」，再办收款、付款。", "核对应收/应付未清额与凭证，大额与异常重点看。"],
    withCounters: () => []
  },
  warehouse: {
    base: ["核对商品主数据与库存数量，处理差异。", "收货/发货执行后刷新「商品库存」与趋势。"],
    withCounters: () => []
  },
  admin: {
    base: ["「我的待审批」优先清空，避免单据积压。", "抽查应收、应付与凭证一致性，关注异常与大额。"],
    withCounters: () => []
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
  const codeRaw = document.getElementById(codeInputId)?.value.trim() || "";
  const nameRaw = document.getElementById(nameInputId)?.value.trim() || "";
  if (!nameRaw || nameRaw.length < 2) {
    throw new Error(`${typeText}名称至少 2 个字符。`);
  }
  const unifiedPartyCode = `BP${Date.now().toString().slice(-8)}`; // 客户/供应商统一编号规则与长度
  const payload = {
    code: (codeRaw && codeRaw.length >= 2 ? codeRaw : unifiedPartyCode).toUpperCase(),
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

/** 审批区：标明当前动作对应的采购/销售 API 路径 */

function normalizeRoleKey(role) {
  const key = String(role || "").trim();
  return ROLE_ALIAS[key] || key || "admin";
}

function renderRoleTodoFocus() {
  if (!roleTodoList || !roleTodoHint) return;
  if (!state.token) {
    roleTodoHint.textContent = "登录后将结合您的角色与看板数据展示优先提示。";
    roleTodoList.innerHTML = "";
    return;
  }
  const pendingSubmitted = (approvalRowsCache || []).filter((r) => String(r.status || "").toLowerCase() === "submitted").length;
  const arOpen = (cache.ar || []).filter((r) => Number(r.openAmount || (Number(r.totalAmount || 0) - Number(r.receivedAmount || 0))) > 0).length;
  const apOpen = (cache.ap || []).filter((r) => Number(r.openAmount || (Number(r.totalAmount || 0) - Number(r.paidAmount || 0))) > 0).length;
  const roleKey = normalizeRoleKey(state.role);
  const cfg = roleTodoConfig[roleKey] || roleTodoConfig.admin;
  const todos = [...(cfg.base || []), ...((cfg.withCounters && cfg.withCounters({ arOpen, apOpen })) || [])];
  if (pendingSubmitted > 0) {
    todos.unshift(`审批工作台：${pendingSubmitted} 条「已提交」待处理。`);
  }
  roleTodoHint.textContent = `当前身份「${zhRole(roleKey)}」— 以下为优先提示（随列表数据更新）`;
  roleTodoList.innerHTML = todos.slice(0, 5).map((t) => `<li>${t}</li>`).join("");
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
    ["btnBizWarehouseLocation", "stock:write"],
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
    ["btnBizWarehouseLocation", "stock:write"],
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
    ["navProductCreate", ["stock:write", "product:write"]],
    ["navDocCreate", ["purchase:write", "sales:write"]],
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
  const hasVisibleBizAction = ["btnBizAddProduct", "btnBizWarehouseLocation", "btnBizPurchase", "btnBizSales", "btnBizPending", "btnBizSubmit", "btnBizApprove", "btnBizReceipt", "btnBizPayment", "btnBizRefresh"].some((id) => {
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
    bizParamsWorkbench.style.display = canCreateOrder && panelId === "panelDocCreate" ? "" : "none";
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

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  if (loginFormStatus) {
    loginFormStatus.textContent = "登录中…";
    loginFormStatus.className = "muted";
  }
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
      { label: "成本价", getter: (r) => fmtMoney(r.costPrice) },
      { label: "销售价", getter: (r) => fmtMoney(r.salePrice) }
    ],
    {
      clickable: true,
      onRowClick: (row) => {
        if (productDetail) productDetail.textContent = formatProductDetail(row);
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
    const formPanels = new Set(["panelProductCreate", "panelDocCreate", "panelPurchaseExec", "panelSalesExec", "panelTrend"]);
    const mode = formPanels.has(panelId) ? "form" : "table";
    appShell.classList.toggle("mode-form", mode === "form");
    appShell.classList.toggle("mode-table", mode === "table");
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
    const shouldShow = canUseParams && panelId === "panelDocCreate";
    bizParamsWorkbench.style.display = shouldShow ? "" : "none";
  }
  syncBizParamsHint(panelId);
  if ((panelId === "panelPurchaseExec" || panelId === "panelSalesExec") && state.token) {
    void refreshExecutionPicks().catch(() => {});
  }
}

function getFirstVisibleNavPanel() {
  for (const btn of moduleNavButtons) {
    if (btn.style.display !== "none") return btn.dataset.panel;
  }
  return "panelProducts";
}

function getRolePreset() {
  const roleKey = normalizeRoleKey(state.role);
  return roleWorkspacePreset[roleKey] || roleWorkspacePreset.admin;
}

function applyRolePreferredBizButtons() {
  const preset = getRolePreset();
  const preferred = new Set(preset.preferredBizButtons || []);
  const createButtonIds = ["btnBizAddProduct", "btnBizWarehouseLocation", "btnBizPurchase", "btnBizSales", "btnBizReceipt", "btnBizPayment"];
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
  const text = panelId === "panelDocCreate" ? "填写参数后点击确定创建单据" : "";
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
  setActivePanel("panelDocCreate");
  openParamWorkbenchFor("paramCardPurchase", "poOrderNo");
});
bind("btnBizAddProduct", async () => {
  setActivePanel("panelProductCreate");
  const sku = document.getElementById("newProductSku");
  if (sku) sku.focus();
});
bind("btnBizWarehouseLocation", async () => {
  setActivePanel("panelProductCreate");
  const section = document.getElementById("sectionWarehouseLocation");
  if (section && section.scrollIntoView) section.scrollIntoView({ behavior: "smooth", block: "start" });
  const whCode = document.getElementById("newWarehouseCode");
  if (whCode) whCode.focus();
});
bind("btnBizSales", async () => {
  setActivePanel("panelDocCreate");
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
  setActivePanel("panelDocCreate");
  openParamWorkbenchFor("paramCardReceipt", "rcNo");
});
bind("btnBizPayment", async () => {
  setActivePanel("panelDocCreate");
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
    { label: "成本价", getter: (r) => fmtMoney(r.costPrice) },
    { label: "销售价", getter: (r) => fmtMoney(r.salePrice) }
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
      refId: r.refId,
      memo: r.memo,
      debit: (r.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0),
      credit: (r.lines || []).reduce((s, l) => s + Number(l.credit || 0), 0),
      createdAt: r.createdAt
    })),
    [
      { label: "凭证号", getter: (r) => r.entryNo },
      { label: "来源", getter: (r) => zhJournalRefType(r.refType) },
      { label: "摘要", getter: (r) => zhJournalMemo(r) },
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
    { label: "动作", getter: (r) => zhAuditAction(r.action) },
    { label: "实体", getter: (r) => zhAuditEntityLabel(r.entityType, r.entityId) },
    { label: "详情", getter: (r) => zhAuditDetail(r.detail) }
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
document.getElementById("chkApprovalColAmount")?.addEventListener("change", () => {
  const prefs = {
    amount: document.getElementById("chkApprovalColAmount")?.checked !== false,
    time: document.getElementById("chkApprovalColTime")?.checked !== false,
    reject: document.getElementById("chkApprovalColReject")?.checked !== false
  };
  saveApprovalColumnPrefs(prefs);
  renderApprovalTableFromCache();
});
document.getElementById("chkApprovalColTime")?.addEventListener("change", () => {
  const prefs = {
    amount: document.getElementById("chkApprovalColAmount")?.checked !== false,
    time: document.getElementById("chkApprovalColTime")?.checked !== false,
    reject: document.getElementById("chkApprovalColReject")?.checked !== false
  };
  saveApprovalColumnPrefs(prefs);
  renderApprovalTableFromCache();
});
document.getElementById("chkApprovalColReject")?.addEventListener("change", () => {
  const prefs = {
    amount: document.getElementById("chkApprovalColAmount")?.checked !== false,
    time: document.getElementById("chkApprovalColTime")?.checked !== false,
    reject: document.getElementById("chkApprovalColReject")?.checked !== false
  };
  saveApprovalColumnPrefs(prefs);
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
document.getElementById("execPurchaseQuickPicks")?.addEventListener("click", (e) => {
  void onClickExecutionQuickPick(e);
});
document.getElementById("execSalesQuickPicks")?.addEventListener("click", (e) => {
  void onClickExecutionQuickPick(e);
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
const approvalColPrefs = loadApprovalColumnPrefs();
const chkApprovalColAmount = document.getElementById("chkApprovalColAmount");
const chkApprovalColTime = document.getElementById("chkApprovalColTime");
const chkApprovalColReject = document.getElementById("chkApprovalColReject");
if (chkApprovalColAmount) chkApprovalColAmount.checked = approvalColPrefs.amount;
if (chkApprovalColTime) chkApprovalColTime.checked = approvalColPrefs.time;
if (chkApprovalColReject) chkApprovalColReject.checked = approvalColPrefs.reject;

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
