/**
 * Webflow Form Rules Engine (v10)
 * Fix: If user switches OUT from CO -> DOOR, perform a full Section C reset.
 *
 * Implementation:
 * - Track lastOutMode
 * - When currentOutMode becomes "door" and lastOutMode was "co",
 *   call resetSectionC() once, then continue rendering.
 *
 * Keeps everything from v9 (including advanced measurement reveal rules).
 */
(() => {
  const IDS = {
    blockerB: "blocker_b",
    blockerC: "blocker_c",

    locInterior: "loc_interior_radio",
    locExterior: "loc_exterior_radio",

    spRough: "sp_rough_radio",
    spDrywall: "sp_drywall_radio",
    spCO: "sp_co_radio",

    outDoor: "out_door_radio",
    outCO: "out_co_radio",

    dhtStandard: "dht_standard_radio",

    dwhoSystemDecides: "dwho_system_decides_radio",
    dwhoUserDecides: "dwho_user_decides_radio",

    dwsUnitDim: "dws_unit_dim_radio",
    dwsSlabDim: "dws_slab_dim_radio",

    cwhoSystemDecides: "cwho_system_decides_radio",
    cwhoUserDecide: "cwho_user_decides_radio",

    advanced: "advanced_check_box",
    specifySideGaps: "specify_side_gaps_check_box",
    specifyTopGap: "specify_top_gap_check_box",

    divDoorDetail: "door_detail_wrapper",
    divDoorWidthScope: "door_width_scope_wrapper",
    divDoorWidthMsmt: "door_width_msmt_wrapper",

    divCoDetail: "co_detail_wrapper",
    divCoWidthMsmt: "co_width_msmt_wrapper",

    divSpecifySideWrapper: "specify_side_gaps_check_box_wrapper",
    divSideGapMsmt: "side_gap_msmt_wrapper",
    divSpecifyTopWrapper: "specify_top_gap_check_box_wrapper",
    divTopGapMsmt: "top_gap_msmt_wrapper",
  };

  const byId = (id) => document.getElementById(id);

  // ---- Webflow UI sync helpers ----
  const getWebflowMirrorEl = (inputEl) => {
    if (!inputEl) return null;
    const label = inputEl.closest("label");
    if (!label) return null;
    if (inputEl.type === "radio") return label.querySelector(".w-radio-input");
    if (inputEl.type === "checkbox") return label.querySelector(".w-checkbox-input");
    return null;
  };

  const syncWebflowMirror = (inputEl) => {
    const mirror = getWebflowMirrorEl(inputEl);
    if (!mirror) return;
    mirror.classList.toggle("w--redirected-checked", !!inputEl.checked);
  };

  const isChecked = (id) => {
    const el = byId(id);
    return !!(el && el.checked);
  };

  const dispatchValueEvents = (el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const setChecked = (id, checked) => {
    const el = byId(id);
    if (!el) return;

    const next = !!checked;
    if (el.checked === next) {
      syncWebflowMirror(el);
      return;
    }

    el.checked = next;
    syncWebflowMirror(el);
    dispatchValueEvents(el);
  };

  const hardUncheck = (id) => {
    const el = byId(id);
    if (!el) return;
    el.checked = false;
    syncWebflowMirror(el);
  };
  const hardUncheckMany = (ids) => ids.forEach(hardUncheck);

  const uncheckMany = (ids) => ids.forEach((id) => setChecked(id, false));
  const checkMany = (ids) => ids.forEach((id) => setChecked(id, true));

  const setBlocker = (blockerId, on) => {
    const el = byId(blockerId);
    if (!el) return;
    el.style.display = on ? "block" : "none";
  };

  const showDiv = (divId, displayValue = "") => {
    const el = byId(divId);
    if (!el) return;
    el.style.display = displayValue || "";
  };

  const hideDiv = (divId) => {
    const el = byId(divId);
    if (!el) return;
    el.style.display = "none";
  };

  const findInputWrapper = (inputEl) => {
    if (!inputEl) return null;
    const webflowWrapper = inputEl.closest(".w-radio, .w-checkbox");
    if (webflowWrapper) return webflowWrapper;

    const label = inputEl.closest("label");
    if (label) {
      const labelParentWrapper = label.closest(".w-radio, .w-checkbox");
      return labelParentWrapper || label;
    }
    return inputEl.parentElement;
  };

  const hideInputRow = (inputId) => {
    const input = byId(inputId);
    const wrapper = findInputWrapper(input);
    if (!wrapper) return;
    wrapper.style.display = "none";
  };

  const showInputRow = (inputId) => {
    const input = byId(inputId);
    const wrapper = findInputWrapper(input);
    if (!wrapper) return;
    wrapper.style.display = "";
  };

  // ---- Mode trackers ----
  let lastDwhoMode = null; // "system" | "user" | null
  let lastOutMode = null;  // "door" | "co" | null

  // ---------------------------
  // RESET SECTION C
  // ---------------------------
  const resetSectionC = () => {
    checkMany([IDS.outDoor, IDS.dhtStandard, IDS.dwhoSystemDecides]);

    hardUncheck(IDS.cwhoSystemDecides);
    hardUncheck(IDS.cwhoUserDecide);

    hardUncheckMany([IDS.dwsUnitDim, IDS.dwsSlabDim]);

    uncheckMany([IDS.advanced, IDS.specifySideGaps, IDS.specifyTopGap]);

    showDiv(IDS.divDoorDetail, "");
    [
      IDS.divDoorWidthScope,
      IDS.divDoorWidthMsmt,
      IDS.divCoDetail,
      IDS.divCoWidthMsmt,
      IDS.divSpecifySideWrapper,
      IDS.divSideGapMsmt,
      IDS.divSpecifyTopWrapper,
      IDS.divTopGapMsmt,
    ].forEach(hideDiv);

    lastDwhoMode = null;
    lastOutMode = null;
  };

  // ---------------------------
  // OUT MODE + DOOR/CO RULES
  // ---------------------------
  const currentOutMode = () => {
    if (isChecked(IDS.outDoor)) return "door";
    if (isChecked(IDS.outCO)) return "co";
    return null;
  };

  const currentDwhoMode = () => {
    if (isChecked(IDS.dwhoSystemDecides)) return "system";
    if (isChecked(IDS.dwhoUserDecides)) return "user";
    return null;
  };

  const applyDoorRules = () => {
    if (!isChecked(IDS.outDoor)) return;

    const mode = currentDwhoMode();

    if (mode === "system") {
      hideDiv(IDS.divDoorWidthScope);
      hideDiv(IDS.divDoorWidthMsmt);
      hardUncheckMany([IDS.dwsUnitDim, IDS.dwsSlabDim]);
      lastDwhoMode = mode;
      return;
    }

    if (mode === "user") {
      showDiv(IDS.divDoorWidthScope, "");

      if (lastDwhoMode !== "user") {
        hardUncheckMany([IDS.dwsUnitDim, IDS.dwsSlabDim]);
        hideDiv(IDS.divDoorWidthMsmt);
      }

      if (isChecked(IDS.dwsUnitDim) || isChecked(IDS.dwsSlabDim)) {
        showDiv(IDS.divDoorWidthMsmt, "");
      }

      lastDwhoMode = mode;
      return;
    }

    lastDwhoMode = mode;
  };

  const applyCoRules = () => {
    if (!isChecked(IDS.outCO)) return;

    if (lastOutMode !== "co") {
      hardUncheckMany([
        IDS.dhtStandard,
        IDS.dwhoSystemDecides,
        IDS.dwhoUserDecides,
        IDS.dwsUnitDim,
        IDS.dwsSlabDim,
      ]);

      setChecked(IDS.cwhoSystemDecides, true);
      lastDwhoMode = null;
    }

    hideDiv(IDS.divDoorDetail);
    hideDiv(IDS.divDoorWidthScope);
    hideDiv(IDS.divDoorWidthMsmt);

    showDiv(IDS.divCoDetail, "");

    if (isChecked(IDS.cwhoUserDecide)) showDiv(IDS.divCoWidthMsmt, "");
    else hideDiv(IDS.divCoWidthMsmt);
  };

  const applyOutModeRules = () => {
    const outMode = currentOutMode();

    // ✅ NEW: if switching from CO -> DOOR, do a full Section C reset
    if (outMode === "door" && lastOutMode === "co") {
      // This will set outDoor checked and restore all defaults/visibility.
      resetSectionC();
      return; // resetSectionC already set lastOutMode=null; render() will continue and re-apply
    }

    if (outMode === "door") {
      showDiv(IDS.divDoorDetail, "");
      hideDiv(IDS.divCoDetail);
      hideDiv(IDS.divCoWidthMsmt);
    }

    applyCoRules();
    applyDoorRules();

    lastOutMode = outMode;
  };

  // ---------------------------
  // ADVANCED RULES
  // ---------------------------
  const applyAdvancedRules = () => {
    const adv = isChecked(IDS.advanced);

    if (adv) {
      showDiv(IDS.divSpecifySideWrapper, "");
      showDiv(IDS.divSpecifyTopWrapper, "");

      if (isChecked(IDS.specifySideGaps)) showDiv(IDS.divSideGapMsmt, "");
      else hideDiv(IDS.divSideGapMsmt);

      if (isChecked(IDS.specifyTopGap)) showDiv(IDS.divTopGapMsmt, "");
      else hideDiv(IDS.divTopGapMsmt);

      return;
    }

    setChecked(IDS.specifySideGaps, false);
    setChecked(IDS.specifyTopGap, false);

    hideDiv(IDS.divSpecifySideWrapper);
    hideDiv(IDS.divSpecifyTopWrapper);
    hideDiv(IDS.divSideGapMsmt);
    hideDiv(IDS.divTopGapMsmt);
  };

  // ---------------------------
  // A/B DERIVED
  // ---------------------------
  const hasStartingPoint = () =>
    isChecked(IDS.spRough) || isChecked(IDS.spDrywall) || isChecked(IDS.spCO);

  // ---------------------------
  // RENDER
  // ---------------------------
  const render = () => {
    const interior = isChecked(IDS.locInterior);
    const exterior = isChecked(IDS.locExterior);

    if (!interior && !exterior) {
      setBlocker(IDS.blockerB, true);
      setBlocker(IDS.blockerC, true);

      showInputRow(IDS.spRough);
      showInputRow(IDS.spDrywall);
      showInputRow(IDS.spCO);

      applyOutModeRules();
      applyAdvancedRules();
      return;
    }

    if (interior) {
      setBlocker(IDS.blockerB, false);
      setBlocker(IDS.blockerC, !hasStartingPoint());

      showInputRow(IDS.spRough);
      showInputRow(IDS.spDrywall);
      showInputRow(IDS.spCO);
    }

    if (exterior) {
      setBlocker(IDS.blockerB, false);
      setBlocker(IDS.blockerC, false);

      setChecked(IDS.spRough, true);

      hideInputRow(IDS.spDrywall);
      hideInputRow(IDS.spCO);
      showInputRow(IDS.spRough);
    }

    applyOutModeRules();
    applyAdvancedRules();
  };

  // ---------------------------
  // EVENTS
  // ---------------------------
  const onLocationChange = () => {
    uncheckMany([IDS.spRough, IDS.spDrywall, IDS.spCO]);
    showInputRow(IDS.spRough);
    showInputRow(IDS.spDrywall);
    showInputRow(IDS.spCO);

    resetSectionC();
    render();
  };

  const onStartingPointChange = () => {
    resetSectionC();
    render();
  };

  const onSectionCChange = () => {
    render();
  };

  const wire = () => {
    [IDS.locInterior, IDS.locExterior].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener("change", onLocationChange);
    });

    [IDS.spRough, IDS.spDrywall, IDS.spCO].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener("change", onStartingPointChange);
    });

    [
      IDS.outDoor,
      IDS.outCO,
      IDS.dwhoSystemDecides,
      IDS.dwhoUserDecides,
      IDS.dwsUnitDim,
      IDS.dwsSlabDim,
      IDS.cwhoSystemDecides,
      IDS.cwhoUserDecide,
      IDS.advanced,
      IDS.specifySideGaps,
      IDS.specifyTopGap,
    ].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener("change", onSectionCChange);
    });
  };

  // ---------------------------
  // BOOT
  // ---------------------------
  const boot = () => {
    setBlocker(IDS.blockerB, true);
    setBlocker(IDS.blockerC, true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resetSectionC();
        render();
      });
    });

    wire();
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
