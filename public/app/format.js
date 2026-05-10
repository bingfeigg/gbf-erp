function formatDateTimeShort(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return "-";
  // Accept common backend datetime strings: "YYYY-MM-DD HH:mm:ss" / ISO
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return raw;
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
function fmtMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : String(n ?? "-");
}

function fmtMaybe(v) {
  if (v == null || v === "") return "-";
  return String(v);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
