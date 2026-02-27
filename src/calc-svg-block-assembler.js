/**
 * FULL DROP-IN (browser):
 * - build_assembly_svg(index): builds + inserts an INLINE DOM <svg> into #explore
 * - SVG is constrained to wrapper div (fills 100% of wrapper) and preserves aspect ratio.
 *
 * Requires:
 *   window.ASSEMBLY_TEMPLATES = [ {template, positions, ops}, ... ]
 *   window.comboSolutions = [ { assembly_template, building_block_svgs, ... }, ... ]
 *   window.build_block_svgs(index) populates comboSolutions[index].building_block_svgs
 *
 * Notes:
 * - #explore MUST have an explicit height (CSS) or the SVG will collapse/behave oddly.
 *   Example CSS:  #explore { width:100%; height:400px; }
 */

function build_assembly_svg(index) {
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

    const solution = window.comboSolutions[index];

    // 2) Build blocks first (your helper fills building_block_svgs)
    window.build_block_svgs(index);

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
    const bbs = solution.building_block_svgs;
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

    root.setAttribute("viewBox", `${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`);

    // ✅ CONSTRAIN TO WRAPPER DIV
    root.setAttribute("width", "100%");
    root.setAttribute("height", "100%");
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
    root.style.display = "block"; // removes inline baseline gap
    root.style.maxWidth = "100%";
    root.style.maxHeight = "100%";

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

    // 9) Store serialized SVG string on the solution object
    const svgString = new XMLSerializer().serializeToString(root);
    solution.assembly_svg = svgString;

    // 10) INSERT INLINE SVG into #explore (DOM element insertion)
    const explore = document.getElementById("explore");
    if (!explore) {
      throw new Error('build_assembly_svg: could not find div#explore');
    }

    // Ensure wrapper behaves like a container
    // (Won’t override your CSS if you already set it.)
    if (!explore.style.position) explore.style.position = "relative";
    if (!explore.style.overflow) explore.style.overflow = "hidden";

    while (explore.firstChild) explore.removeChild(explore.firstChild);
    explore.appendChild(root);

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