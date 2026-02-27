
(() => {
  // =========================================
  // CONFIG
  // =========================================
  const FORM_ID = "wf_form_combo";
  const SUBMIT_ID = "submit_query";
  const SEARCH_AGAIN_ID = "search_again";
  const SOLUTIONS_AREA_ID = "solutions_area";

  const BLOCKER_FORM_ID = "blocker_form";

  const ICON_REGISTRY_ID = "icon_registry";

  const MODAL_OVERLAY_ID = "modal-overlay";
  const MODAL_PANEL_ID = "modal-panel";
  const MODAL_CLOSE_ID = "modal-close";

  const REQUEST_ENDPOINT_URL =
    "https://api.transomsdirect.com/api:xyi0dc0X/bc_combo_solution_request";
  const RETRIEVAL_ENDPOINT_URL =
    "https://api.transomsdirect.com/api:xyi0dc0X/combo_unit_solution_retrieval";

  const POLL_INTERVAL_MS = 2000;
  const MAX_POLLS = 40;

  const TEMPLATE_CARD_SELECTOR = '[data-solution-card="template"]';
  const LIST_SELECTOR = ".solutions-list";
  const ROW_TEMPLATE_SELECTOR = '[data-solution-row="template"]';
  const POS_ORDER = ["pos2", "pos13", "pos4", "pos56"];

  // =========================================
  // GLOBALS
  // =========================================
  window.job_id = null;
  window.comboSolutions = [];

  let ORIGINAL_BTN_TEXT = null;
  let ORIGINAL_BTN_BG = null;
  let ORIGINAL_BTN_COLOR = null;
  let ORIGINAL_BTN_BORDER = null;

  const ICON_MAP = Object.create(null);

  // =========================================
  // UTILS
  // =========================================
  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function safeParseJSON(str) { try { return JSON.parse(str); } catch { return null; } }

  function getForm() { return document.getElementById(FORM_ID); }

  function getSubmitButton() {
    const byId = document.getElementById(SUBMIT_ID);
    if (byId) return byId;
    const form = getForm();
    if (!form) return null;
    return form.querySelector('button[type="submit"], input[type="submit"]');
  }

  function showFormBlocker() {
    const blocker = document.getElementById(BLOCKER_FORM_ID);
    if (blocker) blocker.style.display = "block";
  }
  function hideFormBlocker() {
    const blocker = document.getElementById(BLOCKER_FORM_ID);
    if (blocker) blocker.style.display = "none";
  }

  function snapshotButtonOriginalStyles(btn) {
    if (!btn) return;
    if (ORIGINAL_BTN_TEXT === null) {
      ORIGINAL_BTN_TEXT =
        (btn.tagName || "").toLowerCase() === "input" ? btn.value : btn.textContent;
      const cs = window.getComputedStyle(btn);
      ORIGINAL_BTN_BG = cs.backgroundColor;
      ORIGINAL_BTN_COLOR = cs.color;
      ORIGINAL_BTN_BORDER = cs.borderColor;
    }
  }

  function setButtonText(btn, text) {
    if (!btn) return;
    if ((btn.tagName || "").toLowerCase() === "input") btn.value = text;
    else btn.textContent = text;
  }

  function setButtonDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.style.pointerEvents = disabled ? "none" : "auto";
    btn.style.opacity = disabled ? "0.7" : "1";
  }

  function setButtonGrey(btn) {
    if (!btn) return;
    btn.style.backgroundColor = "#9CA3AF";
    btn.style.borderColor = "#9CA3AF";
    btn.style.color = "#FFFFFF";
  }

  function restoreButton(btn) {
    if (!btn) return;
    if (ORIGINAL_BTN_TEXT !== null) setButtonText(btn, ORIGINAL_BTN_TEXT);
    if (ORIGINAL_BTN_BG !== null) btn.style.backgroundColor = ORIGINAL_BTN_BG;
    if (ORIGINAL_BTN_COLOR !== null) btn.style.color = ORIGINAL_BTN_COLOR;
    if (ORIGINAL_BTN_BORDER !== null) btn.style.borderColor = ORIGINAL_BTN_BORDER;
    setButtonDisabled(btn, false);
  }

  function hideSolutionsArea() {
    const el = document.getElementById(SOLUTIONS_AREA_ID);
    if (el) el.style.display = "none";
  }
  function showSolutionsArea() {
    const el = document.getElementById(SOLUTIONS_AREA_ID);
    if (el) el.style.display = "";
  }

  function getWebflowPanels(form) {
    const wrapper = form?.closest(".w-form") || form?.parentElement;
    return {
      done: wrapper?.querySelector(".w-form-done") || null,
      fail: wrapper?.querySelector(".w-form-fail") || null,
    };
  }
  function showWebflowSuccessKeepForm(form) {
    const { done, fail } = getWebflowPanels(form);
    if (done) done.style.display = "block";
    if (fail) fail.style.display = "none";
  }
  function hideWebflowPanels(form) {
    const { done, fail } = getWebflowPanels(form);
    if (done) done.style.display = "none";
    if (fail) fail.style.display = "none";
  }

  // =========================================
  // ICON REGISTRY
  // =========================================
  function buildIconMapFromRegistry() {
    const reg = document.getElementById(ICON_REGISTRY_ID);
    if (!reg) return;

    reg.querySelectorAll("img[data-icon-name]").forEach((img) => {
      const name = (img.getAttribute("data-icon-name") || "").trim();
      const src = (img.getAttribute("src") || "").trim();
      if (!name || !src) return;
      ICON_MAP[name] = src;
    });
  }

  function normalizeIconKey(iconPath) {
    if (!iconPath) return "";
    const parts = String(iconPath).split("/");
    return parts[parts.length - 1].trim();
  }

  // =========================================
  // WEBFLOW IX SAFETY
  // =========================================
  function stripWebflowInteractionIds(rootEl) {
    if (!rootEl) return;
    rootEl.removeAttribute("data-w-id");
    rootEl.querySelectorAll("[data-w-id]").forEach(el => el.removeAttribute("data-w-id"));
  }

  // =========================================
  // MODAL (behavior only)
  // - Explore click opens modal first AND calls build_assembly_svg(index)
  // =========================================
  function openModal() {
    const overlay = document.getElementById(MODAL_OVERLAY_ID);
    if (overlay) overlay.style.display = "flex";
  }
  function closeModal() {
    const overlay = document.getElementById(MODAL_OVERLAY_ID);
    if (overlay) overlay.style.display = "none";
  }

  function initModalBehavior() {
    const overlay = document.getElementById(MODAL_OVERLAY_ID);
    const panel = document.getElementById(MODAL_PANEL_ID);
    const closeBtn = document.getElementById(MODAL_CLOSE_ID);

    // OPEN from Explore (capture phase, dynamic-safe)
    document.addEventListener("click", (e) => {
      const exploreBtn = e.target.closest('[data-solution-explore="btn"]');
      if (!exploreBtn) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // 1) Open modal first
      openModal();

      // 2) Call renderer using stored index
      const idx = Number(exploreBtn.dataset.solutionIndex);
      if (!Number.isFinite(idx)) {
        console.warn("Explore button missing/invalid data-solution-index.", exploreBtn);
        return;
      }
      if (typeof window.build_assembly_svg !== "function") {
        console.warn("build_assembly_svg(index) is not defined yet.");
        return;
      }
      try {
        window.build_assembly_svg(idx);
      } catch (err) {
        console.error("build_assembly_svg failed:", err);
      }
    }, true);

    // CLOSE: close button
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeModal();
      });
    }

    // CLOSE: click overlay background only
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // DO NOT CLOSE: clicks inside panel
    if (panel) panel.addEventListener("click", (e) => e.stopPropagation());

    // ESC closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // =========================================
  // NETWORK
  // =========================================
  async function fetchJsonOrText(res) {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) return await res.json().catch(() => null);
    const txt = await res.text().catch(() => null);
    if (typeof txt === "string") {
      const parsed = safeParseJSON(txt);
      return parsed !== null ? parsed : txt;
    }
    return txt;
  }

  async function submitInitialRequest(form) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) params.append(k, v);

    const res = await fetch(REQUEST_ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString(),
    });

    const data = await fetchJsonOrText(res);
    const unixValue =
      (typeof data === "object" && data !== null)
        ? (data.job_id ?? data.unix ?? data.jobId ?? Object.values(data)[0])
        : data;

    window.job_id = Number(unixValue);
    if (!Number.isFinite(window.job_id)) throw new Error("Invalid job_id returned.");
    return window.job_id;
  }

  async function postUrlEncoded(url, obj) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) params.append(k, String(v));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString(),
    });

    const data = await fetchJsonOrText(res);

    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && data.message) ? data.message :
        (typeof data === "string" && data.trim()) ? data :
        `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data;
  }

  async function pollForSolutions(jobId, onFirstNotReady) {
    await sleep(POLL_INTERVAL_MS);

    for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
      const resp = await postUrlEncoded(RETRIEVAL_ENDPOINT_URL, { job_id: jobId });

      const isNotReady =
        (typeof resp === "string" && resp.trim().toLowerCase() === "not_ready") ||
        (resp && typeof resp === "object" && (resp.status === "not_ready" || resp.state === "not_ready"));

      if (!isNotReady) return resp;

      if (attempt === 1 && typeof onFirstNotReady === "function") onFirstNotReady(resp);
      if (attempt < MAX_POLLS) await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Polling timed out after ${MAX_POLLS} attempts.`);
  }

  // =========================================
  // PARSE -> GLOBAL STORE
  // =========================================
  function extractSolutionsArray(resp) {
    if (Array.isArray(resp)) return resp;
    if (resp && typeof resp === "object") {
      return resp.solutions || resp.solution_array || resp.data || resp.results || resp.items || [];
    }
    return [];
  }

  function normalizeSolutions(resp) {
    const arr = extractSolutionsArray(resp);

    return arr.map((sol, idx) => ({
      index: idx,
      job_id: window.job_id,

      assembly_template: sol.assembly_template ?? null,
      assembly_no: sol.assembly_no ?? sol.arrangement_no ?? null,

      icon: sol.icon ?? null,
      solution_grid: sol.solution_grid ?? {},

      build_objects: sol.build_objects ?? {},

      solution_svg: sol.solution_svg ?? null,

      meta: sol.meta ?? {}
    }));
  }

  // =========================================
  // DOM POPULATION
  // =========================================
  function setField(root, fieldName, value) {
    const el = root?.querySelector?.(`[data-field="${fieldName}"]`);
    if (!el) return;

    const v = (value === null || value === undefined) ? "" : String(value);
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") el.value = v;
    else el.textContent = v;
  }

  function setIcon(card, iconPath) {
    const wrapper = card.querySelector('[data-solution-icon="img"]');
    if (!wrapper) return;

    const img = wrapper.querySelector('[data-field="icon"]');
    if (!img) return;

    if (!iconPath) {
      img.removeAttribute("src");
      img.alt = "";
      return;
    }

    const raw = String(iconPath).trim();
    const looksAbsolute = /^https?:\/\//i.test(raw);

    let resolved = raw;

    if (!looksAbsolute) {
      const filename = normalizeIconKey(raw);
      if (ICON_MAP[filename]) {
        resolved = ICON_MAP[filename];
      } else {
        resolved = new URL(raw, window.location.origin).href;
        console.warn("Icon not found in registry; fallback:", resolved, "original:", raw);
      }
    }

    img.alt = "Arrangement icon";
    img.onerror = () => console.warn("Icon failed to load:", resolved, "original:", raw);
    img.src = resolved;
  }

  function setSummary(card, solutionGrid) {
    const summaryValue = solutionGrid?.notes ?? "";
    const summaryRow = card.querySelector('[data-solution-summary="row"]');
    if (!summaryRow) return;
    setField(summaryRow, "summary", summaryValue);
  }

  function buildRowsInCard(card, solutionGrid) {
    const rowTemplate = card.querySelector(ROW_TEMPLATE_SELECTOR);
    if (!rowTemplate) return;

    const summaryRow = card.querySelector('[data-solution-summary="row"]');

    $all(".solution-row", card).forEach((r) => {
      if (r.getAttribute("data-solution-row") !== "template") r.remove();
    });

    rowTemplate.style.display = "none";
    const rowsParent = rowTemplate.parentElement;

    POS_ORDER.forEach((posKey) => {
      const rowData = solutionGrid?.[posKey];
      if (!rowData) return;

      const row = rowTemplate.cloneNode(true);
      row.style.display = "";
      row.removeAttribute("data-solution-row");
      row.setAttribute("data-pos", posKey);

      stripWebflowInteractionIds(row);

      setField(row, "row", rowData.row);
      setField(row, "building_block", rowData.building_block);
      setField(row, "order_dims", rowData.order_dims);
      setField(row, "quantity", rowData.quantity);
      setField(row, "door_unit_width", rowData.door_unit_width);
      setField(row, "door_unit_height", rowData.door_unit_height);

      if (summaryRow && summaryRow.parentElement === rowsParent) {
        rowsParent.insertBefore(row, summaryRow);
      } else {
        rowsParent.appendChild(row);
      }
    });
  }

  function wireExploreButton(card, idx) {
    const btn = card.querySelector('[data-solution-explore="btn"]');
    if (!btn) return;
    btn.removeAttribute("data-w-id");
    btn.dataset.solutionIndex = String(idx);
  }

  function clearNonTemplateCards() {
    const list = $(LIST_SELECTOR);
    if (!list) return;
    $all("[data-solution-card]", list).forEach((card) => {
      if (card.getAttribute("data-solution-card") !== "template") card.remove();
    });
  }

  function populateSolutionsFromStore() {
    const list = $(LIST_SELECTOR);
    const template = $(TEMPLATE_CARD_SELECTOR);

    if (!list) throw new Error(`Missing solutions list: ${LIST_SELECTOR}`);
    if (!template) throw new Error(`Missing template card: ${TEMPLATE_CARD_SELECTOR}`);

    clearNonTemplateCards();
    template.style.display = "none";

    window.comboSolutions.forEach((sol, idx) => {
      const card = template.cloneNode(true);
      card.style.display = "";
      card.setAttribute("data-solution-card", `solution-${idx + 1}`);

      stripWebflowInteractionIds(card);

      setIcon(card, sol.icon);
      buildRowsInCard(card, sol.solution_grid);
      setSummary(card, sol.solution_grid);
      wireExploreButton(card, idx);

      list.appendChild(card);
    });
  }

  // =========================================
  // RESET
  // =========================================
  function resetUI() {
    const form = getForm();
    const btn = getSubmitButton();

    hideSolutionsArea();
    clearNonTemplateCards();
    hideWebflowPanels(form);
    closeModal();

    window.job_id = null;
    window.comboSolutions = [];

    restoreButton(btn);

    hideFormBlocker();
  }

  // =========================================
  // INIT
  // =========================================
  function init() {
    buildIconMapFromRegistry();
    hideSolutionsArea();
    initModalBehavior();

    hideFormBlocker();

    const form = getForm();
    if (!form) return;

    form.removeAttribute("data-wf-form");
    form.removeAttribute("data-wf-page-id");
    form.removeAttribute("data-wf-element-id");

    const submitBtn = getSubmitButton();
    snapshotButtonOriginalStyles(submitBtn);

    const searchAgainBtn = document.getElementById(SEARCH_AGAIN_ID);
    if (searchAgainBtn && searchAgainBtn.dataset.bound !== "1") {
      searchAgainBtn.dataset.bound = "1";
      searchAgainBtn.addEventListener("click", (e) => {
        e.preventDefault();
        resetUI();
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

      const btn = getSubmitButton();
      snapshotButtonOriginalStyles(btn);

      setButtonText(btn, "Solution Requested...");
      setButtonDisabled(btn, true);

      hideSolutionsArea();
      clearNonTemplateCards();

      try {
        const jobId = await submitInitialRequest(form);

        const resp = await pollForSolutions(jobId, () => {
          setButtonText(btn, "Solutions Calculating...");
        });

        window.comboSolutions = normalizeSolutions(resp);

        populateSolutionsFromStore();
        showSolutionsArea();
        showWebflowSuccessKeepForm(form);

        setButtonText(btn, "Solutions Complete");
        setButtonGrey(btn);
        setButtonDisabled(btn, true);

        showFormBlocker();

      } catch (err) {
        console.error("Combo request/poll failed:", err);

        hideSolutionsArea();

        const { fail } = getWebflowPanels(form);
        if (fail) {
          fail.style.display = "block";
          const msgEl = fail.querySelector("div");
          if (msgEl) msgEl.textContent = err.message || "Submission failed.";
        }

        restoreButton(btn);
        hideFormBlocker();
      }
    }, true);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
