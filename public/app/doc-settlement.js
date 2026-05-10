/**
 * 单据创建（采购/销售）、收付款表单、应收应付下拉与预览提示。
 * 加载顺序：order-execution → 本文件 → approval-workspace → app.js。
 * 运行期依赖 app.js 的 inputText / inputNum / selectNum / sortByIdDesc 等。
 */

function makeNo(prefix) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${y}${m}${day}${rnd}`;
}

function assertDocNoLength(no, typeText) {
  if (String(no || "").length !== 14) {
    throw new Error(`${typeText}长度需为14位（示例：PO202604281234）。`);
  }
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
  assertDocNoLength(orderNo, "采购单号");
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
  assertDocNoLength(orderNo, "销售单号");
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
  assertDocNoLength(receiptNo, "收款单号");
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
  assertDocNoLength(paymentNo, "付款单号");
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
