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
