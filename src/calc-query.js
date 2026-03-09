/**
 * File: calc-query.js
 *
 * Role:
 * UI GLUE
 * 
 * Purpose:
 *  Sidecar rules engine for a Webflow-built form. Manages query/option UI state (hide/show, gating via blockers,
 *  defaults, and advanced options) using DOM IDs and input state.
 *
 * Public API:
 *  - None — runs on load only (DOMContentLoaded) and attaches internal event listeners.
 *
 * Inputs:
 *  - DOM IDs expected (IMPORTANT: all IDs listed below are the <input> elements’ IDs,
 *    not the label/div wrapper IDs. Wrapper DIVs are listed separately and are manipulated directly.)
 *
 *  Blockers (DIVs):
 *    - blocker_b, blocker_c
 *
 *  Section A (Location radios — INPUT ids):
 *    - loc_interior_radio, loc_exterior_radio
 *
 *  Section B (Starting point radios — INPUT ids):
 *    - sp_rough_radio, sp_drywall_radio, sp_co_radio
 *
 *  Section C (Output type radios — INPUT ids; out_door_radio & out_co_radio are in the same radio group):
 *    - out_door_radio, out_co_radio
 *
 *  Section C (Door controls — INPUT ids):
 *    - dht_standard_radio
 *    - dwho_system_decides_radio, dwho_user_decides_radio
 *    - dws_unit_dim_radio, dws_slab_dim_radio
 *
 *  Section C (CO controls — INPUT ids):
 *    - cwho_system_decides_radio, cwho_user_decides_radio
 *
 *  Section C (Advanced controls — INPUT ids):
 *    - advanced_check_box
 *    - specify_side_gaps_check_box, specify_top_gap_check_box
 *
 *  Wrapper DIVs controlled by this script (DIV ids):
 *    - door_detail_wrapper
 *    - door_width_scope_wrapper, door_width_msmt_wrapper
 *    - co_detail_wrapper, co_width_msmt_wrapper
 *    - gap_wrapper_div (parent of specify checkboxes + measurement inputs)
 *    - side_gap_msmt_wrapper, top_gap_msmt_wrapper
 *
 *  Door width selects (SELECT ids inside door_width_msmt_wrapper):
 *    - door_width_inch, door_width_frac
 *
 * Outputs:
 *  - DOM changes:
 *    - Toggles blockers: blocker_b / blocker_c display (block/unblock sections B and C).
 *    - Shows/hides multiple wrapper DIVs based on rules (door vs CO, advanced options).
 *    - Shows/hides specific Starting Point inputs (sp_drywall_radio, sp_co_radio) in Exterior mode by hiding the
 *      Webflow wrapper element that contains the input.
 *
 *  - Input state changes:
 *    - Programmatically checks/unchecks radios/checkboxes to enforce defaults and rule transitions.
 *    - Dispatches input/change events when using setChecked() so Webflow + other listeners stay consistent.
 *
 * Side effects:
 *  - No network calls.
 *  - No localStorage/cookies.
 *  - Uses requestAnimationFrame (double tick) on load to avoid Webflow initialization timing/race issues.
 *
 * Load order:
 *  - Must load AFTER Webflow has rendered the form DOM (recommended: place at end of body or load with `defer`).
 *  - This script waits for DOMContentLoaded, but the DOM must include the expected IDs at that time.
 *
 * Failure mode (missing elements / ID drift):
 *  - If any REQUIRED element IDs are missing at boot, the script logs a clear error with the missing IDs and
 *    DISABLES itself (no event listeners attached; no DOM mutations performed).
 *  - Optional elements may be absent; those operations fail soft (no throw).
 *
 * Webflow redirected UI note (actionable):
 *  - Webflow often hides the native input and renders a “redirected” UI span.
 *  - Selection strategy:
 *      Find the <span class="w-radio-input"> or <span class="w-checkbox-input">
 *      inside the SAME <label> that contains the target <input>.
 *  - Source of truth:
 *      The truth is input.checked. The span class `w--redirected-checked` is treated as derived UI state
 *      and is kept in sync from input.checked (we do not trust the span as the source of truth).
 *
 * Rule summary (high level):
 *  - Page load:
 *      No radios selected in A/B; blocker_b and blocker_c engaged; Section C master reset applied.
 *  - Location gating:
 *      Interior -> unblock B; keep C blocked until a Starting Point is selected.
 *      Exterior -> unblock B & C; force sp_rough selected; hide sp_drywall + sp_co options.
 *  - Starting Point:
 *      Selecting any starting point triggers a full Section C master reset and unblocks C.
 *  - Door vs CO (OUT group):
 *      OUT=CO -> show CO detail (if advanced checked); hide door detail & door width controls; force cwho_system_decides.
 *      OUT=DOOR -> show door detail (if advanced checked); hide CO detail.
 *      Switching OUT from CO -> DOOR -> performs a FULL Section C reset.
 *  - Door width logic:
 *      dwho_system_decides -> hide door width scope + msmt; clear dws radios; reset door width selects.
 *      dwho_user_decides -> show scope; reveal msmt only if dws_* chosen.
 *      dws_slab_dim -> filter door_width_inch to standard slab widths (24,28,30,32,36,48,56,60,64,72);
 *                      set door_width_frac to 0 and hide it.
 *      dws_unit_dim -> restore all original door_width_inch options; show door_width_frac.
 *      Any higher-tier reset (Section C reset, CO mode, system-decides) restores clean initial state.
 *  - Advanced:
 *      advanced_check_box gates visibility of door_detail_wrapper, co_detail_wrapper,
 *      and gap_wrapper_div (which contains the specify-gaps checkboxes and measurement inputs).
 *      Door/CO detail wrappers require BOTH the corresponding radio AND advanced checked.
 *      Unchecking advanced triggers a full Section C master reset (resetSectionC).
 *      gap_wrapper_div is shown/hidden as a unit; within it:
 *        specify_side_gaps_check_box toggles side_gap_msmt_wrapper.
 *        specify_top_gap_check_box toggles top_gap_msmt_wrapper.
 *
 * Version notes:
 *  - v10+: Includes Webflow redirected UI sync, advanced measurement reveal, and CO->Door full reset.
 */

(() => {
  "use strict";

  const IDS = {
    // Blockers (DIVs)
    blockerB: "blocker_b",
    blockerC: "blocker_c",

    // Section A (Location radios - INPUT ids)
    locInterior: "loc_interior_radio",
    locExterior: "loc_exterior_radio",

    // Section B (Starting point radios - INPUT ids)
    spRough: "sp_rough_radio",
    spDrywall: "sp_drywall_radio",
    spCO: "sp_co_radio",

    // Section C: OUT group (INPUT ids; same radio group)
    outDoor: "out_door_radio",
    outCO: "out_co_radio",

    // Section C: Door controls (INPUT ids)
    dhtStandard: "dht_standard_radio",
    dwhoSystemDecides: "dwho_system_decides_radio",
    dwhoUserDecides: "dwho_user_decides_radio",
    dwsUnitDim: "dws_unit_dim_radio",
    dwsSlabDim: "dws_slab_dim_radio",

    // Section C: CO controls (INPUT ids)
    cwhoSystemDecides: "cwho_system_decides_radio",
    cwhoUserDecide: "cwho_user_decides_radio",

    // Section C: Advanced controls (INPUT ids)
    advanced: "advanced_check_box",
    specifySideGaps: "specify_side_gaps_check_box",
    specifyTopGap: "specify_top_gap_check_box",

    // Wrapper DIVs (DIV ids)
    divDoorDetail: "door_detail_wrapper",
    divDoorWidthScope: "door_width_scope_wrapper",
    divDoorWidthMsmt: "door_width_msmt_wrapper",

    divCoDetail: "co_detail_wrapper",
    divCoWidthMsmt: "co_width_msmt_wrapper",

    divGapWrapper: "gap_wrapper_div",
    divSideGapMsmt: "side_gap_msmt_wrapper",
    divTopGapMsmt: "top_gap_msmt_wrapper",

    // Door width selects (SELECT ids inside door_width_msmt_wrapper)
    doorWidthInch: "door_width_inch",
    doorWidthFrac: "door_width_frac",
  };

  // ---- Required IDs at boot (contract) ----
  // Note: if you intentionally remove any of these in Webflow, update this list.
  const REQUIRED_IDS = [
    IDS.blockerB,
    IDS.blockerC,

    IDS.locInterior,
    IDS.locExterior,

    IDS.spRough,
    IDS.spDrywall,
    IDS.spCO,

    IDS.outDoor,
    IDS.outCO,

    IDS.dhtStandard,
    IDS.dwhoSystemDecides,
    IDS.dwhoUserDecides,
    IDS.dwsUnitDim,
    IDS.dwsSlabDim,

    IDS.cwhoSystemDecides,
    IDS.cwhoUserDecide,

    IDS.advanced,
    IDS.specifySideGaps,
    IDS.specifyTopGap,

    IDS.divDoorDetail,
    IDS.divDoorWidthScope,
    IDS.divDoorWidthMsmt,
    IDS.divCoDetail,
    IDS.divCoWidthMsmt,
    IDS.divGapWrapper,
    IDS.divSideGapMsmt,
    IDS.divTopGapMsmt,
  ];

  const byId = (id) => document.getElementById(id);

  const validateRequiredIdsOrDisable = () => {
    const missing = REQUIRED_IDS.filter((id) => !byId(id));
    if (missing.length === 0) return true;

    console.error(
      "[calc-query] Disabled: missing required element IDs. Fix Webflow IDs or update calc-query.js REQUIRED_IDS.\nMissing:",
      missing
    );
    return false;
  };

  // ---- Webflow redirected UI sync helpers ----
  const getWebflowMirrorEl = (inputEl) => {
    if (!inputEl) return null;

    // Selection strategy: find the <span.w-*-input> inside the same <label> as the input.
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

  // Use for programmatic state changes where we want Webflow + any other listeners to react
  const setChecked = (id, checked) => {
    const el = byId(id);
    if (!el) return;

    const next = !!checked;
    if (el.checked === next) {
      syncWebflowMirror(el);
      return;
    }

    // Source of truth: input.checked
    el.checked = next;
    syncWebflowMirror(el);
    dispatchValueEvents(el);
  };

  // Use for “force set” without re-entrant render loops
  const hardUncheck = (id) => {
    const el = byId(id);
    if (!el) return;
    el.checked = false;
    syncWebflowMirror(el);
  };

  const hardCheck = (id) => {
    const el = byId(id);
    if (!el) return;
    el.checked = true;
    syncWebflowMirror(el);
  };

  const hardUncheckMany = (ids) => ids.forEach(hardUncheck);
  const hardCheckMany = (ids) => ids.forEach(hardCheck);

  const uncheckMany = (ids) => ids.forEach((id) => setChecked(id, false));

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

  // In Webflow, the clickable UI is often a wrapper (.w-radio / .w-checkbox).
  // We hide/show the wrapper so the whole row disappears.
  const findInputWrapper = (inputEl) => {
    if (!inputEl) return null;

    const webflowWrapper = inputEl.closest(".w-radio, .w-checkbox");
    if (webflowWrapper) return webflowWrapper;

    // Fallbacks for nonstandard markup:
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
  let lastOutMode = null; // "door" | "co" | null
  let lastAdvancedState = false; // tracks advanced checkbox for transition detection
  let doorWidthInchOriginalOptions = null; // snapshot of original <option> elements, set at boot

  // ---------------------------
  // RESET SECTION C
  // ---------------------------
  const resetSectionC = () => {
    // Clear door who decides before re-defaulting (hardCheck does not auto-uncheck sibling radios)
    hardUncheckMany([IDS.dwhoSystemDecides, IDS.dwhoUserDecides]);

    // Defaults: OUT=door, standard door height, door who decides=system
    hardCheckMany([IDS.outDoor, IDS.dhtStandard, IDS.dwhoSystemDecides]);

    // Clear CO who decides
    hardUncheck(IDS.cwhoSystemDecides);
    hardUncheck(IDS.cwhoUserDecide);

    // Clear door width scope radios
    hardUncheckMany([IDS.dwsUnitDim, IDS.dwsSlabDim]);

    // Advanced defaults: off
    hardUncheckMany([IDS.advanced, IDS.specifySideGaps, IDS.specifyTopGap]);

    // Visibility defaults (per spec)
    [
      IDS.divDoorDetail,
      IDS.divDoorWidthScope,
      IDS.divDoorWidthMsmt,
      IDS.divCoDetail,
      IDS.divCoWidthMsmt,
      IDS.divGapWrapper,
      IDS.divSideGapMsmt,
      IDS.divTopGapMsmt,
    ].forEach(hideDiv);

    // Restore door width selects to clean initial state
    resetDoorWidthSelects();

    lastDwhoMode = null;
    lastOutMode = null;
    lastAdvancedState = false;
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

  // ---------------------------
  // DOOR WIDTH SELECT HELPERS
  // ---------------------------
  const SLAB_WIDTHS = new Set(["24","28","30","32","36","48","56","60","64","72"]);

  /** Restore door width selects to their clean initial state. */
  const resetDoorWidthSelects = () => {
    const inchSel = byId(IDS.doorWidthInch);
    const fracSel = byId(IDS.doorWidthFrac);

    if (inchSel && doorWidthInchOriginalOptions) {
      inchSel.innerHTML = "";
      doorWidthInchOriginalOptions.forEach(o => inchSel.appendChild(o.cloneNode(true)));
    }

    if (fracSel) {
      fracSel.value = "0";
      fracSel.style.display = "";
    }
  };

  /** Filter door_width_inch to slab-only values and hide frac. */
  const applySlabWidthFilter = () => {
    const inchSel = byId(IDS.doorWidthInch);
    const fracSel = byId(IDS.doorWidthFrac);

    if (inchSel && doorWidthInchOriginalOptions) {
      inchSel.innerHTML = "";
      doorWidthInchOriginalOptions
        .filter(o => SLAB_WIDTHS.has(o.value))
        .forEach(o => inchSel.appendChild(o.cloneNode(true)));
    }

    if (fracSel) {
      fracSel.value = "0";
      fracSel.style.display = "none";
    }
  };

  const applyDoorRules = () => {
    if (!isChecked(IDS.outDoor)) return;

    const mode = currentDwhoMode();

    if (mode === "system") {
      hideDiv(IDS.divDoorWidthScope);
      hideDiv(IDS.divDoorWidthMsmt);
      hardUncheckMany([IDS.dwsUnitDim, IDS.dwsSlabDim]);
      resetDoorWidthSelects();
      lastDwhoMode = mode;
      return;
    }

    if (mode === "user") {
      showDiv(IDS.divDoorWidthScope, "");

      // Only clear/hide once when switching into user mode
      if (lastDwhoMode !== "user") {
        hardUncheckMany([IDS.dwsUnitDim, IDS.dwsSlabDim]);
        hideDiv(IDS.divDoorWidthMsmt);
      }

      // Reveal msmt if a scope choice is selected
      if (isChecked(IDS.dwsUnitDim) || isChecked(IDS.dwsSlabDim)) {
        showDiv(IDS.divDoorWidthMsmt, "");

        // Slab dim: filter to standard slab widths, hide frac
        // Unit dim: restore all options, show frac
        if (isChecked(IDS.dwsSlabDim)) {
          applySlabWidthFilter();
        } else {
          resetDoorWidthSelects();
        }
      }

      lastDwhoMode = mode;
      return;
    }

    lastDwhoMode = mode;
  };

  const applyCoRules = () => {
    if (!isChecked(IDS.outCO)) return;

    // On entering CO mode, force door-related items off and CO who decides on
    if (lastOutMode !== "co") {
      hardUncheckMany([
        IDS.dhtStandard,
        IDS.dwhoSystemDecides,
        IDS.dwhoUserDecides,
        IDS.dwsUnitDim,
        IDS.dwsSlabDim,
      ]);

      hardCheck(IDS.cwhoSystemDecides);
      lastDwhoMode = null;
    }

    // Always enforce CO visibility state
    hideDiv(IDS.divDoorDetail);
    hideDiv(IDS.divDoorWidthScope);
    hideDiv(IDS.divDoorWidthMsmt);
    resetDoorWidthSelects();

    if (isChecked(IDS.advanced)) showDiv(IDS.divCoDetail, "");
    else hideDiv(IDS.divCoDetail);

    // CO width measurement depends on CO who decides
    if (isChecked(IDS.cwhoUserDecide)) showDiv(IDS.divCoWidthMsmt, "");
    else hideDiv(IDS.divCoWidthMsmt);
  };

  const applyOutModeRules = () => {
    const outMode = currentOutMode();

    // If switching from CO -> DOOR, do a full Section C reset
    if (outMode === "door" && lastOutMode === "co") {
      resetSectionC();
      return;
    }

    if (outMode === "door") {
      if (isChecked(IDS.advanced)) showDiv(IDS.divDoorDetail, "");
      else hideDiv(IDS.divDoorDetail);
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
      // Show the gap wrapper (contains specify checkboxes + measurement inputs)
      showDiv(IDS.divGapWrapper, "");

      // Show/hide measurements based on the specify checkboxes
      if (isChecked(IDS.specifySideGaps)) showDiv(IDS.divSideGapMsmt, "");
      else hideDiv(IDS.divSideGapMsmt);

      if (isChecked(IDS.specifyTopGap)) showDiv(IDS.divTopGapMsmt, "");
      else hideDiv(IDS.divTopGapMsmt);

      // Show door/CO detail based on current radio selection
      if (isChecked(IDS.outDoor)) {
        showDiv(IDS.divDoorDetail, "");
        hideDiv(IDS.divCoDetail);
      } else if (isChecked(IDS.outCO)) {
        showDiv(IDS.divCoDetail, "");
        hideDiv(IDS.divDoorDetail);
      }

      lastAdvancedState = true;
      return;
    }

    // Only reset Section C on checked → unchecked transition
    if (lastAdvancedState) {
      resetSectionC();
    }

    lastAdvancedState = false;
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

    // No location selected: block B and C
    if (!interior && !exterior) {
      setBlocker(IDS.blockerB, true);
      setBlocker(IDS.blockerC, true);

      showInputRow(IDS.spRough);
      showInputRow(IDS.spDrywall);
      showInputRow(IDS.spCO);

      // Still enforce C rule visuals if something is prechecked by Webflow
      applyOutModeRules();
      applyAdvancedRules();
      return;
    }

    // Interior: B unblocked; C blocked until a starting point is selected
    if (interior) {
      setBlocker(IDS.blockerB, false);
      setBlocker(IDS.blockerC, !hasStartingPoint());

      showInputRow(IDS.spRough);
      showInputRow(IDS.spDrywall);
      showInputRow(IDS.spCO);
    }

    // Exterior: B and C unblocked; force starting point = rough; hide drywall & CO inputs in B
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
    // Per spec: selecting a location resets B and performs master reset on C
    uncheckMany([IDS.spRough, IDS.spDrywall, IDS.spCO]);
    showInputRow(IDS.spRough);
    showInputRow(IDS.spDrywall);
    showInputRow(IDS.spCO);

    resetSectionC();
    render();
  };

  const onStartingPointChange = () => {
    // Per spec: any starting point selection triggers master reset on C
    resetSectionC();
    render();
  };

  const onSectionCChange = () => {
    render();
  };

  const wire = () => {
    // A
    [IDS.locInterior, IDS.locExterior].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener("change", onLocationChange);
    });

    // B
    [IDS.spRough, IDS.spDrywall, IDS.spCO].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener("change", onStartingPointChange);
    });

    // C (door/co + advanced)
    [
      IDS.outDoor,
      IDS.outCO,
      IDS.dhtStandard,
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
    if (!validateRequiredIdsOrDisable()) return;

    // Snapshot original door_width_inch options before any filtering
    const inchSelect = byId(IDS.doorWidthInch);
    if (inchSelect) {
      doorWidthInchOriginalOptions = Array.from(inchSelect.options).map(o => o.cloneNode(true));
    }

    // Defaults on load: B and C blocked; C master reset
    setBlocker(IDS.blockerB, true);
    setBlocker(IDS.blockerC, true);

    // Let Webflow finish initializing “redirected” inputs, then reset+render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resetSectionC();
        render();
      });
    });

    wire();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();