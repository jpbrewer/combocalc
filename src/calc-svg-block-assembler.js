/**
 * File:
 * calc-svg-block-assembler.js
 *
 * Role:
 * ORCHESTRATOR
 *
 * Purpose:
 * - Orchestrates generation of per-position “building block” SVGs and assembles them into a single combined SVG.
 * - Uses a named assembly template (assembly_template) and a template “ops” sequence (place/snap/validateSnap) to compute layout.
 * - Inserts the assembled SVG as an inline DOM <svg> into a configurable mount target (defaults to div#explore),
 *   and stores the serialized SVG on the solution object.
 *
 * Context:
 * - Browser-only drop-in intended for Webflow pages where Node.js filesystem I/O is not available.
 * - Loaded as a plain script (e.g., Webflow embed, CDN via jsDelivr/GitHub pages), operating on globals and existing DOM.
 * - Keeps layout rules data-driven via window.ASSEMBLY_TEMPLATES to remain maintainable across Webflow structure changes.
 *
 * -------------------------------------------------------------------------
 *
 * Source of truth:
 * - Authoritative:
 *   - window.comboSolutions[index] (solution object), especially:
 *     - solution.assembly_template (template selection)
 *     - solution.building_block_svgs (block SVG inputs produced by build_block_svgs(index))
 *   - window.ASSEMBLY_TEMPLATES (template definitions: positions + ordered ops)
 *   - Each block SVG root <svg> viewBox (width/height) used for snap math.
 *
 * - Derived / computed:
 *   - placements computed from template ops (x/y per pos + w/h from viewBox).
 *   - Final assembled SVG root viewBox derived from placement bounds.
 *   - solution.assembly_svg derived by serializing the assembled DOM SVG element.
 *
 * -------------------------------------------------------------------------
 *
 * Inputs (reads):
 *
 * DOM Contract:
 * - Required element:
 *   - Mount target element (defaults to div#explore if no mountTarget param is provided).
 *     Can be any container <div>; passed as string ID or DOM element to build_assembly_svg().
 *
 * - Assumptions:
 *   - Mount target exists by the time build_assembly_svg(index) is called.
 *   - Mount target has a fixed height (guaranteed by page/CSS), enabling width="100%" + height="100%" SVG sizing.
 *
 * - IDs refer to:
 *   - #explore (default) is a wrapper <div> element ID (not a Webflow input/label ID).
 *
 * Data Contract:
 * - Required globals:
 *   - window.ASSEMBLY_TEMPLATES: Array of template objects:
 *       { template: string, positions: string[], ops: Array<Op> }
 *
 *     Op shapes used here (exact strings are significant):
 *       { op:"place", pos:"pos2", at:{ x:0, y:0 } }
 *       { op:"snap", pos:"pos5", my:"BL", toPos:"pos2", their:"TL", offset?:{ x:0, y:0 } }
 *       { op:"validateSnap", pos:"pos5", my:"BR", toPos:"pos2", their:"TR", tolerance?:number }
 *
 *   - window.comboSolutions: Array of solution objects (index-addressable).
 *   - window.build_block_svgs(index): Function that populates comboSolutions[index].building_block_svgs.
 *
 * - Required solution fields:
 *   - comboSolutions[index].assembly_template:
 *       string matching a template .template in ASSEMBLY_TEMPLATES.
 *
 *   - comboSolutions[index].building_block_svgs:
 *       Either:
 *         { pos2: "<svg...>", pos5: "<svg...>", ... }
 *       Or:
 *         { blocks: { pos2: "<svg...>", ... } }
 *
 * - Optional solution fields:
 *   - comboSolutions[index].unit_width  (number|null): unit width in decimal inches.
 *   - comboSolutions[index].unit_height (number|null): unit height in decimal inches.
 *     When present, dimension annotation lines and fractional-inch labels are
 *     rendered above (width) and to the left (height) of the assembled drawing.
 *     Height arrow span is computed from placement heights: pos2.h + pos5.h
 *     (when pos5 exists and its construction is not "head_detail"). This ensures
 *     the arrow aligns with the actual unit blocks regardless of template letter.
 *     When a head_detail placement exists (pos5 or pos7), a "Head Detail" label
 *     with a short horizontal arrow is drawn to the right of the drawing.
 *     When both are null/falsy, no annotations are drawn and viewBox is unchanged.
 *
 * - Block SVG contract:
 *   - Each block is either an SVG string or an SVGElement.
 *   - Root element MUST be <svg> with a valid viewBox containing numeric width/height.
 *   - Assembler imports child nodes of each block <svg> into translated <g> groups (does NOT nest <svg> elements).
 *
 * Runtime Assumptions:
 * - Called in a browser environment with DOM APIs:
 *     document.createElementNS
 *     DOMParser
 *     XMLSerializer
 *
 * - window.ASSEMBLY_TEMPLATES, window.comboSolutions, and window.build_block_svgs
 *   are defined before invocation.
 *
 * - No reliance on Webflow form redirected controls (w-radio-input, w--redirected-checked, etc.).
 *
 * -------------------------------------------------------------------------
 *
 * Outputs (produces):
 *
 * Public API:
 * - Global functions exposed:
 *     build_assembly_svg(index, muntins, mountTarget)
 *     updateBoreVisibility(boreSide, container)
 *       - boreSide ("left"|"right"): sets display on [data-bore] groups in the mounted SVG.
 *       - container (optional HTMLElement): defaults to last mount target or #explore.
 *       - Called automatically after every mount (cached or fresh) using solution.door_bore || "right".
 *       - Also called by calc-modal.js door bore toggle for instant DOM-only switching.
 *
 *     updateHingeVisibility(construction, boreSide, container)
 *       - construction ("single_door"|"double_door"): determines suppression rules.
 *       - boreSide ("left"|"right"): for single_door, hinges shown opposite bore side.
 *       - container (optional HTMLElement): defaults to last mount target or #explore.
 *       - For double_door: leaf1 left hinges + leaf2 right hinges always shown (outer perimeter).
 *       - Called automatically after every mount and by bore toggle for instant DOM switching.
 *
 *     updateHingeColor(hexColor, container)
 *       - hexColor (string): CSS hex color to apply to all hinge rect fills.
 *       - container (optional HTMLElement): defaults to last mount target or #explore.
 *       - Called automatically after every mount and by hardware color selector change handler.
 *
 *     build_assembly_svg params:
 *       - index (number): position in window.comboSolutions.
 *       - muntins (boolean, optional): when false, renders with rows=1/cols=1 (no muntins).
 *         Defaults to true (use actual rows/cols) if omitted or undefined.
 *       - mountTarget (optional): string ID or HTMLElement to mount into; defaults to #explore.
 *       - Passes muntins through to build_block_svgs(index, muntins).
 *       - If a cached assembly SVG exists for the requested muntin state, mounts it
 *         directly from cache (skips full render pipeline).
 *
 * DOM Mutations:
 * - Replaces the contents of the mount target (default div#explore):
 *     - Removes all existing children.
 *     - Appends one inline <svg> element containing translated <g data-pos="posX"> groups.
 *     - If unit_width/unit_height are present, a <g data-role="dimensions"> group is
 *       appended with arrowed dimension lines and fractional-inch text labels.
 *       The viewBox is expanded to accommodate the annotations.
 *
 * - Wrapper inline styles may be set only if currently unset (as implemented):
 *     explore.style.position = "relative"
 *     explore.style.overflow = "hidden"
 *
 * Data Produced:
 * - Writes to the solution object (dual-cache for muntin toggle):
 *     comboSolutions[index].assembly_svg           (muntins=true: actual rows/cols)
 *     comboSolutions[index].assembly_svg_no_muntins (muntins=false: rows=1, cols=1)
 *
 * - Return value:
 *     { svgElement, svgString, placements, template }
 *     (placements and template are null when returned from cache)
 *
 * -------------------------------------------------------------------------
 *
 * Load Order / Dependencies:
 * - Must load AFTER (or execute AFTER):
 *     window.ASSEMBLY_TEMPLATES
 *     window.comboSolutions
 *     window.build_block_svgs
 *
 * - Must be called AFTER the DOM contains the mount target element
 *   (e.g., after DOMContentLoaded / Webflow initialization).
 *
 * - Does not auto-run on load; it runs only when build_assembly_svg(index) is invoked.
 *
 * -------------------------------------------------------------------------
 *
 * Side Effects:
 * - Network calls (fetch/polling): No
 * - localStorage/cookies: No
 * - Timers / intervals / requestAnimationFrame: No
 * - Event listeners added: No
 *
 * - Console:
 *     console.error("build_assembly_svg failed:", err)
 *     then rethrows the error.
 *
 * -------------------------------------------------------------------------
 *
 * Failure Behavior:
 * - Throws if:
 *     - Required globals are missing or malformed.
 *     - index is out of range.
 *     - solution.assembly_template missing or not found in ASSEMBLY_TEMPLATES.
 *     - Template-required positions are missing from building_block_svgs.
 *     - Any block SVG is not parseable, not <svg>, or missing valid viewBox.
 *     - mount target is missing.
 *     - validateSnap exceeds tolerance.
 *
 * - Current behavior is fail-hard (throw + console error).
 *   Intended production alternative (not implemented here):
 *     console.error + return early without DOM mutation.
 *
 * -------------------------------------------------------------------------
 *
 * Rule Summary / Invariants:
 * - Template selection is driven ONLY by comboSolutions[index].assembly_template.
 * - Placement math relies ONLY on:
 *     template op order
 *     block viewBox width/height
 *
 * - Snap vocabulary limited to:
 *     TL, TR, BL, BR
 *
 * - Blocks are mounted as translated <g> groups.
 *   Block <svg> tags are NOT nested in the output.
 *
 * - Output SVG is constrained to wrapper:
 *     width="100%"
 *     height="100%"
 *     preserveAspectRatio="xMidYMid meet"
 *
 * -------------------------------------------------------------------------
 *
 * Version Notes:
 * - v0 (inferred):
 *     - Browser-only orchestrator.
 *     - Calls build_block_svgs(index) then assembles via data-driven templates.
 *     - Uses comboSolutions[index] as canonical solution record.
 *     - Writes assembly_svg back onto the solution object.
 *     - Renders result as inline DOM SVG inside #explore.
 */
/** Last mount container used by build_assembly_svg, for visibility function fallback. */
var _lastMountContainer = null;

/** Resolves a mount target: DOM element used as-is, string used as getElementById, null/undefined falls back to #explore. */
function _resolveMountTarget(target) {
  if (target instanceof HTMLElement) return target;
  if (typeof target === "string") return document.getElementById(target);
  return _lastMountContainer || document.getElementById("explore");
}

/**
 * Sets the visibility of door bore circles in the mounted SVG.
 * @param {string} boreSide - "left" or "right"
 * @param {HTMLElement} [container] - optional mount container; defaults to last mount target or #explore
 */
function updateBoreVisibility(boreSide, container) {
  var el = container || _resolveMountTarget();
  if (!el) return;
  var boreLeft = el.querySelector('[data-bore="left"]');
  var boreRight = el.querySelector('[data-bore="right"]');
  if (boreLeft) boreLeft.style.display = (boreSide === "left") ? "" : "none";
  if (boreRight) boreRight.style.display = (boreSide === "right") ? "" : "none";
}
window.updateBoreVisibility = updateBoreVisibility;

/**
 * Sets the visibility of door hinge groups in the mounted SVG.
 * @param {string} construction - "single_door" or "double_door"
 * @param {string} boreSide - "left" or "right" (used for single_door to place hinges opposite bore)
 * @param {HTMLElement} [container] - optional mount container; defaults to last mount target or #explore
 */
function updateHingeVisibility(construction, boreSide, container) {
  var el = container || _resolveMountTarget();
  if (!el) return;

  var hingeLeft = el.querySelector('[data-hinge="left"]');
  var hingeRight = el.querySelector('[data-hinge="right"]');

  if (construction === "single_door") {
    // Hinges opposite the bore/handle side
    if (hingeLeft) hingeLeft.style.display = (boreSide === "right") ? "" : "none";
    if (hingeRight) hingeRight.style.display = (boreSide === "left") ? "" : "none";
  } else if (construction === "double_door") {
    // Leaf1 (left door after rotation): show left hinges only
    if (hingeLeft) hingeLeft.style.display = "";
    if (hingeRight) hingeRight.style.display = "none";
    // Leaf2 (right door after rotation): show right hinges only
    var hingeLeft2 = el.querySelector('[data-hinge-leaf2="left"]');
    var hingeRight2 = el.querySelector('[data-hinge-leaf2="right"]');
    if (hingeLeft2) hingeLeft2.style.display = "none";
    if (hingeRight2) hingeRight2.style.display = "";
  }
}
window.updateHingeVisibility = updateHingeVisibility;

/**
 * Updates the fill color of all hinge rects in the mounted SVG.
 * @param {string} hexColor - CSS hex color (e.g., "#D7D7D7")
 * @param {HTMLElement} [container] - optional mount container; defaults to last mount target or #explore
 */
function updateHingeColor(hexColor, container) {
  var el = container || _resolveMountTarget();
  if (!el) return;
  var rects = el.querySelectorAll('[data-hinge] rect, [data-hinge-leaf2] rect');
  for (var i = 0; i < rects.length; i++) {
    rects[i].setAttribute("fill", hexColor);
  }
}
window.updateHingeColor = updateHingeColor;

/**
 * Resolves hardware hex color from HARDWARE_COLORS by name. Defaults to Chrome.
 * Used by the assembler after mount to ensure correct hinge color.
 */
function resolveHardwareHexAssembler(colorName) {
  var colors = window.HARDWARE_COLORS;
  if (Array.isArray(colors)) {
    for (var i = 0; i < colors.length; i++) {
      if (colors[i].name === colorName) return colors[i].color;
    }
    for (var j = 0; j < colors.length; j++) {
      if (colors[j].name === "Chrome") return colors[j].color;
    }
  }
  return "#D7D7D7";
}

/**
 * Determines door type from solution build_objects.
 * Returns "single_door", "double_door", or null.
 */
function getDoorType(solution) {
  if (!solution || !Array.isArray(solution.build_objects)) return null;
  var doorType = null;
  for (var i = 0; i < solution.build_objects.length; i++) {
    var c = String(solution.build_objects[i].construction || "").trim();
    if (c === "double_door") return "double_door";
    if (c === "single_door" || c === "single_door_only" || c === "single") doorType = "single_door";
  }
  return doorType;
}

function build_assembly_svg(index, muntins, mountTarget) {
  try {
    // 1) Validate globals / index
    if (!window.comboSolutions || !Array.isArray(window.comboSolutions)) {
      throw new Error("build_assembly_svg: window.comboSolutions must be an array");
    }
    if (typeof index !== "number" || index < 0 || index >= window.comboSolutions.length) {
      throw new Error(`build_assembly_svg: index out of range: ${index}`);
    }
    if (!window.ASSEMBLY_TEMPLATES || !Array.isArray(window.ASSEMBLY_TEMPLATES)) {
      throw new Error("build_assembly_svg: window.ASSEMBLY_TEMPLATES must be an array");
    }
    if (typeof window.build_block_svgs !== "function") {
      throw new Error("build_assembly_svg: build_block_svgs(index) must exist as a function");
    }

    // Resolve mount target (string, element, or default to #explore)
    var resolvedMount = _resolveMountTarget(mountTarget);

    var useMuntins = (muntins !== false);
    var assemblyCacheKey = useMuntins ? "assembly_svg" : "assembly_svg_no_muntins";
    var blockCacheKey = useMuntins ? "building_block_svgs" : "building_block_svgs_no_muntins";

    const solution = window.comboSolutions[index];

    // 2a) If cached assembly SVG exists, mount it directly and return
    if (solution[assemblyCacheKey]) {
      if (!resolvedMount) throw new Error("build_assembly_svg: could not find mount target");
      _lastMountContainer = resolvedMount;
      if (!resolvedMount.style.position) resolvedMount.style.position = "relative";
      if (!resolvedMount.style.overflow) resolvedMount.style.overflow = "hidden";
      while (resolvedMount.firstChild) resolvedMount.removeChild(resolvedMount.firstChild);

      const cachedDoc = new DOMParser().parseFromString(solution[assemblyCacheKey], "image/svg+xml");
      const cachedSvg = document.importNode(cachedDoc.documentElement, true);
      resolvedMount.appendChild(cachedSvg);

      updateBoreVisibility(solution.door_bore || "right", resolvedMount);

      var cachedDoorType = getDoorType(solution);
      if (cachedDoorType) {
        updateHingeVisibility(cachedDoorType, solution.door_bore || "right", resolvedMount);
        updateHingeColor(resolveHardwareHexAssembler(solution.hardware_color), resolvedMount);
      }

      return { svgElement: cachedSvg, svgString: solution[assemblyCacheKey], placements: null, template: null };
    }

    // 2b) Build blocks first (your helper fills building_block_svgs)
    window.build_block_svgs(index, muntins);

    // 3) Template key is on the parent solution object
    const templateKey = solution.assembly_template;
    if (!templateKey) {
      throw new Error("build_assembly_svg: comboSolutions[index].assembly_template is required");
    }

    const tpl = window.ASSEMBLY_TEMPLATES.find(t => t.template === templateKey);
    if (!tpl) {
      throw new Error(`build_assembly_svg: template "${templateKey}" not found in window.ASSEMBLY_TEMPLATES`);
    }

    // 4) Get blocks map (either direct map or {blocks:{...}})
    const bbs = solution[blockCacheKey];
    if (!bbs || typeof bbs !== "object") {
      throw new Error("build_assembly_svg: comboSolutions[index].building_block_svgs was not created by build_block_svgs()");
    }

    const blocksMap = (bbs.blocks && typeof bbs.blocks === "object") ? bbs.blocks : bbs;
    if (!blocksMap || typeof blocksMap !== "object") {
      throw new Error("build_assembly_svg: building_block_svgs must be an object map like {pos2:'<svg..>', ...}");
    }

    // Ensure required positions exist (template drives requirements)
    for (const pos of (tpl.positions || [])) {
      if (!blocksMap[pos]) {
        throw new Error(`build_assembly_svg: missing building_block_svgs["${pos}"] required by template "${templateKey}"`);
      }
    }

    // 5) Normalize blocks -> { svgEl, vb:{w,h} }
    const blockObjs = {};
    for (const pos of Object.keys(blocksMap)) {
      blockObjs[pos] = normalizeBlockSvg(blocksMap[pos], pos);
    }

    // placements[pos] = { x, y, w, h, svgEl }
    const placements = {};

    // 6) Execute template ops
    for (const op of (tpl.ops || [])) {
      if (!op || typeof op !== "object") continue;

      if (op.op === "place") {
        const pos = op.pos;
        const at = op.at || { x: 0, y: 0 };
        requirePos(blockObjs, pos, "place");

        placements[pos] = {
          x: num(at.x),
          y: num(at.y),
          w: blockObjs[pos].vb.w,
          h: blockObjs[pos].vb.h,
          svgEl: blockObjs[pos].svgEl
        };
        continue;
      }

      if (op.op === "snap") {
        const pos = op.pos;
        const toPos = op.toPos;

        requirePos(blockObjs, pos, "snap");
        requirePos(blockObjs, toPos, "snap");
        requirePlacement(placements, toPos, "snap target must already be placed");

        const myCorner = op.my;       // TL/TR/BL/BR
        const theirCorner = op.their; // TL/TR/BL/BR
        const offset = op.offset || { x: 0, y: 0 };

        const toPlacement = placements[toPos];
        const toPt = cornerPoint(toPlacement, theirCorner);

        const myW = blockObjs[pos].vb.w;
        const myH = blockObjs[pos].vb.h;

        const solved = solvePlacementFromCorner(toPt, myCorner, myW, myH);

        placements[pos] = {
          x: solved.x + num(offset.x),
          y: solved.y + num(offset.y),
          w: myW,
          h: myH,
          svgEl: blockObjs[pos].svgEl
        };
        continue;
      }

      if (op.op === "validateSnap") {
        const pos = op.pos;
        const toPos = op.toPos;

        requirePlacement(placements, pos, "validateSnap pos must already be placed");
        requirePlacement(placements, toPos, "validateSnap target must already be placed");

        const tol = (op.tolerance != null) ? num(op.tolerance) : 0.01;

        const aPt = cornerPoint(placements[pos], op.my);
        const bPt = cornerPoint(placements[toPos], op.their);

        const dx = Math.abs(aPt.x - bPt.x);
        const dy = Math.abs(aPt.y - bPt.y);

        if (dx > tol || dy > tol) {
          throw new Error(
            `validateSnap failed: ${pos}.${op.my} (${aPt.x.toFixed(4)},${aPt.y.toFixed(4)}) ` +
            `!= ${toPos}.${op.their} (${bPt.x.toFixed(4)},${bPt.y.toFixed(4)}) ` +
            `dx=${dx.toFixed(4)} dy=${dy.toFixed(4)} tol=${tol}`
          );
        }
        continue;
      }

      throw new Error(`build_assembly_svg: unknown op "${op.op}" in template "${templateKey}"`);
    }

    // 7) Compute master bounds and build final INLINE DOM <svg>
    const bounds = computeBounds(placements);

    const root = document.createElementNS(SVG_NS, "svg");
    // Namespace declarations (helps when blocks contain xlink:href)
    root.setAttributeNS(XMLNS_NS, "xmlns", SVG_NS);
    root.setAttributeNS(XMLNS_NS, "xmlns:xlink", XLINK_NS);

    // 8) Append each block's children into a translated <g>
    // NOTE: We do NOT nest <svg> tags; we import each block's child nodes.
    for (const pos of Object.keys(placements)) {
      const p = placements[pos];

      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("data-pos", pos);
      g.setAttribute("transform", `translate(${p.x},${p.y})`);

      const blockSvg = p.svgEl;
      const children = Array.from(blockSvg.childNodes);
      for (const ch of children) {
        g.appendChild(ch.cloneNode(true));
      }

      root.appendChild(g);
    }

    // 8a) Compute arrow height from pos2 (+ pos5 if it's not a head_detail)
    var arrowHeight = 0;
    var pos5IsHD = false;
    if (placements["pos2"]) arrowHeight = placements["pos2"].h;
    if (placements["pos5"]) {
      if (Array.isArray(solution.build_objects)) {
        for (var bi = 0; bi < solution.build_objects.length; bi++) {
          var bo = solution.build_objects[bi];
          if (bo && bo.block_pos === "pos5" && String(bo.construction || "").trim() === "head_detail") {
            pos5IsHD = true;
            break;
          }
        }
      }
      if (!pos5IsHD) arrowHeight += placements["pos5"].h;
    }

    // 8b) Find head_detail placement (if any) for label annotation
    var hdPlacement = null;
    if (pos5IsHD && placements["pos5"]) {
      hdPlacement = placements["pos5"];
    } else if (placements["pos7"]) {
      // Check if pos7 is head_detail (some templates may use pos7)
      if (Array.isArray(solution.build_objects)) {
        for (var hbi = 0; hbi < solution.build_objects.length; hbi++) {
          var hbo = solution.build_objects[hbi];
          if (hbo && hbo.block_pos === "pos7" && String(hbo.construction || "").trim() === "head_detail") {
            hdPlacement = placements["pos7"];
            break;
          }
        }
      }
    }

    // 8c) Append dimension annotations (width above, height to left, HD label to right)
    var dimMargins = appendDimensionAnnotations(
      root, bounds, solution.unit_width, solution.unit_height, arrowHeight, hdPlacement
    );

    // 8d) Set viewBox expanded by dimension margins
    var vbX = bounds.minX - dimMargins.leftMargin;
    var vbY = bounds.minY - dimMargins.topMargin;
    var vbW = bounds.w + dimMargins.leftMargin + dimMargins.rightMargin;
    var vbH = bounds.h + dimMargins.topMargin;
    root.setAttribute("viewBox", vbX + " " + vbY + " " + vbW + " " + vbH);

    // ✅ CONSTRAIN TO WRAPPER DIV
    root.setAttribute("width", "100%");
    root.setAttribute("height", "100%");
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
    root.style.display = "block"; // removes inline baseline gap
    root.style.maxWidth = "100%";
    root.style.maxHeight = "100%";

    // 9) Store serialized SVG string on the solution object
    const svgString = new XMLSerializer().serializeToString(root);
    solution[assemblyCacheKey] = svgString;

    // 10) INSERT INLINE SVG into mount target (DOM element insertion)
    if (!resolvedMount) {
      throw new Error("build_assembly_svg: could not find mount target");
    }
    _lastMountContainer = resolvedMount;

    // Ensure wrapper behaves like a container
    // (Won’t override your CSS if you already set it.)
    if (!resolvedMount.style.position) resolvedMount.style.position = "relative";
    if (!resolvedMount.style.overflow) resolvedMount.style.overflow = "hidden";

    while (resolvedMount.firstChild) resolvedMount.removeChild(resolvedMount.firstChild);
    resolvedMount.appendChild(root);

    updateBoreVisibility(solution.door_bore || "right", resolvedMount);

    var freshDoorType = getDoorType(solution);
    if (freshDoorType) {
      updateHingeVisibility(freshDoorType, solution.door_bore || "right", resolvedMount);
      updateHingeColor(resolveHardwareHexAssembler(solution.hardware_color), resolvedMount);
    }

    return { svgElement: root, svgString, placements, template: tpl };
  } catch (err) {
    console.error("build_assembly_svg failed:", err);
    throw err;
  }
}

/* ---------------- REQUIRED HELPERS ---------------- */

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

function normalizeBlockSvg(svgInput, pos) {
  let svgEl;

  if (svgInput instanceof SVGElement) {
    svgEl = svgInput;
  } else if (typeof svgInput === "string") {
    svgEl = parseSvgString(svgInput);
  } else {
    throw new Error(`normalizeBlockSvg: building_block_svgs["${pos}"] must be an SVGElement or SVG string`);
  }

  if (!svgEl || svgEl.tagName.toLowerCase() !== "svg") {
    throw new Error(`normalizeBlockSvg: building_block_svgs["${pos}"] root must be <svg>`);
  }

  const vb = parseViewBox(svgEl.getAttribute("viewBox"));
  if (!vb) {
    throw new Error(`normalizeBlockSvg: building_block_svgs["${pos}"] missing/invalid viewBox`);
  }

  // Only need width/height for snapping
  return { svgEl, vb: { w: vb.w, h: vb.h } };
}

function parseSvgString(str) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, "image/svg+xml");
  const err = doc.querySelector("parsererror");
  if (err) {
    throw new Error("parseSvgString: SVG parse error: " + err.textContent);
  }

  const svgEl = doc.documentElement;

  // Add namespaces for safety (esp. xlink:href)
  if (!svgEl.getAttribute("xmlns")) svgEl.setAttribute("xmlns", SVG_NS);
  if (!svgEl.getAttribute("xmlns:xlink")) svgEl.setAttribute("xmlns:xlink", XLINK_NS);

  return svgEl;
}

function parseViewBox(vbStr) {
  if (!vbStr) return null;
  const parts = vbStr.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return null;
  const [x, y, w, h] = parts;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function cornerPoint(placement, corner) {
  const { x, y, w, h } = placement;
  switch (corner) {
    case "TL": return { x: x,     y: y };
    case "TR": return { x: x + w, y: y };
    case "BL": return { x: x,     y: y + h };
    case "BR": return { x: x + w, y: y + h };
    default:
      throw new Error(`cornerPoint: unknown corner "${corner}" (use TL/TR/BL/BR)`);
  }
}

function solvePlacementFromCorner(targetPt, myCorner, w, h) {
  switch (myCorner) {
    case "TL": return { x: targetPt.x,     y: targetPt.y };
    case "TR": return { x: targetPt.x - w, y: targetPt.y };
    case "BL": return { x: targetPt.x,     y: targetPt.y - h };
    case "BR": return { x: targetPt.x - w, y: targetPt.y - h };
    default:
      throw new Error(`solvePlacementFromCorner: unknown corner "${myCorner}" (use TL/TR/BL/BR)`);
  }
}

function computeBounds(placements) {
  const keys = Object.keys(placements);
  if (keys.length === 0) return { minX: 0, minY: 0, w: 0, h: 0 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const p = placements[k];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

function requirePos(blockObjs, pos, context) {
  if (!blockObjs[pos]) throw new Error(`${context}: missing block for "${pos}"`);
}
function requirePlacement(placements, pos, msg) {
  if (!placements[pos]) throw new Error(`${msg}: "${pos}"`);
}
function num(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/* ---------- DIMENSION ANNOTATION HELPERS ---------- */

var DIM_FRACTION_TABLE = [
  [1/16, "1/16"], [1/8, "1/8"], [3/16, "3/16"], [1/4, "1/4"],
  [5/16, "5/16"], [3/8, "3/8"], [7/16, "7/16"], [1/2, "1/2"],
  [9/16, "9/16"], [5/8, "5/8"], [11/16, "11/16"], [3/4, "3/4"],
  [13/16, "13/16"], [7/8, "7/8"], [15/16, "15/16"],
];

/** Mirrors decimalToFraction() in calc-combo-results.js */
function dimToFraction(val) {
  if (val == null || val === "") return "";
  var n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  var whole = Math.floor(n);
  var rem = Math.round((n - whole) * 16) / 16;
  if (rem === 0) return whole + '\u2033';
  if (rem >= 1) return (whole + 1) + '\u2033';
  var frac = DIM_FRACTION_TABLE.find(function(v) { return Math.abs(v[0] - rem) < 0.001; });
  var fracStr = frac ? frac[1] : rem.toString();
  return whole > 0 ? whole + '-' + fracStr + '\u2033' : fracStr + '\u2033';
}

function dimLine(parent, x1, y1, x2, y2, sw, color) {
  var line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", sw);
  line.setAttribute("stroke-linecap", "butt");
  parent.appendChild(line);
}

function dimText(parent, x, y, str, size, color) {
  var t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("dominant-baseline", "auto");
  t.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
  t.setAttribute("font-size", size);
  t.setAttribute("fill", color);
  t.textContent = str;
  parent.appendChild(t);
}

function dimTextRotated(parent, x, y, str, size, color) {
  var t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("dominant-baseline", "central");
  t.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
  t.setAttribute("font-size", size);
  t.setAttribute("fill", color);
  t.setAttribute("transform", "rotate(-90," + x + "," + y + ")");
  t.textContent = str;
  parent.appendChild(t);
}

/**
 * Appends width/height dimension annotation lines and labels to the
 * assembled SVG. Returns margin amounts needed to expand the viewBox.
 *
 * @param {SVGElement}  root        - The assembled <svg> element
 * @param {Object}      bounds      - { minX, minY, w, h } of the full drawing
 * @param {number|null} widthIn     - Unit width in decimal inches
 * @param {number|null} heightIn    - Unit height in decimal inches
 * @param {number}      arrowHeight   - Height arrow span in SVG units (pos2.h + pos5.h if not head_detail)
 * @param {Object|null} hdPlacement   - Placement {x,y,w,h} of head_detail block (null if none)
 * @returns {{ topMargin: number, leftMargin: number, rightMargin: number }}
 */
function appendDimensionAnnotations(root, bounds, widthIn, heightIn, arrowHeight, hdPlacement) {
  if (!widthIn && !heightIn) return { topMargin: 0, leftMargin: 0 };

  var maxDim   = Math.max(bounds.w, bounds.h);
  var strokeW  = maxDim * 0.003;
  var arrowLen = maxDim * 0.012;
  var fontSize = maxDim * 0.028;
  var gap      = maxDim * 0.036;
  var textPad  = maxDim * 0.012;
  var hTextPad = textPad + maxDim * 0.0094;

  var topMargin  = gap + strokeW + textPad + fontSize * 1.2;
  var leftMargin = gap + strokeW + hTextPad + fontSize * 3;

  var color = "#333333";
  var g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("data-role", "dimensions");

  // --- Width dimension (horizontal line above drawing) ---
  if (widthIn) {
    var lineY = bounds.minY - gap;
    var x1 = bounds.minX;
    var x2 = bounds.minX + bounds.w;

    // Main horizontal line
    dimLine(g, x1, lineY, x2, lineY, strokeW, color);

    // Left arrowhead — outward-pointing (tip at left edge, arms go inward)
    dimLine(g, x1, lineY, x1 + arrowLen, lineY - arrowLen, strokeW, color);
    dimLine(g, x1, lineY, x1 + arrowLen, lineY + arrowLen, strokeW, color);

    // Right arrowhead — outward-pointing (tip at right edge, arms go inward)
    dimLine(g, x2, lineY, x2 - arrowLen, lineY - arrowLen, strokeW, color);
    dimLine(g, x2, lineY, x2 - arrowLen, lineY + arrowLen, strokeW, color);

    // Label centered above the line
    var textX = bounds.minX + bounds.w / 2;
    var textY = lineY - textPad;
    dimText(g, textX, textY, dimToFraction(widthIn), fontSize, color);
  }

  // --- Height dimension (vertical line left of drawing) ---
  // Anchored at the bottom of the drawing; extends upward by arrowHeight
  // (pos2.h + pos5.h when pos5 is not head_detail). This aligns the arrow
  // with the actual unit, excluding any head_detail block above.
  if (heightIn) {
    var lineX = bounds.minX - gap;
    var y2 = bounds.minY + bounds.h;
    var y1 = y2 - arrowHeight;

    // Main vertical line
    dimLine(g, lineX, y1, lineX, y2, strokeW, color);

    // Top arrowhead — outward-pointing (tip at top edge, arms go downward)
    dimLine(g, lineX, y1, lineX - arrowLen, y1 + arrowLen, strokeW, color);
    dimLine(g, lineX, y1, lineX + arrowLen, y1 + arrowLen, strokeW, color);

    // Bottom arrowhead — outward-pointing (tip at bottom edge, arms go upward)
    dimLine(g, lineX, y2, lineX - arrowLen, y2 - arrowLen, strokeW, color);
    dimLine(g, lineX, y2, lineX + arrowLen, y2 - arrowLen, strokeW, color);

    // Label centered between arrow endpoints, rotated -90deg
    var textCX = lineX - hTextPad;
    var textCY = (y1 + y2) / 2;
    dimTextRotated(g, textCX, textCY, dimToFraction(heightIn), fontSize, color);
  }

  // --- Head detail label (horizontal arrow + text to the right of drawing) ---
  var rightMargin = 0;
  if (hdPlacement) {
    var hdCenterY = hdPlacement.y + hdPlacement.h / 2;
    var hdRightX  = bounds.minX + bounds.w;
    var arrowStartX = hdRightX + gap;
    var hdArrowLen  = maxDim * 0.04;
    var arrowEndX   = arrowStartX + hdArrowLen;

    // Horizontal arrow line
    dimLine(g, arrowStartX, hdCenterY, arrowEndX, hdCenterY, strokeW, color);

    // Left arrowhead (tip at left, arms go right)
    dimLine(g, arrowStartX, hdCenterY, arrowStartX + arrowLen, hdCenterY - arrowLen, strokeW, color);
    dimLine(g, arrowStartX, hdCenterY, arrowStartX + arrowLen, hdCenterY + arrowLen, strokeW, color);

    // "Head Detail" label to the right of the arrow
    var hdLabelX = arrowEndX + textPad;
    var hdLabel = document.createElementNS(SVG_NS, "text");
    hdLabel.setAttribute("x", hdLabelX);
    hdLabel.setAttribute("y", hdCenterY);
    hdLabel.setAttribute("text-anchor", "start");
    hdLabel.setAttribute("dominant-baseline", "central");
    hdLabel.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
    hdLabel.setAttribute("font-size", fontSize);
    hdLabel.setAttribute("fill", color);
    hdLabel.textContent = "Head Detail";
    g.appendChild(hdLabel);

    rightMargin = gap + hdArrowLen + textPad + fontSize * 7;
  }

  root.appendChild(g);

  return {
    topMargin:  widthIn  ? topMargin  : 0,
    leftMargin: heightIn ? leftMargin : 0,
    rightMargin: rightMargin
  };
}