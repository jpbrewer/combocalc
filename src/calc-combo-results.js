/**
 * File: 
 *  calc-combo-results.js
 *
 * Role:
 * ORCHESTRATOR
 *
 * Purpose:
 *  - Intercepts a Webflow form submit, posts the form payload to a request API, then polls a retrieval API until results are ready or a timeout occurs.
 *  - Normalizes the returned solutions into a global store (window.comboSolutions) and renders a Webflow-built “solutions listing” UI from a template card.
 *  - Manages modal open/close behavior and wires each Explore button to open the modal and invoke build_assembly_svg(index).
 *
 * Context:
 *  - Runs in-browser as a single drop-in <script> embedded in Webflow (no bundler/modules).
 *  - Exists because Webflow’s native form submission + conditional UI logic is insufficient for async “request → poll → render” workflows.
 *  - Uses a hidden “icon registry” (Webflow Assets) to map logical icon filenames (e.g., /icons/arrangement_14_icon.png) to Webflow-hosted asset URLs.
 *
 * Source of truth:
 *  - Authoritative state:
 *    - window.comboSolutions: normalized array of solution objects used for rendering and Explore actions.
 *    - window.job_id: numeric job id returned by request endpoint; used for polling retrieval endpoint.
 *    - DOM dataset on Explore buttons (data-solution-index via element.dataset.solutionIndex): index pointer into window.comboSolutions.
 *  - Derived/synced state:
 *    - Rendered solution cards/rows are derived from window.comboSolutions[*].solution_grid.
 *    - Icon <img src> is derived from solution.icon + ICON_MAP lookup (from #icon_registry).
 *    - Submit button label/disabled/greyed style is derived from request/poll lifecycle.
 *
 * Inputs (reads):
 *
 *  DOM Contract:
 *  - IDs (these are element IDs on wrappers/buttons/divs):
 *    - #wf_form_combo            (the <form> element)
 *    - #submit_query            (the submit button; code falls back to form querySelector if not found)
 *    - #search_again            (“Search Again” button; click triggers resetUI)
 *    - #solutions_area          (wrapper around the solutions UI; hidden until poll success)
 *    - #blocker_form            (overlay “blocker” for the form; shown after poll success, hidden on reset)
 *    - #icon_registry           (hidden container; contains <img data-icon-name="..."> entries mapping filenames → asset URLs)
 *    - #modal-overlay           (modal overlay; display:flex to show; display:none to hide)
 *    - #modal-panel             (modal content panel; clicks inside should not close modal)
 *    - #modal-close             (close button; closes modal)
 *    - #no-muntin              (text block; muntin toggle "off" — default active on modal open)
 *    - #yes-muntin             (text block; muntin toggle "on" — shows actual rows/cols muntins)
 *    - #hardware_wrapper_div   (div; hardware controls wrapper — hidden by default; shown (display:flex) when solution has any door)
 *    - #choose-door-bore       (div; door bore chooser wrapper — hidden by default; shown when solution has single door)
 *    - #door-bore-left         (clickable element; selects left-side bore)
 *    - #door-bore-right        (clickable element; selects right-side bore — default active)
 *  - Selectors / structural assumptions (inferred from code):
 *    - .solutions-list                  (container list where solution cards are appended)
 *    - [data-solution-card=”template”]  (template “solution card” to clone per solution)
 *    - Within each cloned card:
 *      - [data-solution-row=”template”] (template row for solution_grid positions to clone)
 *      - [data-solution-summary=”row”]  (summary row that contains [data-field=”summary”])
 *      - [data-solution-explore=”btn”]  (Explore button; dynamically wired and indexed)
 *      - [data-solution-icon=”img”]     (icon wrapper; must contain <img data-field=”icon”>)
 *    - Modal data grid (inside #modal-panel, after #explore):
 *      - [data-modal-summary=”section”] (opening summary block; contains data-field opening_width/opening_height/jamb_depth)
 *      - [data-modal-grid=”section”]    (solution grid container)
 *      - [data-modal-icon=”img”]        (icon wrapper; must contain <img data-field=”icon”>)
 *      - [data-modal-row=”template”]    (row template; cloned per position key)
 *      - [data-modal-notes=”row”]       (notes row; contains [data-field=”notes”])
 *      - [data-modal-configure=”btn”]   (“Configure and Buy” button; not wired by this file)
 *  - ID semantics clarity:
 *    - All IDs referenced above are element IDs on the actual DOM nodes (not label wrappers for inputs).
 *    - This file does not read individual form input IDs; it relies on FormData(form) to collect values.
 *
 *  Data Contract:
 *  - Request endpoint:
 *    - POSTs application/x-www-form-urlencoded (URLSearchParams/FormData entries) to REQUEST_ENDPOINT_URL
 *    - Expects a “job id” response (number or JSON containing job_id / unix / jobId or similar).
 *  - Retrieval endpoint:
 *    - POSTs application/x-www-form-urlencoded with { job_id }
 *    - Returns either:
 *      - "not_ready" (string) OR an object with status/state "not_ready" (inferred), OR
 *      - a solutions payload (array or object containing a solutions array)
 *  - Solutions payload (inferred from normalization/rendering):
 *    - Response root may contain:
 *      - opening_width (number), opening_height (number), jamb_depth (number)
 *      - unit_width (number), unit_height (number) — decimal inches for dimension annotations
 *    - Each solution object may contain:
 *      - assembly_template (string)
 *      - assembly_no or arrangement_no (number/string)
 *      - icon (string: filename, relative path, or absolute URL)
 *      - solution_grid (object) containing:
 *        - unit_notes (string) unit dimension text; rendered above position rows
 *        - solution_notes (string) gap/planning info; rendered below position rows
 *        - position keys (all optional): pos2, pos1, pos3, pos13, pos5, pos4, pos6, pos46, each containing:
 *          - row, building_block, order_dims, quantity, line_notes
 *      - build_object_specs (object) (new name; may fall back from build_objects)
 *      - solution_svg (string; optional)
 *      - meta (object; optional)
 *      - opening_width, opening_height, jamb_depth (optional; per-solution override of root values)
 *      - unit_width, unit_height (optional; decimal inches; used for SVG dimension annotations)
 *      - door_bore ("left" | "right" | null; which stile gets the bore hole; defaults per assembly template's door_bore value)
 *      - hardware_color (string | null; hardware color name e.g. "Chrome"; defaults to "Chrome" for solutions with doors)
 *  - Required external function (called on Explore click):
 *    - window.build_assembly_svg(index) must exist for rendering; if missing, current behavior logs a warning and continues.
 *
 *  Runtime Assumptions:
 *  - Runs after DOMContentLoaded; listeners are attached in init().
 *  - Webflow’s base DOM (template elements, modal elements, form wrapper) already exists by the time DOMContentLoaded fires.
 *  - Webflow Interactions (IX) may attach triggers via data-w-id; this script strips data-w-id from cloned content (and Explore btn) to avoid Webflow trigger errors.
 *  - NOTE: This file does NOT appear to explicitly manage Webflow “redirected” form controls
 *    (span.w-radio-input / span.w-checkbox-input / w--redirected-checked) — inferred absent because no such selectors/classes are referenced.
 *
 * Outputs (produces):
 *
 *  Public API:
 *  - window.job_id              (Number; assigned after initial request)
 *  - window.comboSolutions      (Array<Solution>; assigned after successful retrieval)
 *  - No additional window.* functions are defined here.
 *  - Calls (requires) window.build_assembly_svg(index, muntins) on Explore click (muntins=false by default).
 *  - Muntin toggle: #no-muntin / #yes-muntin click handlers call build_assembly_svg with muntins false/true.
 *    CSS class "muntin-selection-active" is toggled on the active button.
 *  - Door bore toggle: #door-bore-left / #door-bore-right click handlers update solution.door_bore,
 *    invalidate assembly caches, and call window.updateBoreVisibility(side) + window.updateHingeVisibility()
 *    for instant DOM toggle. CSS class "door-selection-active" is toggled on the active button.
 *    #choose-door-bore is shown (display:flex) only when the solution has a single_door build_object.
 *    Also updates line_notes labels in the modal grid (Left-Hand ↔ Right-Hand).
 *  - Hardware color selector: a <select> populated from window.HARDWARE_COLORS is created inside
 *    #hardware-selector. On change, updates solution.hardware_color and calls window.updateHingeColor(hex).
 *    #hardware-color-wrapper is shown (display:flex) when solution has any door (single or double).
 *
 *  DOM Mutations:
 *  - Shows/hides:
 *    - #solutions_area: display none → shown on success; hidden on reset/failure
 *    - #blocker_form: display block on success; display none on reset/failure/load
 *    - Webflow success/fail panels inside the form wrapper (.w-form-done / .w-form-fail):
 *      - success shown on poll success; fail shown on errors (inferred behavior)
 *  - Updates:
 *    - Submit button text transitions + disabled state + greying on success
 *    - Solutions list is re-rendered by:
 *      - removing existing non-template cards
 *      - cloning template card per solution
 *      - cloning row template per position key in POS_ORDER
 *      - populating [data-field="..."] nodes with solution_grid values
 *      - line_notes "XX" marker replaced: "Single-Hung"/"Double-Hung" in listing cards,
 *        "Left-Hand"/"Right-Hand" in modal (toggles with bore side)
 *      - cloning summary row for unit_notes (above position rows) and solution_notes (below)
 *      - setting icon <img data-field="icon"> src via ICON_MAP (or fallback resolution)
 *    - Modal overlay display toggled by openModal/closeModal.
 *    - Modal data grid:
 *      - populateModalGrid(idx) populates [data-modal-summary], sets icon via [data-modal-icon],
 *        clones [data-modal-notes] for unit_notes (top) and solution_notes (bottom) around position rows.
 *      - closeModal() clears cloned modal grid rows ([data-pos] and [data-unit-notes]) to prevent stale data.
 *
 *  Data Produced:
 *  - Normalized solution objects stored in window.comboSolutions:
 *    - { index, job_id, assembly_template, assembly_no, icon, solution_grid, build_object_specs, solution_svg, meta, opening_width, opening_height, jamb_depth, door_bore }
 *  - ICON_MAP (internal) created from #icon_registry: filename → Webflow asset URL.
 *
 * Load Order / Dependencies:
 *  - Must run after the Webflow page DOM exists (uses DOMContentLoaded).
 *  - Must run on pages that include:
 *    - the form (#wf_form_combo), solutions template structure, and modal structure.
 *  - build_assembly_svg(index) should be loaded before any Explore click occurs (can load after this file).
 *  - Icon registry (#icon_registry) must exist before init() for mapping; if missing, icons fall back to origin-relative/absolute URLs (may 404 on Webflow).
 *  - Runs automatically on load; no explicit init call required.
 *
 * Side Effects:
 *  - Network calls (fetch/polling): Yes
 *    - POST to REQUEST_ENDPOINT_URL once per submit
 *    - POST to RETRIEVAL_ENDPOINT_URL up to MAX_POLLS times with POLL_INTERVAL_MS delays
 *  - localStorage/cookies: No (none present)
 *  - Timers / intervals / requestAnimationFrame: Yes
 *    - Uses sleep() (setTimeout via Promise) between polls; no setInterval used
 *  - Event listeners added:
 *    - document: click (capture) for Explore buttons
 *    - document: keydown for Escape-to-close modal
 *    - modal overlay: click to close when target is overlay
 *    - modal close button: click to close
 *    - modal panel: click stopPropagation (prevents overlay-close)
 *    - form: submit (capture) to prevent default Webflow submit and run async flow
 *    - search_again button: click to reset UI
 *
 * Failure Behavior:
 *  - Missing DOM elements:
 *    - Many selectors are optional; missing elements typically cause the related feature to no-op.
 *    - Critical missing elements (solutions list/template) will throw during populateSolutionsFromStore() (inferred).
 *  - Missing/invalid job_id response:
 *    - Throws error “Invalid job_id returned.” and restores submit button; shows Webflow fail panel (inferred).
 *  - Poll timeout:
 *    - Throws “Polling timed out…”; restores submit button; shows fail panel (inferred).
 *  - Missing build_assembly_svg:
 *    - Explore click opens modal, then logs a warning and does not render (current behavior).
 *  - Recommended fail-soft behavior (non-runtime change suggestion):
 *    - Prefer console.error + return early when template/list are missing rather than throwing, if later refactoring.
 *
 * Rule Summary / Invariants:
 *  - Form is always visible; submission is intercepted (preventDefault) so only this script posts.
 *  - Solutions are only displayed after a successful poll response; #solutions_area remains hidden otherwise.
 *  - #blocker_form must be visible only when results are present; reset hides it.
 *  - Explore buttons must carry a valid dataset.solutionIndex pointing into window.comboSolutions.
 *  - POS_ORDER determines row render order; absent pos keys are skipped without errors.
 *  - Template elements are never removed; clones are appended and then cleaned on reset/new render.
 *
 * Version Notes:
 *  - v0 (inferred): Implements request→poll→render pipeline with timeout.
 *  - Adds window.comboSolutions global store (normalized) + Explore button indexing.
 *  - Adds modal open/close controls + Explore wiring; calls build_assembly_svg(index) after opening modal.
 *  - Adds Webflow asset icon mapping via #icon_registry to resolve logical filenames.
 *  - Adds form blocker overlay (#blocker_form) shown on success and removed on reset.
 *  - Adds decimalToFraction() helper to format decimal inches as fractional (e.g., 60.25 → 60-1/4").
 *
 */
 
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
  const NO_MUNTIN_ID = "no-muntin";
  const YES_MUNTIN_ID = "yes-muntin";
  const MUNTIN_ACTIVE_CLASS = "muntin-selection-active";

  const CHOOSE_DOOR_BORE_ID = "choose-door-bore";
  const DOOR_BORE_LEFT_ID = "door-bore-left";
  const DOOR_BORE_RIGHT_ID = "door-bore-right";
  const DOOR_BORE_ACTIVE_CLASS = "door-selection-active";

  const HARDWARE_WRAPPER_DIV_ID = "hardware_wrapper_div";
  const HARDWARE_COLOR_WRAPPER_ID = "hardware-color-wrapper";
  const HARDWARE_SELECTOR_ID = "hardware-selector";
  const DBL_DOOR_WRAPPER_ID = "dbl-door-wrapper";

  var currentModalIndex = null;
  var currentMuntinState = false;
  var currentDoorBore = "right";

  const REQUEST_ENDPOINT_URL =
    "https://api.transomsdirect.com/api:xyi0dc0X/bc_combo_solution_request";
  const RETRIEVAL_ENDPOINT_URL =
    "https://api.transomsdirect.com/api:xyi0dc0X/combo_unit_solution_retrieval";

  const POLL_INTERVAL_MS = 2000;
  const MAX_POLLS = 40;

  const TEMPLATE_CARD_SELECTOR = '[data-solution-card="template"]';
  const LIST_SELECTOR = ".solutions-list";
  const ROW_TEMPLATE_SELECTOR = '[data-solution-row="template"]';
  // Display-order for solution_grid row keys.
  // Xano may return grouped keys (pos13, pos46) or individual keys (pos1, pos3, etc.)
  // depending on the assembly template.  List every known key so none are skipped.
  const POS_ORDER = [
    "pos2",   // door / cased opening (always present)
    "pos1",   // left sidelite (when not grouped)
    "pos3",   // right sidelite (when not grouped)
    "pos13",  // sidelites combined
    "pos5",   // transom
    "pos4",   // mullion / intermediate element
    "pos6",   // second transom
    "pos46",  // transoms combined
  ];

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
    document.body.style.overflow = "hidden";
  }
  function resetHardwareColorToChrome() {
    // Reset solution object if one is active
    if (currentModalIndex !== null && window.comboSolutions) {
      var solution = window.comboSolutions[currentModalIndex];
      if (solution) {
        solution.hardware_color = "Chrome";
        solution.assembly_svg = null;
        solution.assembly_svg_no_muntins = null;
      }
    }
    // Reset the on-screen selector
    var sel = document.getElementById("hardware-color-select");
    if (sel) sel.value = "Chrome";
  }

  function closeModal() {
    resetHardwareColorToChrome();
    var dblWrapper = document.getElementById(DBL_DOOR_WRAPPER_ID);
    if (dblWrapper) dblWrapper.style.display = "none";
    const overlay = document.getElementById(MODAL_OVERLAY_ID);
    if (overlay) overlay.style.display = "none";
    document.body.style.overflow = "";
    clearModalGridRows();
    currentModalIndex = null;
    currentMuntinState = false;
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

      // Track which solution is in the modal and reset muntin toggle
      currentModalIndex = idx;
      setMuntinToggleState(false);

      // Configure door bore chooser and hardware color selector
      var solution = window.comboSolutions[idx];
      configureDoorBoreForModal(solution);
      configureHardwareWrapperForModal(solution);
      configureHardwareColorForModal(solution);
      configureDblDoorWrapperForModal(solution);

      if (typeof window.build_assembly_svg !== "function") {
        console.warn("build_assembly_svg(index) is not defined yet.");
        return;
      }
      try {
        window.build_assembly_svg(idx, false);
      } catch (err) {
        console.error("build_assembly_svg failed:", err);
      }

      // Set bore and hinge visibility on the mounted SVG
      if (solution && typeof window.updateBoreVisibility === "function") {
        window.updateBoreVisibility(solution.door_bore || "right");
      }
      if (solution && typeof window.updateHingeVisibility === "function") {
        var doorType = solutionHasDoubleDoor(solution) ? "double_door"
                     : solutionHasSingleDoor(solution) ? "single_door" : null;
        if (doorType) {
          window.updateHingeVisibility(doorType, solution.door_bore || "right");
        }
      }

      // Populate modal data grid (fail-soft)
      try {
        populateModalGrid(idx);
      } catch (err) {
        console.warn("populateModalGrid failed:", err);
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
  // MUNTIN TOGGLE
  // =========================================
  function setMuntinToggleState(showMuntins) {
    currentMuntinState = showMuntins;
    var noBtn = document.getElementById(NO_MUNTIN_ID);
    var yesBtn = document.getElementById(YES_MUNTIN_ID);

    if (noBtn) {
      if (!showMuntins) noBtn.classList.add(MUNTIN_ACTIVE_CLASS);
      else noBtn.classList.remove(MUNTIN_ACTIVE_CLASS);
    }
    if (yesBtn) {
      if (showMuntins) yesBtn.classList.add(MUNTIN_ACTIVE_CLASS);
      else yesBtn.classList.remove(MUNTIN_ACTIVE_CLASS);
    }
  }

  function renderMuntinVersion(showMuntins) {
    if (currentModalIndex === null) return;
    if (typeof window.build_assembly_svg !== "function") {
      console.warn("build_assembly_svg not available for muntin toggle.");
      return;
    }
    try {
      window.build_assembly_svg(currentModalIndex, showMuntins);
    } catch (err) {
      console.error("Muntin toggle render failed:", err);
    }
  }

  function initMuntinToggle() {
    var noBtn = document.getElementById(NO_MUNTIN_ID);
    var yesBtn = document.getElementById(YES_MUNTIN_ID);

    if (noBtn) {
      noBtn.addEventListener("click", function(e) {
        e.preventDefault();
        if (!currentMuntinState) return;
        setMuntinToggleState(false);
        renderMuntinVersion(false);
      });
    }

    if (yesBtn) {
      yesBtn.addEventListener("click", function(e) {
        e.preventDefault();
        if (currentMuntinState) return;
        setMuntinToggleState(true);
        renderMuntinVersion(true);
      });
    }
  }

  // =========================================
  // DOOR BORE TOGGLE
  // =========================================
  function setDoorBoreToggleState(side) {
    currentDoorBore = side;
    var leftBtn = document.getElementById(DOOR_BORE_LEFT_ID);
    var rightBtn = document.getElementById(DOOR_BORE_RIGHT_ID);

    if (leftBtn) {
      if (side === "left") leftBtn.classList.add(DOOR_BORE_ACTIVE_CLASS);
      else leftBtn.classList.remove(DOOR_BORE_ACTIVE_CLASS);
    }
    if (rightBtn) {
      if (side === "right") rightBtn.classList.add(DOOR_BORE_ACTIVE_CLASS);
      else rightBtn.classList.remove(DOOR_BORE_ACTIVE_CLASS);
    }
  }

  function applyDoorBoreToggle(side) {
    if (currentModalIndex === null) return;
    var solution = window.comboSolutions[currentModalIndex];
    if (!solution) return;

    solution.door_bore = side;

    // Invalidate assembly caches so next full render re-serializes with correct state
    delete solution.assembly_svg;
    delete solution.assembly_svg_no_muntins;

    // Update the live mounted SVG directly (no full re-render needed)
    if (typeof window.updateBoreVisibility === "function") {
      window.updateBoreVisibility(side);
    }

    // Hinges always opposite bore on single doors
    if (typeof window.updateHingeVisibility === "function") {
      window.updateHingeVisibility("single_door", side);
    }

    // Update door type label in modal grid (Left-Hand ↔ Right-Hand)
    updateDoorTypeLabelsInModal(side);
  }

  function initDoorBoreToggle() {
    var leftBtn = document.getElementById(DOOR_BORE_LEFT_ID);
    var rightBtn = document.getElementById(DOOR_BORE_RIGHT_ID);

    if (leftBtn) {
      leftBtn.addEventListener("click", function(e) {
        e.preventDefault();
        if (currentDoorBore === "left") return;
        setDoorBoreToggleState("left");
        applyDoorBoreToggle("left");
      });
    }

    if (rightBtn) {
      rightBtn.addEventListener("click", function(e) {
        e.preventDefault();
        if (currentDoorBore === "right") return;
        setDoorBoreToggleState("right");
        applyDoorBoreToggle("right");
      });
    }
  }

  /** Show/hide #choose-door-bore and set toggle to match solution. */
  function configureDoorBoreForModal(solution) {
    var chooser = document.getElementById(CHOOSE_DOOR_BORE_ID);
    if (!chooser) return;

    if (solutionHasSingleDoor(solution)) {
      ensureDoorBoreDefault(solution);
      chooser.style.display = "flex";
      setDoorBoreToggleState(solution.door_bore);
    } else {
      chooser.style.display = "none";
    }
  }

  // =========================================
  // HARDWARE COLOR SELECTOR
  // =========================================

  /** Build <select> inside #hardware-selector from HARDWARE_COLORS, attach change handler.
   *  Copies computed styles from #selector-format placeholder, then removes it. */
  function initHardwareColorSelector() {
    var container = document.getElementById(HARDWARE_SELECTOR_ID);
    if (!container) return;

    var colors = window.HARDWARE_COLORS;
    if (!Array.isArray(colors) || colors.length === 0) return;

    // Copy styles from Webflow placeholder before removing it
    var placeholder = document.getElementById("selector-format");
    var styleProps = {};
    if (placeholder) {
      var cs = window.getComputedStyle(placeholder);
      var props = [
        "fontFamily", "fontSize", "fontWeight", "fontStyle",
        "lineHeight", "letterSpacing", "textTransform",
        "color", "backgroundColor",
        "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
        "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
        "border", "borderRadius",
        "width", "maxWidth", "minWidth",
        "height", "maxHeight", "minHeight",
        "textAlign"
      ];
      for (var p = 0; p < props.length; p++) {
        styleProps[props[p]] = cs[props[p]];
      }
      placeholder.remove();
    }

    var sel = document.createElement("select");
    sel.id = "hardware-color-select";

    // Apply copied styles
    for (var key in styleProps) {
      if (styleProps.hasOwnProperty(key)) {
        sel.style[key] = styleProps[key];
      }
    }
    sel.style.cursor = "pointer";

    for (var i = 0; i < colors.length; i++) {
      var opt = document.createElement("option");
      opt.value = colors[i].name;
      opt.textContent = colors[i].name;
      sel.appendChild(opt);
    }

    sel.addEventListener("change", function() {
      if (currentModalIndex === null) return;
      var solution = window.comboSolutions[currentModalIndex];
      if (!solution) return;

      solution.hardware_color = sel.value;

      // Invalidate assembly caches
      delete solution.assembly_svg;
      delete solution.assembly_svg_no_muntins;

      // Update hinge color on the live DOM
      var hex = resolveHardwareHex(sel.value);
      if (typeof window.updateHingeColor === "function") {
        window.updateHingeColor(hex);
      }
    });

    container.appendChild(sel);
  }

  /** Show/hide #hardware-color-wrapper and reset hardware color to Chrome on modal open. */
  function configureHardwareColorForModal(solution) {
    var wrapper = document.getElementById(HARDWARE_COLOR_WRAPPER_ID);
    if (!wrapper) return;

    if (solutionHasAnyDoor(solution)) {
      // Reset solution + selector to Chrome on every modal open
      solution.hardware_color = "Chrome";
      solution.assembly_svg = null;
      solution.assembly_svg_no_muntins = null;
      wrapper.style.display = "flex";

      var sel = document.getElementById("hardware-color-select");
      if (sel) sel.value = "Chrome";
    } else {
      wrapper.style.display = "none";
    }
  }

  /** Show #hardware_wrapper_div only for solutions with any door (single or double). */
  function configureHardwareWrapperForModal(solution) {
    var wrapper = document.getElementById(HARDWARE_WRAPPER_DIV_ID);
    if (!wrapper) return;
    wrapper.style.display = solutionHasAnyDoor(solution) ? "flex" : "none";
  }

  /** Show #dbl-door-wrapper only for double_door solutions. */
  function configureDblDoorWrapperForModal(solution) {
    var wrapper = document.getElementById(DBL_DOOR_WRAPPER_ID);
    if (!wrapper) return;
    wrapper.style.display = solutionHasDoubleDoor(solution) ? "flex" : "none";
  }

  // =========================================
  // DECIMAL → FRACTION HELPER
  // =========================================
  const FRACTION_TABLE = [
    [1/16, "1/16"], [1/8, "1/8"], [3/16, "3/16"], [1/4, "1/4"],
    [5/16, "5/16"], [3/8, "3/8"], [7/16, "7/16"], [1/2, "1/2"],
    [9/16, "9/16"], [5/8, "5/8"], [11/16, "11/16"], [3/4, "3/4"],
    [13/16, "13/16"], [7/8, "7/8"], [15/16, "15/16"],
  ];

  function decimalToFraction(val) {
    if (val == null || val === "") return "";
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val);
    const whole = Math.floor(n);
    const rem = Math.round((n - whole) * 16) / 16;
    if (rem === 0) return whole + '"';
    if (rem >= 1) return (whole + 1) + '"';
    const frac = FRACTION_TABLE.find(([v]) => Math.abs(v - rem) < 0.001);
    const fracStr = frac ? frac[1] : rem.toString();
    return whole > 0 ? whole + '-' + fracStr + '"' : fracStr + '"';
  }

  // =========================================
  // MODAL DATA GRID
  // =========================================
  const MODAL_SUMMARY_SELECTOR = '[data-modal-summary="section"]';
  const MODAL_GRID_SELECTOR    = '[data-modal-grid="section"]';
  const MODAL_ROW_SELECTOR     = '[data-modal-row="template"]';
  const MODAL_NOTES_SELECTOR   = '[data-modal-notes="row"]';
  const MODAL_ICON_SELECTOR    = '[data-modal-icon="img"]';

  function setModalIcon(panel, iconPath) {
    const wrapper = panel.querySelector(MODAL_ICON_SELECTOR);
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
        console.warn("Modal icon not found in registry; fallback:", resolved, "original:", raw);
      }
    }

    img.alt = "Arrangement icon";
    img.onerror = () => console.warn("Modal icon failed to load:", resolved, "original:", raw);
    img.src = resolved;
  }

  function clearModalGridRows() {
    const panel = document.getElementById(MODAL_PANEL_ID);
    if (!panel) return;
    const gridBlock = panel.querySelector(MODAL_GRID_SELECTOR);
    if (!gridBlock) return;
    gridBlock.querySelectorAll("[data-pos]").forEach(r => r.remove());
    gridBlock.querySelectorAll("[data-unit-notes]").forEach(r => r.remove());
  }

  function populateModalGrid(idx) {
    const sol = window.comboSolutions[idx];
    if (!sol) {
      console.warn("populateModalGrid: no solution at index", idx);
      return;
    }

    const panel = document.getElementById(MODAL_PANEL_ID);
    if (!panel) return;

    // --- Opening Summary ---
    const summaryBlock = panel.querySelector(MODAL_SUMMARY_SELECTOR);
    if (summaryBlock) {
      setField(summaryBlock, "opening_width",  decimalToFraction(sol.opening_width));
      setField(summaryBlock, "opening_height", decimalToFraction(sol.opening_height));
      setField(summaryBlock, "jamb_depth",     decimalToFraction(sol.jamb_depth));
    }

    // --- Solution Grid ---
    const gridBlock = panel.querySelector(MODAL_GRID_SELECTOR);
    if (!gridBlock) return;

    // Icon
    setModalIcon(panel, sol.icon);

    // Remove previously cloned rows (keep template)
    gridBlock.querySelectorAll("[data-pos]").forEach(r => r.remove());
    gridBlock.querySelectorAll("[data-unit-notes]").forEach(r => r.remove());

    const rowTemplate = gridBlock.querySelector(MODAL_ROW_SELECTOR);
    if (!rowTemplate) return;

    rowTemplate.style.display = "none";
    const rowContainer = rowTemplate.parentElement;
    const notesRow = gridBlock.querySelector(MODAL_NOTES_SELECTOR);
    const grid = sol.solution_grid || {};

    // --- Unit Notes (top of grid) ---
    const unitNotesValue = grid.unit_notes ?? "";
    if (unitNotesValue.trim() && notesRow) {
      const unitNotesClone = notesRow.cloneNode(true);
      unitNotesClone.setAttribute("data-unit-notes", "row");
      unitNotesClone.removeAttribute("data-modal-notes");
      setField(unitNotesClone, "notes", unitNotesValue);
      if (rowContainer) rowContainer.insertBefore(unitNotesClone, rowContainer.firstChild);
    }

    POS_ORDER.forEach((posKey) => {
      const rowData = grid[posKey];
      if (!rowData) return;

      const row = rowTemplate.cloneNode(true);
      row.style.display = "";
      row.removeAttribute("data-modal-row");
      row.setAttribute("data-pos", posKey);

      stripWebflowInteractionIds(row);

      setField(row, "row",              rowData.row);
      setField(row, "building_block",   rowData.building_block);
      setField(row, "order_dims",       rowData.order_dims);
      setField(row, "quantity",         rowData.quantity);
      var lnVal = rowData.line_notes != null ? String(rowData.line_notes) : "";
      setField(row, "line_notes", lnVal.replace("XX", resolveDoorTypeLabel(sol, "modal")));

      if (notesRow && notesRow.parentElement === rowContainer) {
        rowContainer.insertBefore(row, notesRow);
      } else {
        rowContainer.appendChild(row);
      }
    });

    // --- Notes ---
    if (notesRow) {
      setField(notesRow, "notes", grid.solution_notes ?? "");
    }
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

    // Opening dimensions live at response root (same for all solutions in a job)
    const rootOpening = (resp && typeof resp === "object" && !Array.isArray(resp))
      ? {
          opening_width:  resp.opening_width  ?? null,
          opening_height: resp.opening_height ?? null,
          jamb_depth:     resp.jamb_depth     ?? null,
          unit_width:     resp.unit_width     ?? null,
          unit_height:    resp.unit_height    ?? null,
        }
      : { opening_width: null, opening_height: null, jamb_depth: null,
          unit_width: null, unit_height: null };

    return arr.map((sol, idx) => ({
      index: idx,
      job_id: window.job_id,

      assembly_template: sol.assembly_template ?? null,
      assembly_no: sol.assembly_no ?? sol.arrangement_no ?? null,

      icon: sol.icon ?? null,
      solution_grid: sol.solution_grid ?? {},

      build_objects: sol.build_objects ?? [],

      solution_svg: sol.solution_svg ?? null,

      meta: sol.meta ?? {},

      // Opening dimensions (per-solution overrides root)
      opening_width:  sol.opening_width  ?? rootOpening.opening_width,
      opening_height: sol.opening_height ?? rootOpening.opening_height,
      jamb_depth:     sol.jamb_depth     ?? rootOpening.jamb_depth,

      // Unit dimensions for SVG dimension annotations
      unit_width:     sol.unit_width     ?? rootOpening.unit_width,
      unit_height:    sol.unit_height    ?? rootOpening.unit_height,

      // Door bore side ("left" | "right" | null)
      door_bore: sol.door_bore ?? null,

      // Hardware color name (e.g., "Chrome"); null until defaulted
      hardware_color: sol.hardware_color ?? null,
    }));
  }

  /** Returns true if solution contains at least one single_door build_object. */
  function solutionHasSingleDoor(solution) {
    var bos = solution && solution.build_objects;
    if (!Array.isArray(bos)) return false;
    for (var i = 0; i < bos.length; i++) {
      var c = String(bos[i] && bos[i].construction || "").trim();
      if (c === "single_door" || c === "single_door_only" || c === "single") return true;
    }
    return false;
  }

  /** Default door_bore for solutions with a single door, using the assembly template's door_bore value. */
  function ensureDoorBoreDefault(solution) {
    if (!solution) return;
    if (!solution.door_bore && solutionHasSingleDoor(solution)) {
      var defaultSide = "right";
      var tplName = solution.assembly_template;
      if (tplName && window.ASSEMBLY_TEMPLATES) {
        for (var i = 0; i < window.ASSEMBLY_TEMPLATES.length; i++) {
          if (window.ASSEMBLY_TEMPLATES[i].template === tplName) {
            defaultSide = window.ASSEMBLY_TEMPLATES[i].door_bore || "right";
            break;
          }
        }
      }
      solution.door_bore = defaultSide;
    }
  }

  /** Returns true if solution contains at least one double_door build_object. */
  function solutionHasDoubleDoor(solution) {
    var bos = solution && solution.build_objects;
    if (!Array.isArray(bos)) return false;
    for (var i = 0; i < bos.length; i++) {
      var c = String(bos[i] && bos[i].construction || "").trim();
      if (c === "double_door") return true;
    }
    return false;
  }

  /** Returns true if solution contains any door (single or double). */
  function solutionHasAnyDoor(solution) {
    return solutionHasSingleDoor(solution) || solutionHasDoubleDoor(solution);
  }

  /** Resolve the door type label to replace the "XX" marker in line_notes.
   *  @param {object} solution
   *  @param {"listing"|"modal"} context - "listing" for solution cards, "modal" for Explore
   *  @param {string} [boreSide] - override bore side (used by toggle); falls back to solution.door_bore
   */
  function resolveDoorTypeLabel(solution, context, boreSide) {
    if (solutionHasDoubleDoor(solution)) return "Double-Hung";
    if (!solutionHasSingleDoor(solution)) return "XX";
    if (context === "listing") return "Single-Hung";
    // modal context: label reflects bore side
    var side = boreSide || solution.door_bore || "right";
    return (side === "left") ? "Left-Hand" : "Right-Hand";
  }

  /** Update line_notes labels in the modal grid when bore side toggles.
   *  Swaps "Left-Hand" ↔ "Right-Hand" in all modal [data-field="line_notes"] elements. */
  function updateDoorTypeLabelsInModal(side) {
    var panel = document.getElementById(MODAL_PANEL_ID);
    if (!panel) return;
    var duhEls = panel.querySelectorAll('[data-field="line_notes"]');
    var newLabel = (side === "left") ? "Left-Hand" : "Right-Hand";
    var oldLabel = (side === "left") ? "Right-Hand" : "Left-Hand";
    for (var i = 0; i < duhEls.length; i++) {
      duhEls[i].textContent = duhEls[i].textContent.replace(oldLabel, newLabel);
    }
  }

  /** Look up hardware hex color from HARDWARE_COLORS by name. Defaults to Chrome. */
  function resolveHardwareHex(colorName) {
    var colors = window.HARDWARE_COLORS;
    if (Array.isArray(colors)) {
      for (var i = 0; i < colors.length; i++) {
        if (colors[i].name === colorName) return colors[i].color;
      }
      // If name not found, return Chrome
      for (var j = 0; j < colors.length; j++) {
        if (colors[j].name === "Chrome") return colors[j].color;
      }
    }
    return "#D7D7D7"; // fallback Chrome hex
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
    const summaryValue = solutionGrid?.solution_notes ?? "";
    const summaryRow = card.querySelector('[data-solution-summary="row"]');
    if (!summaryRow) return;
    setField(summaryRow, "summary", summaryValue);
  }

  function setUnitNotes(card, solutionGrid) {
    const unitNotesValue = solutionGrid?.unit_notes ?? "";
    if (!unitNotesValue.trim()) return;
    const summaryRow = card.querySelector('[data-solution-summary="row"]');
    if (!summaryRow) return;
    const clone = summaryRow.cloneNode(true);
    clone.setAttribute("data-unit-notes", "row");
    clone.removeAttribute("data-solution-summary");
    setField(clone, "summary", unitNotesValue);
    const rowsParent = summaryRow.parentElement;
    if (rowsParent) rowsParent.insertBefore(clone, rowsParent.firstChild);
  }

  function buildRowsInCard(card, solutionGrid, solution) {
    const rowTemplate = card.querySelector(ROW_TEMPLATE_SELECTOR);
    if (!rowTemplate) return;

    const summaryRow = card.querySelector('[data-solution-summary="row"]');

    $all(".solution-row", card).forEach((r) => {
      if (r.getAttribute("data-solution-row") !== "template") r.remove();
    });
    card.querySelectorAll("[data-unit-notes]").forEach((r) => r.remove());

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
      var lnVal = rowData.line_notes != null ? String(rowData.line_notes) : "";
      setField(row, "line_notes", lnVal.replace("XX", resolveDoorTypeLabel(solution, "listing")));

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
      buildRowsInCard(card, sol.solution_grid, sol);
      setUnitNotes(card, sol.solution_grid);
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
    initMuntinToggle();
    initDoorBoreToggle();
    initHardwareColorSelector();

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
