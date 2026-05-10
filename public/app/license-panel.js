(function () {
  const licenseBanner = document.getElementById("licenseBanner");
  const loginLicenseHint = document.getElementById("loginLicenseHint");
  const loginLicenseCard = document.getElementById("loginLicenseCard");
  const licensePasteBootstrap = document.getElementById("licensePasteBootstrap");
  const btnLicenseBootstrap = document.getElementById("btnLicenseBootstrap");
  const licenseBootstrapFeedback = document.getElementById("licenseBootstrapFeedback");

  const licenseGateModal = document.getElementById("licenseGateModal");
  const licenseGateModalReason = document.getElementById("licenseGateModalReason");
  const licenseGateModalAdmin = document.getElementById("licenseGateModalAdmin");
  const licenseGateModalNonAdmin = document.getElementById("licenseGateModalNonAdmin");
  const licensePasteModal = document.getElementById("licensePasteModal");
  const btnLicenseInstallModal = document.getElementById("btnLicenseInstallModal");
  const licenseModalFeedback = document.getElementById("licenseModalFeedback");
  const btnLicenseModalSwitch = document.getElementById("btnLicenseModalSwitch");

  const appShellEl = document.getElementById("appShell");
  const loginScreenEl = document.getElementById("loginScreen");

  const licensePanelHint = document.getElementById("licensePanelHint");
  const licensePasteArea = document.getElementById("licensePasteArea");
  const btnLicenseInstall = document.getElementById("btnLicenseInstall");
  const btnLicensePickPanel = document.getElementById("btnLicensePickPanel");
  const licenseFilePanel = document.getElementById("licenseFilePanel");
  const licenseInstallFeedback = document.getElementById("licenseInstallFeedback");
  const licenseInstallationId = document.getElementById("licenseInstallationId");

  const licenseFileBootstrap = document.getElementById("licenseFileBootstrap");
  const btnLicensePickBootstrap = document.getElementById("btnLicensePickBootstrap");
  const licenseFileModal = document.getElementById("licenseFileModal");
  const btnLicensePickModal = document.getElementById("btnLicensePickModal");

  function bindLicenseJsonFilePick(fileInput, btn, textarea, onLoaded) {
    if (!fileInput || !btn || !textarea) return;
    btn.addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        textarea.value = String(reader.result || "").trim();
        if (typeof onLoaded === "function") onLoaded();
      };
      reader.onerror = function () {
        textarea.value = "";
        if (typeof onLoaded === "function") onLoaded();
      };
      reader.readAsText(f, "UTF-8");
    });
  }

  async function fetchLicenseStatus() {
    const r = await fetch("/api/license/status");
    return r.json();
  }

  function setBanner(text, mode) {
    if (!licenseBanner) return;
    licenseBanner.textContent = text;
    licenseBanner.classList.remove("hidden", "license-warn", "license-err");
    if (!text) {
      licenseBanner.classList.add("hidden");
      return;
    }
    if (mode === "warn") licenseBanner.classList.add("license-warn");
    else if (mode === "err") licenseBanner.classList.add("license-err");
  }

  function updateLoginLicenseCard(st) {
    if (!loginLicenseCard) return;
    if (!st.enforcement || st.valid) {
      loginLicenseCard.classList.add("hidden");
      return;
    }
    if (st.trialActive) {
      loginLicenseCard.classList.add("hidden");
      return;
    }
    loginLicenseCard.classList.remove("hidden");
  }

  function updateLicenseGateModal(st) {
    if (!licenseGateModal) return;
    if (!st.enforcement || st.valid || st.trialActive) {
      licenseGateModal.classList.add("hidden");
      return;
    }
    const onApp = appShellEl && !appShellEl.classList.contains("hidden");
    if (!onApp) {
      licenseGateModal.classList.add("hidden");
      return;
    }
    const reason = st.reason || "许可证无效或已过期";
    if (licenseGateModalReason) licenseGateModalReason.textContent = reason;
    const isAdmin = String(state.role || "") === "admin";
    if (licenseGateModalAdmin && licenseGateModalNonAdmin) {
      if (isAdmin) {
        licenseGateModalAdmin.classList.remove("hidden");
        licenseGateModalNonAdmin.classList.add("hidden");
      } else {
        licenseGateModalAdmin.classList.add("hidden");
        licenseGateModalNonAdmin.classList.remove("hidden");
      }
    }
    licenseGateModal.classList.remove("hidden");
  }

  function updateExpiryReminder(st) {
    const el = document.getElementById("licenseExpiryReminder");
    if (!el) return;
    el.classList.remove("warn", "hidden");
    if (!st.enforcement) {
      if (st.trialUiActive && typeof st.trialUiDaysRemaining === "number") {
        el.textContent = `试用剩余约 ${st.trialUiDaysRemaining} 天（正式授权需配置公钥并导入许可证）`;
        if (st.trialUiDaysRemaining <= 3) el.classList.add("warn");
        return;
      }
      if (st.trialUiActive === false) {
        el.textContent = "试用已结束，请配置验签公钥并导入正式许可证";
        el.classList.add("warn");
        return;
      }
      el.textContent = "";
      el.classList.add("hidden");
      return;
    }
    if (st.valid && typeof st.daysRemaining === "number") {
      el.textContent = `许可证剩余约 ${st.daysRemaining} 天`;
      if (st.daysRemaining <= 30) el.classList.add("warn");
      return;
    }
    if (st.trialActive && typeof st.trialDaysRemaining === "number") {
      el.textContent = `试用期剩余约 ${st.trialDaysRemaining} 天`;
      if (st.trialDaysRemaining <= 3) el.classList.add("warn");
      return;
    }
    el.textContent = "";
    el.classList.add("hidden");
  }

  function clearLicenseInputsAfterSave() {
    [licensePasteArea, licensePasteModal, licensePasteBootstrap].forEach((el) => {
      if (el) el.value = "";
    });
    [licenseFilePanel, licenseFileModal, licenseFileBootstrap].forEach((el) => {
      if (el) el.value = "";
    });
  }

  async function submitInstallWithToken(textarea, feedbackEl) {
    const raw = String(textarea.value || "").trim();
    if (!raw) {
      if (feedbackEl) feedbackEl.textContent = "请先粘贴或许可证文件载入后再保存。";
      return;
    }
    if (feedbackEl) {
      feedbackEl.textContent = "保存中…";
      feedbackEl.className = "muted";
    }
    try {
      await api("/api/license/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseJson: raw })
      });
      if (feedbackEl) {
        feedbackEl.textContent = "已保存，正在刷新…";
        feedbackEl.className = "ok";
      }
      clearLicenseInputsAfterSave();
      await refreshLicenseBannerAndPanel();
      if (typeof refreshAll === "function") {
        await refreshAll({ source: "license" }).catch(() => {});
      }
      if (feedbackEl) feedbackEl.textContent = "许可证已保存；原文已从页面清除，请自行保管签发副本。";
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (feedbackEl) {
        feedbackEl.textContent = msg;
        feedbackEl.className = "warn";
      }
    }
  }

  async function refreshLicenseBannerAndPanel() {
    let st;
    try {
      st = await fetchLicenseStatus();
    } catch (_e) {
      if (licensePanelHint) licensePanelHint.textContent = "无法读取许可证状态（网络或服务异常）。";
      return;
    }

    const isAdmin = String(state.role || "") === "admin";

    if (licenseInstallationId && "installationId" in st && st.installationId) {
      licenseInstallationId.textContent = st.installationId;
    } else if (licenseInstallationId) {
      licenseInstallationId.textContent = "—";
    }

    updateLoginLicenseCard(st);
    updateLicenseGateModal(st);

    if (!st.enforcement) {
      setBanner("", null);
      if (loginLicenseHint) {
        loginLicenseHint.classList.add("hidden");
        loginLicenseHint.textContent = "";
      }
      if (licensePanelHint) {
        if (st.trialUiActive && typeof st.trialUiDaysRemaining === "number") {
          licensePanelHint.textContent =
            `未配置验签公钥：试用剩余约 ${st.trialUiDaysRemaining} 天（首次访问起算，见 data/trial.json）。配置 LICENSE_PUBLIC_KEY_FILE 后可启用正式许可证与接口校验。`;
        } else if (st.trialUiActive === false) {
          licensePanelHint.textContent =
            "试用已结束（仍未配置公钥）。请部署 LICENSE_PUBLIC_KEY_FILE 并导入正式许可证以继续使用授权功能。";
        } else {
          licensePanelHint.textContent =
            "当前未启用许可证校验（服务端未配置 LICENSE_PUBLIC_KEY_FILE）。生产环境建议配置公钥并设置 LICENSE_PUBLIC_KEY_REQUIRED=1。";
        }
        if (isAdmin) {
          licensePanelHint.innerHTML +=
            '<br/><br/><strong>导入许可证：</strong>可将签发方提供的 license.json 粘贴至下方或「选择 license 文件」。<strong>保存前</strong>请先在服务端配置 <code style="font-size:11px;">LICENSE_PUBLIC_KEY_FILE</code>（与客户环境验签公钥一致），否则服务端无法完成验签。';
        }
      }
      if (licensePasteArea && btnLicenseInstall) {
        if (isAdmin) {
          licensePasteArea.classList.remove("hidden");
          btnLicenseInstall.classList.remove("hidden");
          if (btnLicensePickPanel) btnLicensePickPanel.classList.remove("hidden");
        } else {
          licensePasteArea.classList.add("hidden");
          btnLicenseInstall.classList.add("hidden");
          if (btnLicensePickPanel) btnLicensePickPanel.classList.add("hidden");
        }
      }
      updateExpiryReminder(st);
      return;
    }

    if (st.valid) {
      const days = st.daysRemaining;
      const exp = st.expiresAt ? String(st.expiresAt).slice(0, 10) : "";
      let hint = exp ? `许可证有效，到期日 ${exp}` : "许可证有效";
      if (typeof days === "number") hint += `（剩余约 ${days} 天）`;
      if (String(state.role || "") === "admin") {
        hint += "。到期前可将新许可证全文粘贴至下方保存。";
      }
      if (licensePanelHint) licensePanelHint.textContent = hint;
      if (typeof days === "number" && days <= 30) {
        setBanner(`许可证将于约 ${days} 天后到期（${exp || "详见面板"}），请及时更换新许可证文件。`, "warn");
      } else {
        setBanner("", null);
      }
      if (loginLicenseHint) {
        loginLicenseHint.classList.add("hidden");
        loginLicenseHint.textContent = "";
      }
    } else if (st.trialActive) {
      const tr = typeof st.trialDaysRemaining === "number" ? st.trialDaysRemaining : "?";
      setBanner(`试用期剩余约 ${tr} 天，请在到期前导入正式许可证（导航 → 工具 → 许可证，或登录页）。`, "warn");
      if (loginLicenseHint) {
        loginLicenseHint.textContent = `试用期剩余约 ${tr} 天，到期前请导入正式许可证；管理员可先粘贴许可证再登录。`;
        loginLicenseHint.classList.remove("hidden");
      }
      let hint = `试用期内（剩余约 ${tr} 天），请尽快导入正式许可证。`;
      if (String(state.role || "") === "admin") {
        hint += " 可将签发方提供的 JSON 全文粘贴至下方保存。";
      } else {
        hint += " 请联系贵司管理员导入。";
      }
      if (licensePanelHint) licensePanelHint.textContent = hint;
    } else {
      const reason = st.reason || "许可证无效或已过期";
      setBanner(`许可证不可用：${reason}。请在登录页「许可证未就绪」粘贴，或登录后在本页保存。`, "err");
      if (loginLicenseHint) {
        loginLicenseHint.textContent = "";
        loginLicenseHint.classList.add("hidden");
      }
      if (licensePanelHint) licensePanelHint.textContent = reason;
    }

    if (licensePasteArea && btnLicenseInstall) {
      if (isAdmin) {
        licensePasteArea.classList.remove("hidden");
        btnLicenseInstall.classList.remove("hidden");
        if (btnLicensePickPanel) btnLicensePickPanel.classList.remove("hidden");
      } else {
        licensePasteArea.classList.add("hidden");
        btnLicenseInstall.classList.add("hidden");
        if (btnLicensePickPanel) btnLicensePickPanel.classList.add("hidden");
      }
    }
    if (!isAdmin && !st.valid && !st.trialActive && licensePanelHint) {
      licensePanelHint.textContent += "（当前账号非管理员，无法在此粘贴许可证）";
    }

    updateExpiryReminder(st);
  }

  window.refreshLicenseBannerAndPanel = refreshLicenseBannerAndPanel;

  window.addEventListener("gbf-license-blocked", () => {
    refreshLicenseBannerAndPanel().catch(() => {});
  });

  if (btnLicenseInstall && licensePasteArea) {
    btnLicenseInstall.addEventListener("click", () => submitInstallWithToken(licensePasteArea, licenseInstallFeedback));
  }

  if (btnLicenseInstallModal && licensePasteModal) {
    btnLicenseInstallModal.addEventListener("click", () => submitInstallWithToken(licensePasteModal, licenseModalFeedback));
  }

  if (btnLicenseBootstrap && licensePasteBootstrap) {
    btnLicenseBootstrap.addEventListener("click", async () => {
      const u = document.getElementById("username") ? document.getElementById("username").value.trim() : "";
      const p = document.getElementById("password") ? document.getElementById("password").value.trim() : "";
      const licenseJson = String(licensePasteBootstrap.value || "").trim();
      if (!u || !p) {
        if (licenseBootstrapFeedback) licenseBootstrapFeedback.textContent = "请先填写管理员用户名与密码。";
        return;
      }
      if (!licenseJson) {
        if (licenseBootstrapFeedback) licenseBootstrapFeedback.textContent = "请先粘贴或许可证文件载入完整 JSON。";
        return;
      }
      if (licenseBootstrapFeedback) {
        licenseBootstrapFeedback.textContent = "验证并保存中…";
        licenseBootstrapFeedback.className = "muted";
      }
      try {
        const res = await fetch("/api/license/install-bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p, licenseJson })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || `HTTP ${res.status}`);
        }
        if (licenseBootstrapFeedback) {
          licenseBootstrapFeedback.textContent = "许可证已保存；原文已从页面清除。请点击「登录系统」进入。";
          licenseBootstrapFeedback.className = "ok";
        }
        clearLicenseInputsAfterSave();
        await refreshLicenseBannerAndPanel();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (licenseBootstrapFeedback) {
          licenseBootstrapFeedback.textContent = msg;
          licenseBootstrapFeedback.className = "warn";
        }
      }
    });
  }

  if (btnLicenseModalSwitch) {
    btnLicenseModalSwitch.addEventListener("click", () => {
      const sw = document.getElementById("btnSwitchAccount");
      if (sw) sw.click();
    });
  }

  bindLicenseJsonFilePick(licenseFileBootstrap, btnLicensePickBootstrap, licensePasteBootstrap);
  bindLicenseJsonFilePick(licenseFilePanel, btnLicensePickPanel, licensePasteArea);
  bindLicenseJsonFilePick(licenseFileModal, btnLicensePickModal, licensePasteModal);

  refreshLicenseBannerAndPanel().catch(() => {});
})();
