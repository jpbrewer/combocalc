/**
 * DROP-IN: build_block_svgs(index)
 *
 * TEMPLATE:
 *   window.WINDOW_TYPE_A_SVG_TEXT  (string containing full SVG template)
 *
 * INPUT:
 *   window.comboSolutions[index].build_objects  (array of block request objects)
 *
 * OUTPUT:
 *   window.comboSolutions[index].building_block_svgs  (object map)
 *     { "pos2": "<svg...>", "pos5": "<svg...>", ... }
 *
 * PATTERN PNG SOURCES (Webflow CDN):
 *   Put 6 <img> tags somewhere on the page with these IDs:
 *     img_rail_wood          -> rail_wood.png
 *     img_stile_wood         -> stile_wood.png
 *     img_bevel_top_wood     -> bevel_top_wood.png
 *     img_bevel_bottom_wood  -> bevel_bottom_wood.png
 *     img_bevel_side_wood    -> bevel_side_wood.png
 *     img_glass              -> glass.png
 *
 * FIX INCLUDED (your latest request):
 * - If construction === "double_door", the upstream model supplies the TOTAL combined width.
 *   We divide the INPUT width by 2 so each leaf slab is the correct size.
 */

// ---------------- EXECUTION CONFIG ----------------
const DISPLAY_SCALE = 0.1;
const AUTO_FIT_VIEWBOX = true;

const INCLUDE_JAMB = true;
const JAMB_MARGIN = 72;

const STRICT_BEVEL_THICKNESS = true;
const MEETING_GAP = 2;

// Tile sizes in SVG user units
const PATTERN_TILE = {
  rail: { w: 13824, h: 2304 },
  stile: { w: 13824, h: 2304 },
  bevelTop: { w: 13824, h: 2304 },
  bevelBottom: { w: 13824, h: 2304 },
  bevelSide: { w: 13824, h: 2304 },
  glass: { w: 13824, h: 2304 },
};

// Boundary styling
const BOUNDARY_STROKE_PX = 1;
const BOUNDARY_STROKE_COLOR = "#000000";
const BOUNDARY_STROKE_OPACITY = 0.25;

// Units: if build_objects are inches, set 96. If already in SVG units, set 1.
const PX_PER_INCH = 96;
// -----------------------------------------------

// ---------------- BASIC UTILS ----------------
function toPx(v) { return Number(v) * PX_PER_INCH; }

function mustBeArray(v, name) {
  if (!Array.isArray(v)) throw new Error(`${name} must be an array.`);
  return v;
}
function mustInt(v, name) {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer.`);
  return n;
}
function mustIntGte1(v, name) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be an integer >= 1.`);
  return n;
}
function mustFinite(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number.`);
  return n;
}
function mustStr(v, name) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${name} must be a non-empty string.`);
  return s;
}
// ---------------------------------------------

// ---------------- PATTERN URL HELPERS ----------------
const PATTERN_IMG_IDS = {
  rail: "img_rail_wood",
  stile: "img_stile_wood",
  bevelTop: "img_bevel_top_wood",
  bevelBottom: "img_bevel_bottom_wood",
  bevelSide: "img_bevel_side_wood",
  glass: "img_glass",
};

function getPatternUrlsFromDom() {
  function mustGet(id) {
    const img = document.getElementById(id);
    if (!img) throw new Error(`Missing <img id="${id}"> on page (pattern preload).`);
    const url = img.currentSrc || img.src;
    if (!url) throw new Error(`Image "${id}" has no resolved URL yet.`);
    return url;
  }
  return {
    rail: mustGet(PATTERN_IMG_IDS.rail),
    stile: mustGet(PATTERN_IMG_IDS.stile),
    bevelTop: mustGet(PATTERN_IMG_IDS.bevelTop),
    bevelBottom: mustGet(PATTERN_IMG_IDS.bevelBottom),
    bevelSide: mustGet(PATTERN_IMG_IDS.bevelSide),
    glass: mustGet(PATTERN_IMG_IDS.glass),
  };
}

function waitForPatternImages() {
  const ids = Object.values(PATTERN_IMG_IDS);
  const imgs = ids.map((id) => document.getElementById(id));
  if (imgs.some((x) => !x)) {
    const missing = ids.filter((id) => !document.getElementById(id));
    throw new Error(`Missing pattern preload <img> ids: ${missing.join(", ")}`);
  }

  const ready = () => imgs.every((img) => img.complete && (img.currentSrc || img.src));
  if (ready()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let remaining = imgs.length;
    function doneOne() {
      remaining--;
      if (remaining <= 0) resolve();
    }
    imgs.forEach((img) => {
      if (img.complete) return doneOne();
      img.addEventListener("load", doneOne, { once: true });
      img.addEventListener("error", () => reject(new Error("A pattern image failed to load.")), { once: true });
    });
  });
}
// ---------------------------------------------

// ---------------- SVG DOM HELPERS ----------------
function qsById(doc, id) { return doc.getElementById(id); }

function setStyleProp(el, prop, value) {
  if (!el) return;
  const style = el.getAttribute("style") || "";
  const parts = style
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.toLowerCase().startsWith(prop.toLowerCase() + ":"));
  parts.push(`${prop}:${value}`);
  el.setAttribute("style", parts.join(";"));
}

function removeStyleProps(el, props) {
  if (!el) return;
  const style = el.getAttribute("style") || "";
  const out = style
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => {
      const key = (s.split(":")[0] || "").trim().toLowerCase();
      return key && !props.includes(key);
    })
    .join(";");
  if (out) el.setAttribute("style", out);
  else el.removeAttribute("style");
}

function hideEl(el) { if (el) setStyleProp(el, "display", "none"); }
function showEl(el) {
  if (!el) return;
  const style = (el.getAttribute("style") || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^display\s*:/i.test(s) || !/none/i.test(s));
  if (style.length) el.setAttribute("style", style.join(";"));
  else el.removeAttribute("style");
}

function ensureDefs(doc) {
  let defs = doc.querySelector("svg > defs");
  if (!defs) {
    defs = doc.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.setAttribute("id", "defs_auto");
    doc.documentElement.insertBefore(defs, doc.documentElement.firstChild);
  }
  return defs;
}

function addExternalPngPattern(doc, patternId, href, tile) {
  const defs = ensureDefs(doc);

  const existing = defs.querySelector(`#${CSS.escape(patternId)}`);
  if (existing) existing.remove();

  const svgNS = "http://www.w3.org/2000/svg";
  const xlinkNS = "http://www.w3.org/1999/xlink";

  const pat = doc.createElementNS(svgNS, "pattern");
  pat.setAttribute("id", patternId);
  pat.setAttribute("patternUnits", "userSpaceOnUse");
  pat.setAttribute("x", "0");
  pat.setAttribute("y", "0");
  pat.setAttribute("width", String(tile.w));
  pat.setAttribute("height", String(tile.h));

  const img = doc.createElementNS(svgNS, "image");
  img.setAttribute("x", "0");
  img.setAttribute("y", "0");
  img.setAttribute("width", String(tile.w));
  img.setAttribute("height", String(tile.h));
  img.setAttribute("preserveAspectRatio", "none");
  img.setAttribute("href", href);
  img.setAttributeNS(xlinkNS, "xlink:href", href);

  pat.appendChild(img);
  defs.appendChild(pat);
}

function applyPatternFill(el, patternId) {
  if (!el) return;
  el.setAttribute("fill", `url(#${patternId})`);
  removeStyleProps(el, ["fill", "fill-opacity"]);
}

function applyBoundaryStroke(el) {
  if (!el) return;
  showEl(el);
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", BOUNDARY_STROKE_COLOR);
  el.setAttribute("stroke-width", String(BOUNDARY_STROKE_PX));
  el.setAttribute("stroke-opacity", String(BOUNDARY_STROKE_OPACITY));
  el.setAttribute("vector-effect", "non-scaling-stroke");
  removeStyleProps(el, ["display", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "vector-effect"]);
}

function suppressStroke(el) {
  if (!el) return;
  showEl(el);
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", "none");
  el.setAttribute("stroke-opacity", "0");
  removeStyleProps(el, ["stroke", "stroke-width", "stroke-opacity", "vector-effect"]);
}

function bringToFront(el) {
  if (!el || !el.parentNode) return;
  el.parentNode.appendChild(el);
}

// Path parsing for bevel thickness extraction
function tokenizePath(d) {
  const tokens = [];
  const re = /([a-zA-Z])|([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) tokens.push({ type: "cmd", value: m[1] });
    else tokens.push({ type: "num", value: Number(m[2]) });
  }
  return tokens;
}

function extractBevelThicknessFromPath(d) {
  const tokens = tokenizePath(d);
  let i = 0;

  function readPoint() {
    if (i + 1 >= tokens.length) return null;
    if (tokens[i].type !== "num" || tokens[i + 1].type !== "num") return null;
    const x = tokens[i].value;
    const y = tokens[i + 1].value;
    i += 2;
    return { x, y };
  }

  while (i < tokens.length && !(tokens[i].type === "cmd" && (tokens[i].value === "M" || tokens[i].value === "m"))) i++;
  if (i >= tokens.length) throw new Error("Could not find M/m in bevel_top_proto path.");
  const moveCmd = tokens[i].value;
  i++;

  const p0 = readPoint();
  if (!p0) throw new Error("Could not read first moveto point from bevel_top_proto path.");

  if (i < tokens.length && tokens[i].type === "num") {
    const p1 = readPoint();
    if (!p1) throw new Error("Could not read implicit lineto point after M/m.");
    if (moveCmd === "m") return Math.min(Math.abs(p1.x), Math.abs(p1.y));
    return Math.min(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
  }

  while (i < tokens.length && !(tokens[i].type === "cmd" && (tokens[i].value === "L" || tokens[i].value === "l"))) i++;
  if (i >= tokens.length) throw new Error("Could not find L/l after M/m in bevel_top_proto path.");
  const lineCmd = tokens[i].value;
  i++;

  const p1 = readPoint();
  if (!p1) throw new Error("Could not read lineto point after L/l.");
  if (lineCmd === "l") return Math.min(Math.abs(p1.x), Math.abs(p1.y));
  return Math.min(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
}

function buildBevelPathsForLite(lite, t, strict) {
  const { x, y, w, h } = lite;

  if (strict && (w < 2 * t || h < 2 * t)) {
    throw new Error(
      `Lite too small for constant bevel thickness t=${t}. Lite w=${w}, h=${h} (need w>=${2 * t}, h>=${2 * t}).`
    );
  }

  const tt = strict ? t : Math.min(t, w / 2, h / 2);
  const f = (n) => Number(n.toFixed(6));

  return {
    top: `M ${f(x)} ${f(y)} L ${f(x + tt)} ${f(y + tt)} L ${f(x + w - tt)} ${f(y + tt)} L ${f(x + w)} ${f(y)} Z`,
    bottom: `M ${f(x + tt)} ${f(y + h - tt)} L ${f(x)} ${f(y + h)} L ${f(x + w)} ${f(y + h)} L ${f(x + w - tt)} ${f(y + h - tt)} Z`,
    left: `M ${f(x)} ${f(y)} L ${f(x + tt)} ${f(y + tt)} L ${f(x + tt)} ${f(y + h - tt)} L ${f(x)} ${f(y + h)} Z`,
    right: `M ${f(x + w)} ${f(y)} L ${f(x + w - tt)} ${f(y + tt)} L ${f(x + w - tt)} ${f(y + h - tt)} L ${f(x + w)} ${f(y + h)} Z`,
  };
}

function applyFinalTransformAndViewBox(svgEl, renderRootEl, fit, rotated) {
  if (!AUTO_FIT_VIEWBOX) return;

  const { x, y, w, h } = fit;

  if (!rotated) {
    renderRootEl.setAttribute("transform", `translate(${-x} ${-y})`);
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svgEl.setAttribute("width", String(w * DISPLAY_SCALE));
    svgEl.setAttribute("height", String(h * DISPLAY_SCALE));
  } else {
    renderRootEl.setAttribute("transform", `translate(0 ${w}) rotate(-90) translate(${-x} ${-y})`);
    svgEl.setAttribute("viewBox", `0 0 ${h} ${w}`);
    svgEl.setAttribute("width", String(h * DISPLAY_SCALE));
    svgEl.setAttribute("height", String(w * DISPLAY_SCALE));
  }
}

function normalizeConstruction(c) {
  const s = String(c || "").trim();
  if (s === "single_door" || s === "single_door_only" || s === "single") return "door";
  if (s === "window") return "transom"; // legacy safety
  return s;
}

function cloneAndTranslate(el, newId, yOff) {
  const c = el.cloneNode(true);
  c.setAttribute("id", newId);
  if (c.hasAttribute("y")) c.setAttribute("y", String(parseFloat(c.getAttribute("y")) + yOff));
  else c.setAttribute("transform", `translate(0 ${yOff})`);
  return c;
}
// ---------------------------------------------

// ---------------- CORE RENDER (one block -> svg string) ----------------
function renderOneBlockToSvgString(block, patternUrls) {
  if (!window.WINDOW_TYPE_A_SVG_TEXT || typeof window.WINDOW_TYPE_A_SVG_TEXT !== "string") {
    throw new Error("window.WINDOW_TYPE_A_SVG_TEXT is missing or not a string.");
  }

  const doc = new DOMParser().parseFromString(window.WINDOW_TYPE_A_SVG_TEXT, "image/svg+xml");
  const svgEl = doc.documentElement;

  const renderRootEl = qsById(doc, "render_root");
  const glassAreaEl = qsById(doc, "glass_area");
  const bevelProtosEl = qsById(doc, "bevel_prototypes");
  const muntinProtosEl = qsById(doc, "muntin_prototypes");
  const sashGroup = qsById(doc, "sash");

  if (!renderRootEl) throw new Error("Template missing g#render_root");
  if (!glassAreaEl) throw new Error("Template missing g#glass_area");
  if (!bevelProtosEl) throw new Error("Template missing g#bevel_prototypes");
  if (!muntinProtosEl) throw new Error("Template missing g#muntin_prototypes");
  if (!sashGroup) throw new Error("Template missing g#sash");

  const sashBoundary = qsById(doc, "outside_boundary_sash");
  const unitBoundary = qsById(doc, "outside_boundary_unit");

  const railTop = qsById(doc, "rail_top");
  const railBottom = qsById(doc, "rail_bottom");
  const stileLeft = qsById(doc, "stile_left");
  const stileRight = qsById(doc, "stile_right");

  const daylight = qsById(doc, "daylight_rect");

  const jambTop = qsById(doc, "jamb_top");
  const jambBottom = qsById(doc, "jamb_bottom");
  const jambLeft = qsById(doc, "jamb_left");
  const jambRight = qsById(doc, "jamb_right");
  const unitGroup = qsById(doc, "unit");

  const vProto = qsById(doc, "muntin_vertical_proto");
  const hProto = qsById(doc, "muntin_horizontal_proto");

  const bevelTopProto = qsById(doc, "bevel_top_proto");
  const bevelBottomProto = qsById(doc, "bevel_bottom_proto");
  const bevelLeftProto = qsById(doc, "bevel_left_proto");
  const bevelRightProto = qsById(doc, "bevel_right_proto");
  const bevelLiteProto = qsById(doc, "bevel_lite_proto");

  if (!sashBoundary || !unitBoundary) throw new Error("Template missing outside boundaries");
  if (!railTop || !railBottom || !stileLeft || !stileRight) throw new Error("Template missing rails/stiles");
  if (!daylight) throw new Error("Template missing daylight_rect");
  if (!jambTop || !jambBottom || !jambLeft || !jambRight || !unitGroup) throw new Error("Template missing jamb/unit");
  if (!vProto || !hProto) throw new Error("Template missing muntin prototypes");
  if (!bevelTopProto) throw new Error("Template missing bevel_top_proto");

  const blockPos = mustStr(block.block_pos, "build_objects[].block_pos");
  const CONSTRUCTION = normalizeConstruction(mustStr(block.construction, "build_objects[].construction"));

  const IS_CO = CONSTRUCTION === "co";
  const IS_DOUBLE_DOOR = CONSTRUCTION === "double_door";
  const IS_DOORLIKE = CONSTRUCTION === "door" || IS_CO || IS_DOUBLE_DOOR;

  const IS_ROTATED =
    (CONSTRUCTION === "door" || CONSTRUCTION === "sidelite" || CONSTRUCTION === "co" || CONSTRUCTION === "double_door");

  // ✅ FIX: upstream supplies TOTAL width for double_door; we need per-leaf width.
  let inputWidthIn = mustFinite(block.width, `(${blockPos}) width`);
  const inputHeightIn = mustFinite(block.height, `(${blockPos}) height`);
  if (IS_DOUBLE_DOOR) inputWidthIn = inputWidthIn / 2;

  const INPUT_WIDTH = toPx(inputWidthIn);
  const INPUT_HEIGHT = toPx(inputHeightIn);

  const INPUT_ROWS = mustIntGte1(block.rows, `(${blockPos}) rows`);
  const INPUT_COLS = mustIntGte1(block.cols, `(${blockPos}) cols`);

  const SR_TOP = toPx(mustFinite(block.sr_top, `(${blockPos}) sr_top`));
  const SR_LEFT = toPx(mustFinite(block.sr_left, `(${blockPos}) sr_left`));
  const SR_BOTTOM = toPx(mustFinite(block.sr_bottom, `(${blockPos}) sr_bottom`));
  const SR_RIGHT = toPx(mustFinite(block.sr_right, `(${blockPos}) sr_right`));

  // Pre-rotation mapping of SRs
  let EXEC_TOP = SR_TOP, EXEC_LEFT = SR_LEFT, EXEC_BOTTOM = SR_BOTTOM, EXEC_RIGHT = SR_RIGHT;
  if (IS_ROTATED) {
    EXEC_RIGHT = SR_TOP;
    EXEC_BOTTOM = SR_RIGHT;
    EXEC_LEFT = SR_BOTTOM;
    EXEC_TOP = SR_LEFT;
  }

  // Size transpose for rotated modes
  const LEAF_WIDTH = IS_ROTATED ? INPUT_HEIGHT : INPUT_WIDTH;
  const LEAF_HEIGHT = IS_ROTATED ? INPUT_WIDTH : INPUT_HEIGHT;

  // Grid transpose for rotated modes
  const GRID_ROWS = IS_ROTATED ? INPUT_COLS : INPUT_ROWS;
  const GRID_COLS = IS_ROTATED ? INPUT_ROWS : INPUT_COLS;

  // Double door: stack vertically BEFORE rotation
  const LEAF_COUNT = IS_DOUBLE_DOOR ? 2 : 1;
  const LEAF_PITCH_Y = LEAF_HEIGHT + (LEAF_COUNT > 1 ? MEETING_GAP : 0);

  const ASSEMBLY_SASH_WIDTH = LEAF_WIDTH;
  const ASSEMBLY_SASH_HEIGHT =
    LEAF_COUNT === 1 ? LEAF_HEIGHT : (LEAF_HEIGHT * LEAF_COUNT) + (MEETING_GAP * (LEAF_COUNT - 1));

  // Anchor from template
  const sx = parseFloat(sashBoundary.getAttribute("x"));
  const sy = parseFloat(sashBoundary.getAttribute("y"));

  // Leaf1 boundary size
  sashBoundary.setAttribute("width", String(LEAF_WIDTH));
  sashBoundary.setAttribute("height", String(LEAF_HEIGHT));

  // Validate
  if (EXEC_TOP + EXEC_BOTTOM >= LEAF_HEIGHT) throw new Error(`(${blockPos}) Top+Bottom too large for leaf height.`);
  if (EXEC_LEFT + EXEC_RIGHT >= LEAF_WIDTH) throw new Error(`(${blockPos}) Left+Right too large for leaf width.`);

  // Rails / stiles (leaf 1)
  railTop.setAttribute("x", String(sx));
  railTop.setAttribute("y", String(sy));
  railTop.setAttribute("width", String(LEAF_WIDTH));
  railTop.setAttribute("height", String(EXEC_TOP));

  railBottom.setAttribute("x", String(sx));
  railBottom.setAttribute("y", String(sy + LEAF_HEIGHT - EXEC_BOTTOM));
  railBottom.setAttribute("width", String(LEAF_WIDTH));
  railBottom.setAttribute("height", String(EXEC_BOTTOM));

  stileLeft.setAttribute("x", String(sx));
  stileLeft.setAttribute("y", String(sy + EXEC_TOP));
  stileLeft.setAttribute("width", String(EXEC_LEFT));
  stileLeft.setAttribute("height", String(LEAF_HEIGHT - EXEC_TOP - EXEC_BOTTOM));

  stileRight.setAttribute("x", String(sx + LEAF_WIDTH - EXEC_RIGHT));
  stileRight.setAttribute("y", String(sy + EXEC_TOP));
  stileRight.setAttribute("width", String(EXEC_RIGHT));
  stileRight.setAttribute("height", String(LEAF_HEIGHT - EXEC_TOP - EXEC_BOTTOM));

  // Daylight (leaf 1)
  const dx0 = sx + EXEC_LEFT;
  const dy0 = sy + EXEC_TOP;
  const dw0 = LEAF_WIDTH - EXEC_LEFT - EXEC_RIGHT;
  const dh0 = LEAF_HEIGHT - EXEC_TOP - EXEC_BOTTOM;

  daylight.setAttribute("x", String(dx0));
  daylight.setAttribute("y", String(dy0));
  daylight.setAttribute("width", String(dw0));
  daylight.setAttribute("height", String(dh0));
  if (IS_CO) hideEl(daylight); else showEl(daylight);

  // Unit sizing (full assembly)
  const ux = sx - JAMB_MARGIN;
  const uy = sy - JAMB_MARGIN;
  const uw = ASSEMBLY_SASH_WIDTH + (JAMB_MARGIN * 2);
  const uh = ASSEMBLY_SASH_HEIGHT + (JAMB_MARGIN * 2);

  unitBoundary.setAttribute("x", String(ux));
  unitBoundary.setAttribute("y", String(uy));
  unitBoundary.setAttribute("width", String(uw));
  unitBoundary.setAttribute("height", String(uh));

  jambTop.setAttribute("x", String(ux));
  jambTop.setAttribute("y", String(uy));
  jambTop.setAttribute("width", String(uw));
  jambTop.setAttribute("height", String(JAMB_MARGIN));

  jambBottom.setAttribute("x", String(ux));
  jambBottom.setAttribute("y", String(sy + ASSEMBLY_SASH_HEIGHT));
  jambBottom.setAttribute("width", String(uw));
  jambBottom.setAttribute("height", String(JAMB_MARGIN));

  jambLeft.setAttribute("x", String(ux));
  jambLeft.setAttribute("y", String(uy + JAMB_MARGIN));
  jambLeft.setAttribute("width", String(JAMB_MARGIN));
  jambLeft.setAttribute("height", String(ASSEMBLY_SASH_HEIGHT));

  jambRight.setAttribute("x", String(sx + ASSEMBLY_SASH_WIDTH));
  jambRight.setAttribute("y", String(uy + JAMB_MARGIN));
  jambRight.setAttribute("width", String(JAMB_MARGIN));
  jambRight.setAttribute("height", String(ASSEMBLY_SASH_HEIGHT));

  if (IS_DOORLIKE) hideEl(jambLeft);
  INCLUDE_JAMB ? showEl(unitGroup) : hideEl(unitGroup);

  // ---- Patterns: defs patterns with CDN URLs ----
  addExternalPngPattern(doc, "pat_rail_wood", patternUrls.rail, PATTERN_TILE.rail);
  addExternalPngPattern(doc, "pat_stile_wood", patternUrls.stile, PATTERN_TILE.stile);
  addExternalPngPattern(doc, "pat_bevel_top", patternUrls.bevelTop, PATTERN_TILE.bevelTop);
  addExternalPngPattern(doc, "pat_bevel_bottom", patternUrls.bevelBottom, PATTERN_TILE.bevelBottom);
  addExternalPngPattern(doc, "pat_bevel_side", patternUrls.bevelSide, PATTERN_TILE.bevelSide);
  addExternalPngPattern(doc, "pat_glass", patternUrls.glass, PATTERN_TILE.glass);

  // Apply fills to base parts (leaf 1)
  applyPatternFill(jambTop, "pat_rail_wood");
  applyPatternFill(jambBottom, "pat_rail_wood");
  applyPatternFill(railTop, "pat_rail_wood");
  applyPatternFill(railBottom, "pat_rail_wood");

  applyPatternFill(jambRight, "pat_stile_wood");
  applyPatternFill(jambLeft, "pat_stile_wood");
  applyPatternFill(stileLeft, "pat_stile_wood");
  applyPatternFill(stileRight, "pat_stile_wood");

  applyPatternFill(daylight, "pat_glass");

  // Boundary strokes
  applyBoundaryStroke(unitBoundary);
  if (IS_CO) suppressStroke(sashBoundary);
  else applyBoundaryStroke(sashBoundary);

  // Keep boundaries on top
  bringToFront(unitBoundary);
  bringToFront(sashBoundary);

  // Hide prototypes in final output
  hideEl(vProto);
  hideEl(hProto);
  if (bevelTopProto) hideEl(bevelTopProto);
  if (bevelBottomProto) hideEl(bevelBottomProto);
  if (bevelLeftProto) hideEl(bevelLeftProto);
  if (bevelRightProto) hideEl(bevelRightProto);
  if (bevelLiteProto) hideEl(bevelLiteProto);

  // CO hides everything inside sash bbox and skips muntins/bevels
  if (IS_CO) {
    hideEl(railTop);
    hideEl(railBottom);
    hideEl(stileLeft);
    hideEl(stileRight);
  }

  // Build leaf2 base geometry for double_door (patterns already handled)
  if (!IS_CO && IS_DOUBLE_DOOR) {
    const yOff = LEAF_PITCH_Y;

    const railTop2 = cloneAndTranslate(railTop, "rail_top_leaf2", yOff);
    const railBottom2 = cloneAndTranslate(railBottom, "rail_bottom_leaf2", yOff);
    const stileLeft2 = cloneAndTranslate(stileLeft, "stile_left_leaf2", yOff);
    const stileRight2 = cloneAndTranslate(stileRight, "stile_right_leaf2", yOff);
    const sashBoundary2 = cloneAndTranslate(sashBoundary, "outside_boundary_sash_leaf2", yOff);

    applyPatternFill(railTop2, "pat_rail_wood");
    applyPatternFill(railBottom2, "pat_rail_wood");
    applyPatternFill(stileLeft2, "pat_stile_wood");
    applyPatternFill(stileRight2, "pat_stile_wood");

    applyBoundaryStroke(sashBoundary2);
    bringToFront(sashBoundary2);

    sashGroup.appendChild(railTop2);
    sashGroup.appendChild(railBottom2);
    sashGroup.appendChild(stileLeft2);
    sashGroup.appendChild(stileRight2);
    sashGroup.appendChild(sashBoundary2);

    const glass2 = cloneAndTranslate(daylight, "daylight_rect_leaf2", yOff);
    glass2.setAttribute("x", String(dx0));
    glass2.setAttribute("y", String(dy0 + yOff));
    glass2.setAttribute("width", String(dw0));
    glass2.setAttribute("height", String(dh0));
    applyPatternFill(glass2, "pat_glass");
    glassAreaEl.appendChild(glass2);
  }

  // Generate muntins + bevels (skipped for co)
  if (!IS_CO) {
    const vT = parseFloat(vProto.getAttribute("width"));
    const hT = parseFloat(hProto.getAttribute("height"));
    const bevelT = extractBevelThicknessFromPath(bevelTopProto.getAttribute("d"));

    const existingBevels = bevelProtosEl.querySelector("#bevels_generated");
    if (existingBevels) existingBevels.remove();
    const existingMuntins = muntinProtosEl.querySelector("#muntins_generated");
    if (existingMuntins) existingMuntins.remove();

    const svgNS = "http://www.w3.org/2000/svg";
    const bevelsG = doc.createElementNS(svgNS, "g");
    bevelsG.setAttribute("id", "bevels_generated");

    const muntinsG = doc.createElementNS(svgNS, "g");
    muntinsG.setAttribute("id", "muntins_generated");

    for (let leafIndex = 0; leafIndex < LEAF_COUNT; leafIndex++) {
      const leafYOffset = LEAF_PITCH_Y * leafIndex;

      const dx = dx0;
      const dy = dy0 + leafYOffset;
      const dw = dw0;
      const dh = dh0;

      if (vT * (GRID_COLS - 1) >= dw) throw new Error(`(${blockPos}) Too many cols for muntin thickness.`);
      if (hT * (GRID_ROWS - 1) >= dh) throw new Error(`(${blockPos}) Too many rows for muntin thickness.`);

      const liteW = (dw - vT * (GRID_COLS - 1)) / GRID_COLS;
      const liteH = (dh - hT * (GRID_ROWS - 1)) / GRID_ROWS;

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const lite = { x: dx + c * (liteW + vT), y: dy + r * (liteH + hT), w: liteW, h: liteH };
          const b = buildBevelPathsForLite(lite, bevelT, STRICT_BEVEL_THICKNESS);
          const id = `leaf${leafIndex + 1}_r${r}_c${c}`;

          const pTop = doc.createElementNS(svgNS, "path");
          pTop.setAttribute("id", `bevel_top_${id}`);
          pTop.setAttribute("d", b.top);
          pTop.setAttribute("fill", "url(#pat_bevel_top)");

          const pRight = doc.createElementNS(svgNS, "path");
          pRight.setAttribute("id", `bevel_right_${id}`);
          pRight.setAttribute("d", b.right);
          pRight.setAttribute("fill", "url(#pat_bevel_side)");

          const pBottom = doc.createElementNS(svgNS, "path");
          pBottom.setAttribute("id", `bevel_bottom_${id}`);
          pBottom.setAttribute("d", b.bottom);
          pBottom.setAttribute("fill", "url(#pat_bevel_bottom)");

          const pLeft = doc.createElementNS(svgNS, "path");
          pLeft.setAttribute("id", `bevel_left_${id}`);
          pLeft.setAttribute("d", b.left);
          pLeft.setAttribute("fill", "url(#pat_bevel_side)");

          bevelsG.appendChild(pTop);
          bevelsG.appendChild(pRight);
          bevelsG.appendChild(pBottom);
          bevelsG.appendChild(pLeft);
        }
      }

      for (let c = 1; c < GRID_COLS; c++) {
        const v = doc.createElementNS(svgNS, "rect");
        v.setAttribute("id", `muntin_v_leaf${leafIndex + 1}_${c}`);
        v.setAttribute("x", String(dx + c * liteW + (c - 1) * vT));
        v.setAttribute("y", String(dy));
        v.setAttribute("width", String(vT));
        v.setAttribute("height", String(dh));
        v.setAttribute("fill", "url(#pat_stile_wood)");
        muntinsG.appendChild(v);
      }

      for (let r = 1; r < GRID_ROWS; r++) {
        const y = dy + r * liteH + (r - 1) * hT;
        for (let c = 0; c < GRID_COLS; c++) {
          const h = doc.createElementNS(svgNS, "rect");
          h.setAttribute("id", `muntin_h_leaf${leafIndex + 1}_${r}_${c}`);
          h.setAttribute("x", String(dx + c * (liteW + vT)));
          h.setAttribute("y", String(y));
          h.setAttribute("width", String(liteW));
          h.setAttribute("height", String(hT));
          h.setAttribute("fill", "url(#pat_rail_wood)");
          muntinsG.appendChild(h);
        }
      }
    }

    bevelProtosEl.appendChild(bevelsG);
    muntinProtosEl.appendChild(muntinsG);
  }

  const fit = INCLUDE_JAMB
    ? { x: ux, y: uy, w: uw, h: uh }
    : { x: sx, y: sy, w: ASSEMBLY_SASH_WIDTH, h: ASSEMBLY_SASH_HEIGHT };

  applyFinalTransformAndViewBox(svgEl, renderRootEl, fit, IS_ROTATED);

  return new XMLSerializer().serializeToString(svgEl);
}
// -------------------------------------------------------------

/**
 * build_block_svgs(index)
 */
window.build_block_svgs = function build_block_svgs(index) {
  if (!window.comboSolutions || !Array.isArray(window.comboSolutions)) {
    throw new Error("window.comboSolutions is missing or not an array.");
  }
  index = mustInt(index, "index");
  if (index < 0 || index >= window.comboSolutions.length) {
    throw new Error("build_block_svgs(index): index out of range.");
  }

  const solution = window.comboSolutions[index];
  if (!solution || typeof solution !== "object") throw new Error("comboSolutions[index] is not an object.");

  const buildObjects = mustBeArray(solution.build_objects, "comboSolutions[index].build_objects");
  if (buildObjects.length === 0) throw new Error("comboSolutions[index].build_objects is empty.");

  if (solution.building_block_svgs && Object.keys(solution.building_block_svgs).length > 0) {
    return solution.building_block_svgs; // already rendered
  }

  const patternUrls = getPatternUrlsFromDom();

  solution.building_block_svgs = {};

  for (const block of buildObjects) {
    if (!block || typeof block !== "object") continue;
    const pos = mustStr(block.block_pos, "build_objects[].block_pos");
    const svgString = renderOneBlockToSvgString(block, patternUrls);
    solution.building_block_svgs[pos] = svgString;
  }

  return solution.building_block_svgs;
};