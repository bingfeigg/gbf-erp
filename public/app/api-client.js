function ensureToken() {
  if (!state.token) throw new Error("请先登录。");
}

function handleAuthExpired(message = "登录已过期，请重新登录。") {
  state.token = "";
  state.username = "";
  state.role = "";
  state.permissions = [];
  state.canUseDevOps = false;
  localStorage.removeItem(STORAGE_SESSION_KEY);
  setAuthenticatedUi(false);
  if (loginStatus) {
    loginStatus.textContent = message;
    loginStatus.className = "warn";
  }
  showActionWarn(message);
}

function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(path, { ...options, headers }).then(async (res) => {
    const text = await res.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: text ? String(text).slice(0, 240) : `HTTP ${res.status}` };
    }
    if (!res.ok) {
      const rawMessage = String(body.message || `HTTP ${res.status}`);
      const method = String(options.method || "GET").toUpperCase();
      const pathOnly = String(path).split("?")[0];
      // 登录失败也是 401，不能当作「已有会话过期」，否则看不到真实错误提示。
      const isAuthLoginPost = method === "POST" && pathOnly === "/api/auth/login";
      const authExpired =
        !isAuthLoginPost &&
        (res.status === 401 ||
          /token expired|jwt expired|unauthorized|invalid token|forbidden/i.test(rawMessage));
      if (authExpired) {
        handleAuthExpired("登录已过期，请重新登录。");
        throw new Error("登录已过期，请重新登录。");
      }
      const details = body.issues ? ` | ${body.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : "";
      throw new Error(rawMessage + details);
    }
    return body;
  });
}

function hasPermission(permission) {
  const perms = state.permissions || [];
  return perms.includes("*") || perms.includes(permission);
}

function normalizePagedRows(payload) {
  if (Array.isArray(payload)) return { rows: payload, total: payload.length, page: 1, pageSize: payload.length || approvalPager.pageSize };
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const total = Number(payload?.total || rows.length);
  const page = Number(payload?.page || 1);
  const pageSize = Number(payload?.pageSize || approvalPager.pageSize);
  return { rows, total, page, pageSize };
}
