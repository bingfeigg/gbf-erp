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
    if (text === "选" || text === "批选") return "th-check";
    if (text === "ID") return "th-idcol";
    if (text === "单号") return "th-orderno";
    if (text === "类型") return "th-type";
    if (text === "供应商" || text === "客户") return "th-party";
    if (text === "阶段") return "th-stage";
    if (text === "状态") return "th-status";
    if (text.includes("驳回")) return "th-reject";
    if (/(金额|借方|贷方|余额|成本|价格|数量|库存|openAmount|paid|received)/i.test(text)) return "th-amount";
    if (/(级别|动作|类型)/i.test(text)) return "th-status";
    if (/(时间|日期|created|submitted|approved)/i.test(text)) return "th-time";
    if (/(^ID$|编号|单号|发票号|账单号|凭证号|SKU)/i.test(text)) return "th-id";
    return "";
  };
  const classifyCell = (label) => {
    const text = String(label || "");
    if (text === "选" || text === "批选") return "td-check";
    if (text === "ID") return "td-idcol";
    if (text === "单号") return "td-orderno";
    if (text === "类型") return "td-type";
    if (text === "供应商" || text === "客户") return "td-party";
    if (text === "阶段") return "td-stage";
    if (text === "状态") return "td-status";
    if (text.includes("驳回")) return "td-reject";
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
          const colType = classifyCell(c.label);
          const raw = c.getter(row);
          const v =
            colType === "td-time" && (typeof raw === "string" || typeof raw === "number")
              ? `<span title="${escapeHtml(String(raw ?? "-"))}">${escapeHtml(formatDateTimeShort(raw))}</span>`
              : raw;
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
