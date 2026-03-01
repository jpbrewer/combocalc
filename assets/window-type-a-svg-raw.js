/**
 * File:
 *  window-type-a-svg-raw.js
 *
 * Role:
 *  ASSET/DATA
 *
 * Purpose:
 *  - Defines the canonical “Window Type A” SVG template as a raw string.
 *  - Publishes that template globally as `window.WINDOW_TYPE_A_SVG_TEXT`.
 *  - Serves as the structural contract between the Inkscape-authored drawing
 *    and the in-browser SVG rendering engine.
 *
 * Context:
 *  - Delivered via jsDelivr (GitHub-backed CDN) using a sequential script loader
 *    embedded in Webflow.
 *  - This file is loaded dynamically in a controlled order alongside other
 *    calc-* modules.
 *  - It replaces a former Node.js file-system asset pipeline and exists purely
 *    as browser-consumable template data.
 *
 * Source of truth:
 *  - Authoritative:
 *      - The literal SVG markup contained in `window.WINDOW_TYPE_A_SVG_TEXT`.
 *      - All element IDs and group IDs inside the SVG.
 *  - Derived:
 *      - All geometry resizing, bevel generation, muntin layout,
 *        pattern application, and transforms are performed by downstream
 *        renderer logic (e.g., calc-svg-block-builder.js).
 *
 * Inputs (reads):
 *
 *  DOM Contract:
 *  - None.
 *  - This file does not read or modify the page DOM.
 *
 *  Data Contract:
 *  - None.
 *  - This file defines data but does not depend on other globals.
 *
 *  Runtime Assumptions:
 *  - Executed in a browser environment where `window` exists.
 *  - Loaded before any renderer module that reads
 *    `window.WINDOW_TYPE_A_SVG_TEXT`.
 *
 * Outputs (produces):
 *
 *  Public API:
 *  - window.WINDOW_TYPE_A_SVG_TEXT (string)
 *
 *  DOM Mutations:
 *  - None.
 *
 *  Data Produced:
 *  - A single global string containing the full SVG template markup.
 *
 * Load Order / Dependencies:
 *  - Must load BEFORE:
 *      - calc-svg-block-builder.js
 *      - calc-svg-block-assembler.js
 *    or any module that parses the template via DOMParser.
 *  - Loaded sequentially via jsDelivr using a custom script bootstrap.
 *  - Has no dependency on DOMContentLoaded or Webflow initialization.
 *
 * Side Effects:
 *  - Network calls: No (network handled externally by jsDelivr loader).
 *  - localStorage/cookies: No.
 *  - Timers / intervals: No.
 *  - Event listeners: No.
 *
 * Failure Behavior:
 *  - If this file fails to load:
 *      - Renderer modules that expect `window.WINDOW_TYPE_A_SVG_TEXT`
 *        will throw errors when attempting to parse it.
 *  - If required SVG IDs/groups are renamed or removed:
 *      - Renderer will fail-fast when querying expected IDs.
 *
 * Rule Summary / Invariants:
 *  - The following SVG IDs are treated as a stable contract and must remain unchanged:
 *      - g#render_root
 *      - g#glass_area
 *      - g#bevel_prototypes
 *      - g#muntin_prototypes
 *      - g#sash
 *      - g#unit
 *      - rect#outside_boundary_sash
 *      - rect#outside_boundary_unit
 *      - rect#rail_top
 *      - rect#rail_bottom
 *      - rect#stile_left
 *      - rect#stile_right
 *      - rect#jamb_top
 *      - rect#jamb_bottom
 *      - rect#jamb_left
 *      - rect#jamb_right
 *      - rect#daylight_rect
 *      - rect#muntin_vertical_proto
 *      - rect#muntin_horizontal_proto
 *      - path#bevel_top_proto
 *  - Prototype shapes must remain in the template even if hidden at runtime.
 *  - All geometry is expected to exist under g#render_root so the renderer
 *    can apply a single transform.
 *
 * Version Notes:
 *  - v0: CDN-delivered template wrapper for browser-based SVG rendering.
 *  - Structured for dynamic sequential loading via jsDelivr.
 *  - Acts as a stable template contract for calc-svg-block-builder.js.
 */
  window.WINDOW_TYPE_A_SVG_TEXT = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="14000"
   height="14000"
   viewBox="0 0 14000 14000"
   version="1.1"
   id="svg1"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <defs
     id="defs1" />
  <g
     id="render_root">
    <g
       id="glass_area">
      <rect
         style="fill:#000000;fill-opacity:0.2;stroke:none;stroke-width:1.94715;stroke-dasharray:none;stroke-opacity:1"
         id="daylight_rect"
         width="2544"
         height="816"
         x="794.05243"
         y="416.25494" />
    </g>
    <g
       id="bevel_prototypes">
      <rect
         style="display:inline;fill:#000000;fill-opacity:0.431122;stroke:none;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         id="bevel_lite_proto"
         width="1440"
         height="384"
         x="1898.0525"
         y="416.25494" />
      <path
         id="bevel_right_proto"
         style="fill:#000000;fill-opacity:0.431122;stroke-width:0.755906"
         d="m 3338.0525,416.25494 -36,36 v 312 l 36,36 z" />
      <path
         id="bevel_left_proto"
         style="fill:#000000;fill-opacity:0.431122;stroke-width:0.755906"
         d="m 1898.0525,416.25494 v 384 l 36,-36 v -312 z" />
      <path
         id="bevel_bottom_proto"
         style="fill:#000000;fill-opacity:0.431122;stroke-width:0.755906"
         d="m 1934.0527,764.25586 -36,36 h 1440 l -36,-36 z" />
      <path
         id="bevel_top_proto"
         style="fill:#000000;fill-opacity:0.431122;stroke-width:0.755906"
         d="m 1898.0527,416.25586 36,36 h 1368 l 36,-36 z" />
    </g>
    <g
       id="muntin_prototypes">
      <rect
         style="fill:#000000;fill-opacity:0.497449;stroke:none;stroke-width:0.264999;stroke-dasharray:none;stroke-opacity:1"
         id="muntin_horizontal_proto"
         width="2544"
         height="42"
         x="794.05249"
         y="800.25494" />
      <rect
         style="fill:#000000;fill-opacity:0.497449;stroke:none;stroke-width:0.272924;stroke-dasharray:none;stroke-opacity:1"
         id="muntin_vertical_proto"
         width="42"
         height="816"
         x="1856.0525"
         y="416.25494" />
    </g>
    <g
       id="sash">
      <rect
         style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:1.94832;stroke-dasharray:none;stroke-opacity:1"
         id="stile_right"
         width="168"
         height="816"
         x="3338.0525"
         y="416.25494" />
      <rect
         style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:1.94832;stroke-dasharray:none;stroke-opacity:1"
         id="stile_left"
         width="168"
         height="816"
         x="626.05249"
         y="416.25494" />
      <rect
         style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.265;stroke-dasharray:none;stroke-opacity:1"
         id="rail_bottom"
         width="2880"
         height="168"
         x="626.05249"
         y="1232.2549" />
      <rect
         style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-opacity:1"
         id="rail_top"
         width="2880"
         x="626.05249"
         y="248.25493"
         height="168" />
      <rect
         style="fill:none;stroke:#000000;stroke-width:0.264583;stroke-opacity:1"
         id="outside_boundary_sash"
         height="1152"
         x="626.05237"
         y="248.25493"
         width="2880" />
    </g>
    <g
       id="unit">
      <rect
         style="fill:none;stroke:#000000;stroke-width:0.264583;stroke-opacity:1"
         id="outside_boundary_unit"
         height="1296"
         x="554.05225"
         y="176.25491"
         width="3024" />
      <rect
         style="fill:#000000;fill-opacity:0.535714;stroke:none;stroke-width:1.94832;stroke-dasharray:none;stroke-opacity:1"
         id="jamb_right"
         width="72"
         height="1152"
         x="554.05231"
         y="248.25493" />
      <rect
         style="fill:#000000;fill-opacity:0.535714;stroke:none;stroke-width:1.94832;stroke-dasharray:none;stroke-opacity:1"
         id="jamb_left"
         width="72"
         height="1152"
         x="3506.0522"
         y="248.25493" />
      <rect
         style="fill:#000000;fill-opacity:0.649351;stroke:none;stroke-width:0.264583;stroke-opacity:1"
         id="jamb_bottom"
         width="3024"
         x="554.05231"
         y="1400.255"
         height="72" />
      <rect
         style="fill:#000000;fill-opacity:0.649351;stroke:none;stroke-width:0.264583;stroke-opacity:1"
         id="jamb_top"
         width="3024"
         x="554.05231"
         y="176.25491"
         height="72" />
    </g>
  </g>
</svg>
`;

  // (optional quick sanity check)
  // console.log("WINDOW_TYPE_A_SVG_TEMPLATE length:", window.WINDOW_TYPE_A_SVG_TEMPLATE.length);