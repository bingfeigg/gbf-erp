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
    renderExecutionTodoHint();
    renderExecutionQuickPicks("purchase");
    renderExecutionQuickPicks("sales");
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

function renderExecutionTodoHint() {
  const purchaseHint = document.getElementById("execPurchaseTodoHint");
  const salesHint = document.getElementById("execSalesTodoHint");

  const summarize = (rows = [], label) => {
    const orderCount = rows.length;
    const totalRemaining = rows.reduce((sum, row) => sum + Number(row.remainingQty || 0), 0);
    if (!orderCount) return `待执行：当前无${label}订单。`;
    return `待执行：${orderCount} 单待处理，合计剩余数量 ${fmtMoney(totalRemaining)}。`;
  };

  if (purchaseHint) purchaseHint.textContent = summarize(executionOrderCache.purchase || [], "采购");
  if (salesHint) salesHint.textContent = summarize(executionOrderCache.sales || [], "销售");
}

function renderExecutionQuickPicks(type) {
  const boxId = type === "sales" ? "execSalesQuickPicks" : "execPurchaseQuickPicks";
  const box = document.getElementById(boxId);
  if (!box) return;
  const rows = [...(type === "sales" ? executionOrderCache.sales : executionOrderCache.purchase)];
  const top = rows
    .sort((a, b) => Number(b.remainingQty || 0) - Number(a.remainingQty || 0))
    .slice(0, 3);
  if (!top.length) {
    box.innerHTML = `<span class="muted">暂无待执行快捷单。</span>`;
    return;
  }
  box.innerHTML = top
    .map(
      (r) =>
        `<button type="button" class="secondary exec-quick-btn" data-order-type="${escapeHtml(type)}" data-order-id="${Number(
          r.id || 0
        )}" title="${escapeHtml(`${r.orderNo || `#${r.id}`} / 剩余 ${fmtMoney(Number(r.remainingQty || 0))}`)}">${escapeHtml(
          `${r.orderNo || `#${r.id}`} · 剩余${fmtMoney(Number(r.remainingQty || 0))}`
        )}</button>`
    )
    .join("");
}

async function onClickExecutionQuickPick(evt) {
  const btn = evt.target?.closest?.(".exec-quick-btn");
  if (!btn) return;
  evt.preventDefault();
  const type = String(btn.getAttribute("data-order-type") || "");
  const orderId = Number(btn.getAttribute("data-order-id") || 0);
  if (!(orderId > 0) || (type !== "purchase" && type !== "sales")) return;
  const pickId = type === "sales" ? "execSalesOrderPick" : "execPurchaseOrderPick";
  const inputId = type === "sales" ? "execSalesOrderId" : "execPurchaseOrderId";
  const qtyId = type === "sales" ? "execSalesQty" : "execPurchaseQty";
  const pick = document.getElementById(pickId);
  const input = document.getElementById(inputId);
  if (pick) pick.value = String(orderId);
  if (input) input.value = String(orderId);
  await applyExecutionOrderSelection(type, orderId);
  const qty = document.getElementById(qtyId);
  if (qty) qty.focus();
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

function getProductStockQty(productId) {
  const id = Number(productId || 0);
  if (!(id > 0)) return null;
  const row = (cache.products || []).find((x) => Number(x.id || 0) === id);
  if (!row) return null;
  return Number(row.stockQty || 0);
}

function buildExecutionCapability(orderType, item) {
  const qty = Number(item?.qty || 0);
  const delivered = Number(item?.deliveredQty || 0);
  const received = Number(item?.receivedQty || 0);
  const remaining =
    Number(
      item?.remainingQty ?? (orderType === "sales" ? Number(item?.qty || 0) - delivered : Number(item?.qty || 0) - received)
    ) || 0;
  if (orderType === "sales") {
    return {
      canPrimary: Math.max(0, remaining), // 发货
      canReverse: Math.max(0, delivered), // 退货
      primaryName: "发货",
      reverseName: "退货"
    };
  }
  return {
    canPrimary: Math.max(0, remaining), // 收货
    canReverse: Math.max(0, received), // 退货
    primaryName: "收货",
    reverseName: "退货"
  };
}

function setExecutionButtonsEnabled(orderType, primaryEnabled, reverseEnabled) {
  const primaryId = orderType === "sales" ? "btnCreateDeliveryFlow" : "btnCreateReceiptFlow";
  const reverseId = orderType === "sales" ? "btnCreateSalesReturnFlow" : "btnCreatePurchaseReturnFlow";
  const btnPrimary = document.getElementById(primaryId);
  const btnReverse = document.getElementById(reverseId);
  if (btnPrimary) btnPrimary.disabled = !primaryEnabled;
  if (btnReverse) btnReverse.disabled = !reverseEnabled;
}

async function validateExecutionQty(orderType) {
  try {
    const orderId = Number(inputNum(orderType === "sales" ? "execSalesOrderId" : "execPurchaseOrderId") || 0);
    const productId = Number(selectNum(orderType === "sales" ? "execSalesProductPick" : "execPurchaseProductPick") || 0);
    const qty = Number(inputNum(orderType === "sales" ? "execSalesQty" : "execPurchaseQty") || 0);
    const feedbackId = orderType === "sales" ? "execSalesFeedback" : "execPurchaseFeedback";
    if (!orderId || !productId || !(qty > 0)) {
      setExecutionButtonsEnabled(orderType, true, true);
      return true;
    }
    const items = await loadExecutionOrderItems(orderType, orderId);
    const item = (items || []).find((x) => Number(x.productId || 0) === productId);
    if (!item) {
      setExecutionButtonsEnabled(orderType, false, false);
      showInlineFeedback(feedbackId, "error", "所选商品不在该订单明细中，请重新选择。");
      return false;
    }

    const capability = buildExecutionCapability(orderType, item);
    const stockQty = getProductStockQty(productId);
    const primaryOkByQty = qty <= capability.canPrimary + 0.0001;
    const reverseOkByQty = qty <= capability.canReverse + 0.0001;
    const primaryStockOk = orderType === "sales" ? stockQty == null || qty <= stockQty + 0.0001 : true;
    const reverseStockOk = orderType === "purchase" ? stockQty == null || qty <= stockQty + 0.0001 : true;
    const primaryEnabled = primaryOkByQty && primaryStockOk;
    const reverseEnabled = reverseOkByQty && reverseStockOk;
    setExecutionButtonsEnabled(orderType, primaryEnabled, reverseEnabled);

    if (!primaryEnabled && !reverseEnabled) {
      const reasons = [];
      if (!primaryOkByQty) reasons.push(`${capability.primaryName}上限 ${capability.canPrimary.toFixed(2)}`);
      if (!reverseOkByQty) reasons.push(`${capability.reverseName}上限 ${capability.canReverse.toFixed(2)}`);
      if ((!primaryStockOk || !reverseStockOk) && stockQty != null) reasons.push(`可用库存 ${stockQty.toFixed(2)}`);
      showInlineFeedback(feedbackId, "error", `当前数量不可执行：${reasons.join("，")}`);
      return false;
    } else {
      clearInlineFeedback(feedbackId);
      if (!primaryEnabled || !reverseEnabled) {
        const tip = !primaryEnabled
          ? `${capability.primaryName}受限，可执行上限 ${capability.canPrimary.toFixed(2)}`
          : `${capability.reverseName}受限，可执行上限 ${capability.canReverse.toFixed(2)}`;
        showInlineFeedback(feedbackId, "info", tip);
      }
    }
    return true;
  } catch (_e) {
    return true;
  }
}

async function prevalidateExecutionAction(orderType, action, payload) {
  const orderId = Number(payload?.orderId || 0);
  const item = payload?.items?.[0] || {};
  const productId = Number(item.productId || 0);
  const qty = Number(item.qty || 0);
  if (!(orderId > 0) || !(productId > 0) || !(qty > 0)) throw new Error("执行参数无效：请填写订单、商品和数量。");

  const cacheRows = orderType === "sales" ? executionOrderCache.sales : executionOrderCache.purchase;
  const order = (cacheRows || []).find((x) => Number(x.id || 0) === orderId);
  if (!order) throw new Error("订单不在当前可执行列表，请先刷新并重新选择。");
  if (String(order.status || "").toLowerCase() !== "approved") throw new Error("订单未审批通过，暂不能执行。");

  const items = await loadExecutionOrderItems(orderType, orderId);
  const row = (items || []).find((x) => Number(x.productId || 0) === productId);
  if (!row) throw new Error("所选商品不在订单明细中。");
  const capability = buildExecutionCapability(orderType, row);
  const stockQty = getProductStockQty(productId);

  if (action === "primary") {
    if (qty > capability.canPrimary + 0.0001) throw new Error(`数量超出可执行上限：${qty} > ${capability.canPrimary.toFixed(2)}`);
    if (orderType === "sales" && stockQty != null && qty > stockQty + 0.0001) {
      throw new Error(`库存不足：可用 ${stockQty.toFixed(2)}，请求 ${qty.toFixed(2)}`);
    }
  } else {
    if (qty > capability.canReverse + 0.0001) throw new Error(`数量超出可退上限：${qty} > ${capability.canReverse.toFixed(2)}`);
    if (orderType === "purchase" && stockQty != null && qty > stockQty + 0.0001) {
      throw new Error(`库存不足（采购退货）：可用 ${stockQty.toFixed(2)}，请求 ${qty.toFixed(2)}`);
    }
  }
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
  await prevalidateExecutionAction("purchase", "primary", payload);
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
  await prevalidateExecutionAction("sales", "primary", payload);
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
  await prevalidateExecutionAction("purchase", "reverse", payload);
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
  await prevalidateExecutionAction("sales", "reverse", payload);
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
