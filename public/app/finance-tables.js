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
