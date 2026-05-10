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
async function jumpFromApprovalDetail(kind, orderType, orderId, orderNo = "") {
  try {
    if (kind === "exec") {
      setActivePanel(orderType === "sales" ? "panelSalesExec" : "panelPurchaseExec");
      // execution section is split by order type; prefill ids and refresh picks
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
      setActivePanel("panelDocCreate");
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

function ellipsisText(s, maxLen) {
  const raw = String(s || "");
  const max = Math.max(4, Number(maxLen || 0) || 0);
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(1, max - 1))}…`;
}

function supplierDisplayShortById(id) {
  const full = supplierDisplayById(id);
  // 表格里只展示短文本，避免把审批列表撑宽；完整信息放在 title 里
  return ellipsisText(full, 18);
}

function customerDisplayById(id) {
  const n = Number(id || 0);
  if (!(n > 0)) return "-";
  const hit = (masterPickCache.customers || []).find((c) => Number(c.id || 0) === n);
  if (!hit) return `#${n}`;
  const name = String(hit.name || "").trim();
  const code = String(hit.code || "").trim();
  if (name && code) return `${name}（${code}） (#${n})`;
  return `${name || code || `#${n}`} (#${n})`;
}

function customerDisplayShortById(id) {
  const full = customerDisplayById(id);
  return ellipsisText(full, 18);
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

function isApprovalColumnVisible(label) {
  const amountOn = document.getElementById("chkApprovalColAmount")?.checked !== false;
  const timeOn = document.getElementById("chkApprovalColTime")?.checked !== false;
  const rejectOn = document.getElementById("chkApprovalColReject")?.checked !== false;
  if (label === "金额") return amountOn;
  if (label === "创建时间" || label === "提交时间") return timeOn;
  if (label === "最近驳回意见") return rejectOn;
  return true;
}

function filterApprovalColumns(columns) {
  return (columns || []).filter((c) => isApprovalColumnVisible(c.label));
}

function renderApprovalTableFromCache() {
  const rows = getFilteredApprovalRows(approvalRowsCache || []);
  if (approvalRowsKind === "pending") {
    renderTable(
      tableTargets.approval,
      rows,
      filterApprovalColumns([
        { label: "批选", getter: (r) => approvalCheckCell(r) },
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
      ]),
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
      filterApprovalColumns([
        { label: "批选", getter: (r) => approvalCheckCell(r) },
        { label: "ID", getter: (r) => r.id },
        { label: "单号", getter: (r) => `<span title="${escapeHtml(r.orderNo || "-")}">${escapeHtml(r.orderNo || "-")}</span>` },
        {
          label: "客户",
          getter: (r) => {
            const full = customerDisplayById(r.customerId);
            const short = customerDisplayShortById(r.customerId);
            return `<span title="${escapeHtml(full)}">${escapeHtml(short)}</span>`;
          }
        },
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
      ]),
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
    filterApprovalColumns([
      { label: "批选", getter: (r) => approvalCheckCell(r) },
      { label: "ID", getter: (r) => r.id },
      { label: "单号", getter: (r) => `<span title="${escapeHtml(r.orderNo || "-")}">${escapeHtml(r.orderNo || "-")}</span>` },
      {
        label: "供应商",
        getter: (r) => {
          const full = supplierDisplayById(r.supplierId);
          const short = supplierDisplayShortById(r.supplierId);
          return `<span title="${escapeHtml(full)}">${escapeHtml(short)}</span>`;
        }
      },
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
    ]),
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
