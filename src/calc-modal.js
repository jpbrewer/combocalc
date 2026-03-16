/**
 * File: calc-modal.js
 *
 * Role:
 * UI CONTROLLER
 *
 * Purpose:
 *  Controls the Explore modal overlay: opening/closing, muntin toggle, door bore toggle
 *  (single door: left/right; double door: left/right/none with bore, bolt, and catch visibility),
 *  hardware color selector, double-door wrapper, modal data grid population, modal icon,
 *  and Configure button (stages solution, reconciles muntins, POSTs to Xano).
 *  For double doors, defaults operating_door to "none" on first open; toggles
 *  #double-door-note / #double-door-note-dummy visibility based on selection.
 *  Separated from calc-combo-results.js so the SVG rendering pipeline can be reused
 *  on other pages without requiring modal infrastructure.
 *
 * Public API:
 *  - None directly (attaches DOM event listeners on init).
 *  - Writes window._comboCalc.closeModal for use by calc-combo-results.js resetUI().
 *
 * Inputs:
 *  - DOM IDs expected:
 *    - #modal-overlay            (overlay backdrop; toggled display:flex/none)
 *    - #modal-panel              (click guard; stopPropagation)
 *    - #modal-close              (close trigger)
 *    - #no-muntin, #yes-muntin   (muntin toggle buttons; class-toggled)
 *    - #choose-door-bore         (bore chooser wrapper; display toggled)
 *    - #door-bore-left, #door-bore-right (bore toggle buttons; class-toggled)
 *    - #hardware_wrapper_div     (hardware controls wrapper; display toggled)
 *    - #hardware-color-wrapper   (hardware color wrapper; display toggled)
 *    - #hardware-selector        (container for dynamically created <select>)
 *    - #dbl-door-wrapper         (double door wrapper; display toggled)
 *    - #door-bore-left-double   (double door left bore toggle; class-toggled)
 *    - #door-bore-right-double  (double door right bore toggle; class-toggled)
 *    - #double_door_no_bore     (double door no-bore toggle; class-toggled; default active)
 *    - #double-door-note        (shown when operating_door is left_hand or right_hand)
 *    - #double-door-note-dummy  (shown when operating_door is none)
 *  - Selectors / structural assumptions:
 *    - [data-solution-explore="btn"]  (Explore buttons on solution cards; click captured at document level)
 *    - [data-modal-summary="section"] (opening summary block; contains data-field opening_width/opening_height/jamb_depth)
 *    - [data-modal-grid="section"]    (grid block containing row template + notes row + icon)
 *    - [data-modal-row="template"]    (template row for solution_grid positions to clone)
 *    - [data-modal-notes="row"]       (notes row template; cloned for unit_notes, original for solution_notes)
 *    - [data-modal-icon="img"]        (icon wrapper; must contain <img data-field="icon">)
 *    - [data-modal-configure="btn"]   (Configure button; click triggers stage/reconcile/POST)
 *
 * Data Contract:
 *  - Reads window._comboCalc (shared utilities from calc-combo-results.js; includes resolveIconUrl)
 *  - Reads window.comboSolutions (solution data store)
 *  - Calls window.build_assembly_svg(index, muntins) (SVG pipeline)
 *  - Calls window.updateBoreVisibility(boreSide) (SVG post-mount)
 *  - Calls window.updateHingeVisibility(construction, boreSide) (SVG post-mount)
 *  - Calls window.updateHingeColor(hexColor) (SVG post-mount)
 *  - Reads window.HARDWARE_COLORS (hardware color definitions)
 *
 * Load Order:
 *  - Must load AFTER calc-combo-results.js (needs window._comboCalc).
 *  - Must load BEFORE or AFTER SVG pipeline files (calls them at user-click time, not init time).
 *
 * Side Effects:
 *  - No network calls.
 *  - No localStorage/cookies.
 *  - Attaches DOM event listeners on init.
 *
 * Failure Behavior:
 *  - If required modal DOM elements are missing, individual features degrade gracefully (warn + skip).
 *  - If window._comboCalc is missing, logs error and disables itself.
 */
(function () {
  // ---- Guard: shared utilities must exist ----
  var cc = window._comboCalc;
  if (!cc) {
    console.error("[calc-modal] Disabled: window._comboCalc not found. Ensure calc-combo-results.js loads first.");
    return;
  }

  // ---- Constants ----
  var MODAL_OVERLAY_ID         = "modal-overlay";
  var MODAL_PANEL_ID           = "modal-panel";
  var MODAL_CLOSE_ID           = "modal-close";
  var NO_MUNTIN_ID             = "no-muntin";
  var YES_MUNTIN_ID            = "yes-muntin";
  var MUNTIN_ACTIVE_CLASS      = "muntin-selection-active";
  var CHOOSE_DOOR_BORE_ID      = "choose-door-bore";
  var DOOR_BORE_LEFT_ID        = "door-bore-left";
  var DOOR_BORE_RIGHT_ID       = "door-bore-right";
  var DOOR_BORE_ACTIVE_CLASS   = "door-selection-active";
  var HARDWARE_WRAPPER_DIV_ID  = "hardware_wrapper_div";
  var HARDWARE_COLOR_WRAPPER_ID = "hardware-color-wrapper";
  var HARDWARE_SELECTOR_ID     = "hardware-selector";
  var DBL_DOOR_WRAPPER_ID      = "dbl-door-wrapper";
  var DBL_BORE_LEFT_ID         = "door-bore-left-double";
  var DBL_BORE_RIGHT_ID        = "door-bore-right-double";
  var DBL_NO_BORE_ID           = "double-door-no-bore";
  var DBL_DOOR_NOTE_ID         = "double-door-note";
  var DBL_DOOR_NOTE_DUMMY_ID   = "double-door-note-dummy";
  var CONFIGURE_BTN_SELECTOR   = '[data-modal-configure="btn"]';
  var CONFIGURE_ENDPOINT       = "https://api.transomsdirect.com/api:xyi0dc0X/bc_combo_solution_config";

  /** Hardcoded styles for the hardware color <select>.
   *  Replaces the old #selector-format placeholder approach (deleted from Webflow). */
  var HARDWARE_SELECT_STYLES = {
    fontFamily:      "'Dm sans', sans-serif",
    fontSize:        "14px",
    fontWeight:      "400",
    lineHeight:      "1.4",
    color:           "rgb(51, 51, 51)",
    backgroundColor: "rgb(255, 255, 255)",
    padding:         "8px 12px",
    border:          "1px solid rgb(204, 204, 204)",
    borderRadius:    "4px",
    width:           "100%",
    height:          "auto",
    textAlign:       "left",
    cursor:          "pointer"
  };

  var MODAL_SUMMARY_SELECTOR   = '[data-modal-summary="section"]';
  var MODAL_GRID_SELECTOR      = '[data-modal-grid="section"]';
  var MODAL_ROW_SELECTOR       = '[data-modal-row="template"]';
  var MODAL_NOTES_SELECTOR     = '[data-modal-notes="row"]';
  var MODAL_ICON_SELECTOR      = '[data-modal-icon="img"]';

  var _hardwareSelectBuilt = false;

  // ---- State ----
  var currentModalIndex  = null;
  var currentMuntinState = false;
  var currentDoorBore    = "right";

  // ---- Shorthand refs to shared utilities ----
  var setField                   = cc.setField;
  var stripWebflowInteractionIds = cc.stripWebflowInteractionIds;
  var POS_ORDER                  = cc.POS_ORDER;
  var resolveIconUrl             = cc.resolveIconUrl;
  var decimalToFraction          = cc.decimalToFraction;
  var resolveDoorTypeLabel       = cc.resolveDoorTypeLabel;
  var solutionHasSingleDoor      = cc.solutionHasSingleDoor;
  var solutionHasDoubleDoor      = cc.solutionHasDoubleDoor;
  var solutionHasAnyDoor         = cc.solutionHasAnyDoor;
  var ensureOperatingDoorDefault  = cc.ensureOperatingDoorDefault;
  var resolveHardwareHex         = cc.resolveHardwareHex;
  var postJson                   = cc.postJson;

  // =========================================
  // MODAL OPEN / CLOSE
  // =========================================
  function openModal() {
    initHardwareColorSelector();   // lazy — runs once on first open
    initDblDoorBoreToggle();       // lazy — runs once on first open
    var overlay = document.getElementById(MODAL_OVERLAY_ID);
    if (overlay) overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    var dblWrapper = document.getElementById(DBL_DOOR_WRAPPER_ID);
    if (dblWrapper) dblWrapper.style.display = "none";
    var overlay = document.getElementById(MODAL_OVERLAY_ID);
    if (overlay) overlay.style.display = "none";
    document.body.style.overflow = "";
    clearModalGridRows();
    currentModalIndex = null;
    currentMuntinState = false;
  }

  // =========================================
  // MODAL BEHAVIOR (Explore click, close handlers)
  // =========================================
  function initModalBehavior() {
    var overlay = document.getElementById(MODAL_OVERLAY_ID);
    var panel = document.getElementById(MODAL_PANEL_ID);
    var closeBtn = document.getElementById(MODAL_CLOSE_ID);

    // Prevent text-selection highlight on the close button
    if (closeBtn) {
      closeBtn.style.userSelect = "none";
      closeBtn.style.webkitUserSelect = "none";
    }

    // OPEN from Explore (capture phase, dynamic-safe)
    document.addEventListener("click", function (e) {
      var exploreBtn = e.target.closest('[data-solution-explore="btn"]');
      if (!exploreBtn) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // 1) Open modal first
      openModal();

      // 2) Call renderer using stored index
      var idx = Number(exploreBtn.dataset.solutionIndex);
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
        window.updateBoreVisibility(solution.operating_door || "right_hand");
      }
      if (solution && typeof window.updateHingeVisibility === "function") {
        var doorType = solutionHasDoubleDoor(solution) ? "double_door"
                     : solutionHasSingleDoor(solution) ? "single_door" : null;
        if (doorType) {
          window.updateHingeVisibility(doorType, solution.operating_door || "right_hand");
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
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
      });
    }

    // CLOSE: click overlay background only
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    // DO NOT CLOSE: clicks inside panel
    if (panel) panel.addEventListener("click", function (e) { e.stopPropagation(); });

    // ESC closes
    document.addEventListener("keydown", function (e) {
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
      noBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (!currentMuntinState) return;
        setMuntinToggleState(false);
        renderMuntinVersion(false);
      });
    }

    if (yesBtn) {
      yesBtn.addEventListener("click", function (e) {
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
      if (side === "left_hand") leftBtn.classList.add(DOOR_BORE_ACTIVE_CLASS);
      else leftBtn.classList.remove(DOOR_BORE_ACTIVE_CLASS);
    }
    if (rightBtn) {
      if (side === "right_hand") rightBtn.classList.add(DOOR_BORE_ACTIVE_CLASS);
      else rightBtn.classList.remove(DOOR_BORE_ACTIVE_CLASS);
    }
  }

  function applyDoorBoreToggle(side) {
    if (currentModalIndex === null) return;
    var solution = window.comboSolutions[currentModalIndex];
    if (!solution) return;

    solution.operating_door = side;

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

    // Update door type label in modal grid (Left-Hand / Right-Hand)
    updateDoorTypeLabelsInModal(side);
  }

  function initDoorBoreToggle() {
    var leftBtn = document.getElementById(DOOR_BORE_LEFT_ID);
    var rightBtn = document.getElementById(DOOR_BORE_RIGHT_ID);

    if (leftBtn) {
      leftBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (currentDoorBore === "left_hand") return;
        setDoorBoreToggleState("left_hand");
        applyDoorBoreToggle("left_hand");
      });
    }

    if (rightBtn) {
      rightBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (currentDoorBore === "right_hand") return;
        setDoorBoreToggleState("right_hand");
        applyDoorBoreToggle("right_hand");
      });
    }
  }

  // =========================================
  // DOUBLE DOOR BORE TOGGLE
  // =========================================
  function setDblDoorBoreToggleState(side) {
    var leftBtn  = document.getElementById(DBL_BORE_LEFT_ID);
    var rightBtn = document.getElementById(DBL_BORE_RIGHT_ID);
    var noneBtn  = document.getElementById(DBL_NO_BORE_ID);
    var note     = document.getElementById(DBL_DOOR_NOTE_ID);

    if (leftBtn) {
      if (side === "left_hand") leftBtn.classList.add(DOOR_BORE_ACTIVE_CLASS);
      else leftBtn.classList.remove(DOOR_BORE_ACTIVE_CLASS);
    }
    if (rightBtn) {
      if (side === "right_hand") rightBtn.classList.add(DOOR_BORE_ACTIVE_CLASS);
      else rightBtn.classList.remove(DOOR_BORE_ACTIVE_CLASS);
    }
    if (noneBtn) {
      if (side === "none") noneBtn.classList.add(DOOR_BORE_ACTIVE_CLASS);
      else noneBtn.classList.remove(DOOR_BORE_ACTIVE_CLASS);
    }
    var noteDummy = document.getElementById(DBL_DOOR_NOTE_DUMMY_ID);
    if (note) {
      note.style.display = (side === "left_hand" || side === "right_hand") ? "block" : "none";
    }
    if (noteDummy) {
      noteDummy.style.display = (side === "none") ? "block" : "none";
    }
  }

  function applyDblDoorBoreToggle(side) {
    if (currentModalIndex === null) return;
    var solution = window.comboSolutions[currentModalIndex];
    if (!solution) return;

    solution.operating_door = side;

    // Invalidate assembly caches so next full render re-serializes with correct state
    delete solution.assembly_svg;
    delete solution.assembly_svg_no_muntins;

    // Update the live mounted SVG directly (no full re-render needed)
    if (typeof window.updateBoreVisibility === "function") {
      window.updateBoreVisibility(side);
    }

    // Hinge visibility for double doors
    if (typeof window.updateHingeVisibility === "function") {
      window.updateHingeVisibility("double_door", side);
    }

    // Update door type label in modal grid
    updateDoorTypeLabelsInModal(side);
  }

  var _dblDoorBoreInited = false;
  function initDblDoorBoreToggle() {
    if (_dblDoorBoreInited) return;
    _dblDoorBoreInited = true;

    var leftBtn  = document.getElementById(DBL_BORE_LEFT_ID);
    var rightBtn = document.getElementById(DBL_BORE_RIGHT_ID);
    var noneBtn  = document.getElementById(DBL_NO_BORE_ID);

    if (leftBtn) {
      leftBtn.addEventListener("click", function (e) {
        e.preventDefault();
        setDblDoorBoreToggleState("left_hand");
        applyDblDoorBoreToggle("left_hand");
      });
    }
    if (rightBtn) {
      rightBtn.addEventListener("click", function (e) {
        e.preventDefault();
        setDblDoorBoreToggleState("right_hand");
        applyDblDoorBoreToggle("right_hand");
      });
    }
    if (noneBtn) {
      noneBtn.addEventListener("click", function (e) {
        e.preventDefault();
        setDblDoorBoreToggleState("none");
        applyDblDoorBoreToggle("none");
      });
    }
  }

  /** Show/hide #choose-door-bore and set toggle to match solution. */
  function configureDoorBoreForModal(solution) {
    var chooser = document.getElementById(CHOOSE_DOOR_BORE_ID);
    if (!chooser) return;

    if (solutionHasSingleDoor(solution)) {
      ensureOperatingDoorDefault(solution);
      chooser.style.display = "flex";
      setDoorBoreToggleState(solution.operating_door);
    } else {
      chooser.style.display = "none";
    }
  }

  // =========================================
  // HARDWARE COLOR SELECTOR
  // =========================================

  /** Build <select> inside #hardware-selector from HARDWARE_COLORS, attach change handler.
   *  Called lazily on first modal open so HARDWARE_COLORS is guaranteed loaded.
   *  Uses hardcoded HARDWARE_SELECT_STYLES (no Webflow template element needed). */
  function initHardwareColorSelector() {
    if (_hardwareSelectBuilt) return;

    var container = document.getElementById(HARDWARE_SELECTOR_ID);
    if (!container) return;

    var colors = window.HARDWARE_COLORS;
    if (!Array.isArray(colors) || colors.length === 0) return;

    _hardwareSelectBuilt = true;

    var sel = document.createElement("select");
    sel.id = "hardware-color-select";

    for (var key in HARDWARE_SELECT_STYLES) {
      if (HARDWARE_SELECT_STYLES.hasOwnProperty(key)) {
        sel.style[key] = HARDWARE_SELECT_STYLES[key];
      }
    }

    for (var i = 0; i < colors.length; i++) {
      var opt = document.createElement("option");
      opt.value = colors[i].name;
      opt.textContent = colors[i].name;
      sel.appendChild(opt);
    }

    sel.addEventListener("change", function () {
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

  /** Show/hide #hardware-color-wrapper and sync selector to solution.hardware_color on modal open. */
  function configureHardwareColorForModal(solution) {
    var wrapper = document.getElementById(HARDWARE_COLOR_WRAPPER_ID);
    if (!wrapper) return;

    if (solutionHasAnyDoor(solution)) {
      wrapper.style.display = "flex";
      var sel = document.getElementById("hardware-color-select");
      if (sel) sel.value = solution.hardware_color || "Chrome";
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

    if (solutionHasDoubleDoor(solution)) {
      wrapper.style.display = "flex";
      // Default operating_door to "none" for double doors if not yet set
      if (!solution.operating_door) {
        solution.operating_door = "none";
      }
      setDblDoorBoreToggleState(solution.operating_door);
    } else {
      wrapper.style.display = "none";
    }
  }

  // =========================================
  // CONFIGURE BUTTON
  // =========================================

  /** Stage a deep copy of the current solution, reconcile muntins, clean, and POST to Xano. */
  async function handleConfigure() {
    if (currentModalIndex === null) return;
    var solution = window.comboSolutions[currentModalIndex];
    if (!solution) return;

    // 1. Deep copy — never mutate the live comboSolutions array
    var staged = JSON.parse(JSON.stringify(solution));

    // 2. Reconcile rows/cols based on muntin choice
    if (staged.muntins === true && Array.isArray(staged.build_objects)) {
      for (var i = 0; i < staged.build_objects.length; i++) {
        var bo = staged.build_objects[i];
        if (bo.suggested_rows != null && bo.suggested_cols != null) {
          bo.rows = bo.suggested_rows;
          bo.cols = bo.suggested_cols;
        }
      }
    }

    // 3. Clean solution-level fields
    delete staged.muntins;
    delete staged.building_block_svgs;
    delete staged.building_block_svgs_no_muntins;
    delete staged.assembly_svg;
    delete staged.assembly_svg_no_muntins;

    // 4. Clean build_object-level fields
    if (Array.isArray(staged.build_objects)) {
      for (var j = 0; j < staged.build_objects.length; j++) {
        delete staged.build_objects[j].suggested_rows;
        delete staged.build_objects[j].suggested_cols;
      }
    }

    // 5. POST to Xano
    try {
      var result = await postJson(CONFIGURE_ENDPOINT, staged);
      console.log("[calc-modal] Configure POST succeeded:", result);
    } catch (err) {
      console.error("[calc-modal] Configure POST failed:", err);
    }
  }

  function initConfigureButton() {
    var btn = document.querySelector(CONFIGURE_BTN_SELECTOR);
    if (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        handleConfigure();
      });
    }
  }

  // =========================================
  // MODAL DATA GRID
  // =========================================
  function setModalIcon(panel, iconPath) {
    var wrapper = panel.querySelector(MODAL_ICON_SELECTOR);
    if (!wrapper) return;

    var img = wrapper.querySelector('[data-field="icon"]');
    if (!img) return;

    var resolved = resolveIconUrl(iconPath);
    if (!resolved) {
      img.removeAttribute("src");
      img.alt = "";
      return;
    }

    img.alt = "Arrangement icon";
    img.onerror = function () { console.warn("Modal icon failed to load:", resolved); };
    img.src = resolved;
  }

  function clearModalGridRows() {
    var panel = document.getElementById(MODAL_PANEL_ID);
    if (!panel) return;
    var gridBlock = panel.querySelector(MODAL_GRID_SELECTOR);
    if (!gridBlock) return;
    gridBlock.querySelectorAll("[data-pos]").forEach(function (r) { r.remove(); });
    gridBlock.querySelectorAll("[data-unit-notes]").forEach(function (r) { r.remove(); });
  }

  function populateModalGrid(idx) {
    var sol = window.comboSolutions[idx];
    if (!sol) {
      console.warn("populateModalGrid: no solution at index", idx);
      return;
    }

    var panel = document.getElementById(MODAL_PANEL_ID);
    if (!panel) return;

    // --- Opening Summary ---
    var summaryBlock = panel.querySelector(MODAL_SUMMARY_SELECTOR);
    if (summaryBlock) {
      setField(summaryBlock, "opening_width",  decimalToFraction(sol.opening_width));
      setField(summaryBlock, "opening_height", decimalToFraction(sol.opening_height));
      setField(summaryBlock, "jamb_depth",     decimalToFraction(sol.jamb_depth));
    }

    // --- Solution Grid ---
    var gridBlock = panel.querySelector(MODAL_GRID_SELECTOR);
    if (!gridBlock) return;

    // Icon
    setModalIcon(panel, sol.icon);

    // Remove previously cloned rows (keep template)
    gridBlock.querySelectorAll("[data-pos]").forEach(function (r) { r.remove(); });
    gridBlock.querySelectorAll("[data-unit-notes]").forEach(function (r) { r.remove(); });

    var rowTemplate = gridBlock.querySelector(MODAL_ROW_SELECTOR);
    if (!rowTemplate) return;

    rowTemplate.style.display = "none";
    var rowContainer = rowTemplate.parentElement;
    var notesRow = gridBlock.querySelector(MODAL_NOTES_SELECTOR);
    var grid = sol.solution_grid || {};

    // --- Unit Notes (above bottom notes row) ---
    var unitNotesValue = grid.unit_notes != null ? grid.unit_notes : "";
    if (unitNotesValue.trim() && notesRow) {
      var unitNotesClone = notesRow.cloneNode(true);
      unitNotesClone.setAttribute("data-unit-notes", "row");
      unitNotesClone.removeAttribute("data-modal-notes");
      setField(unitNotesClone, "notes", unitNotesValue);
      if (rowContainer && notesRow) rowContainer.insertBefore(unitNotesClone, notesRow);
    }

    POS_ORDER.forEach(function (posKey) {
      var rowData = grid[posKey];
      if (!rowData) return;

      var row = rowTemplate.cloneNode(true);
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
      setField(notesRow, "notes", grid.solution_notes != null ? grid.solution_notes : "");
    }
  }

  /** Update line_notes labels in the modal grid when bore side toggles.
   *  Swaps "Left-Hand" / "Right-Hand" in all modal [data-field="line_notes"] elements. */
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

  // =========================================
  // EXPOSE closeModal for resetUI
  // =========================================
  cc.closeModal = closeModal;

  // =========================================
  // INIT
  // =========================================
  function initModal() {
    initModalBehavior();
    initMuntinToggle();
    initDoorBoreToggle();
    initConfigureButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModal);
  } else {
    initModal();
  }
})();
