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
      <div>参考：${escapeHtml(zhJournalRefType(entry.refType))} #${escapeHtml(fmtMaybe(entry.refId))}</div>
      <div>摘要：${escapeHtml(zhJournalMemo(entry))}</div>
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
