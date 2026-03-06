/**
 * File:
 * combo-assembly-templates-json.js
 *
 * Role:
 * ASSET/DATA
 *
 * Purpose:
 * - Defines all available assembly layout templates used to combine building block SVGs.
 * - Exposes a single global: window.ASSEMBLY_TEMPLATES.
 * - Provides declarative layout instructions (place/snap/validateSnap) consumed by the SVG assembler.
 *
 * Context:
 * - Browser-delivered via jsDelivr using the custom bootstrap loader.
 * - Pure data file (no computation).
 * - Must load before calc-svg-block-assembler.js executes.
 * - Replaces earlier Node.js file-based template loading.
 *
 * -------------------------------------------------------------------------
 *
 * Source of truth:
 * - Authoritative:
 *   - window.ASSEMBLY_TEMPLATES array defined in this file.
 *
 * - Derived elsewhere:
 *   - Layout math performed in calc-svg-block-assembler.js.
 *   - Snap validation performed at runtime using block viewBox dimensions.
 *
 * -------------------------------------------------------------------------
 *
 * Inputs (reads):
 *
 * DOM Contract:
 * - None.
 *
 * Data Contract:
 * - None (standalone asset file).
 *
 * Runtime Assumptions:
 * - Runs in browser global scope.
 * - window object exists.
 *
 * -------------------------------------------------------------------------
 *
 * Outputs (produces):
 *
 * Public API:
 * - window.HARDWARE_COLORS (Array)
 *   Each object: { name: string, color: string (hex) }
 *   Used by calc-combo-results.js and calc-svg-block-builder.js for hinge fill colors.
 *
 * - window.ASSEMBLY_TEMPLATES (Array)
 *
 * Each template object contains:
 *
 *   template: string
 *     - Unique identifier (e.g., "A", "BLHD", "GHD").
 *     - Must match comboSolutions[index].assembly_template.
 *
 *   description: string
 *     - Human-readable explanation of layout intent.
 *
 *   door_bore: "left" | "right"
 *     - Default bore side for single-door solutions using this template.
 *     - Consumed by ensureDoorBoreDefault() in calc-combo-results.js.
 *
 *   positions: string[]
 *     - Ordered list of block position keys required by this template.
 *     - These must exist in solution.building_block_svgs.
 *
 *   ops: Array of operation objects executed sequentially by assembler.
 *
 * Operation types:
 *
 *   { op: "place", pos, at:{x,y} }
 *     - Establishes initial anchor position.
 *
 *   { op: "snap", pos, my, toPos, their, offset? }
 *     - Aligns one block to another using corner anchors.
 *
 *   { op: "validateSnap", pos, my, toPos, their, tolerance }
 *     - Ensures aligned edges match within tolerance.
 *     - Current tolerance value in this file: 2.00 (SVG coordinate units).
 *
 * -------------------------------------------------------------------------
 *
 * Load Order / Dependencies:
 * - Must load BEFORE:
 *     calc-svg-block-assembler.js
 *
 * - Must load BEFORE:
 *     Any call to build_assembly_svg(index)
 *
 * - No dependency on DOM readiness.
 *
 * -------------------------------------------------------------------------
 *
 * Side Effects:
 * - Assigns globals:
 *     window.HARDWARE_COLORS
 *     window.ASSEMBLY_TEMPLATES
 *
 * - Optional console.log for sanity check.
 *
 * - No:
 *     - Network calls
 *     - Timers
 *     - Event listeners
 *     - localStorage access
 *
 * -------------------------------------------------------------------------
 *
 * Failure Behavior:
 * - If this file fails to load:
 *     build_assembly_svg will throw:
 *       "window.ASSEMBLY_TEMPLATES must be defined"
 *
 * - If a template is malformed:
 *     Assembler may throw during execution (missing pos, invalid op, etc.).
 *
 * -------------------------------------------------------------------------
 *
 * Rule Summary / Invariants:
 * - Template names must be unique.
 * - Template.template string MUST match solution.assembly_template exactly.
 * - positions array must include every pos referenced in ops.
 * - ops are executed strictly in array order.
 * - Snap vocabulary is limited to TL, TR, BL, BR.
 * - validateSnap tolerance currently set to 2.00 SVG units.
 * - This file contains zero layout math — only declarative instructions.
 *
 * -------------------------------------------------------------------------
 *
 * Version Notes:
 * - v0 (inferred):
 *     - Browser global asset replacing Node-based template file loading.
 *     - Tolerance increased to 2.00 (from earlier 0.01 in development phase).
 *     - Delivered via CDN bootstrap loader.
 */
window.HARDWARE_COLORS = [
  {
    "name": "Chrome",
    "color": "#D7D7D7"
  },
  {
    "name": "Satin Nickel",
    "color": "#B8B8B3"
  },
  {
    "name": "Bright Brass",
    "color": "#D4AF37"
  },
  {
    "name": "Satin Brass",
    "color": "#C9A227"
  },
  {
    "name": "Oil-Rubbed Bronze",
    "color": "#4A3B2A"
  },
];

window.ASSEMBLY_TEMPLATES = [
  {
    "template": "A",
    "description": "Template A: pos5 (transom) stacked above pos2 (door or cased opening).",
    "door_bore": "left",
    "positions": ["pos2", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "AHD",
    "description": "AHD: pos2 with pos5 above it, and pos7 above pos5 (stacked transoms).",
    "door_bore": "left",
    "positions": ["pos2", "pos5", "pos7"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 },
      { "op": "snap", "pos": "pos7", "my": "BL", "toPos": "pos5", "their": "TL" },
      { "op": "validateSnap", "pos": "pos7", "my": "BR", "toPos": "pos5", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "BL",
    "description": "assembly_BL: pos1 to the left of pos2.",
    "door_bore": "left",
    "positions": ["pos1", "pos2"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" }
    ]
  },
  {
    "template": "BLHD",
    "description": "BLHD: pos1 left of pos2; pos5 spans above pos1+pos2.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos1", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "BR",
    "description": "assembly_BR: pos3 to the right of pos2.",
    "door_bore": "right",
    "positions": ["pos2", "pos3"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" }
    ]
  },
  {
    "template": "BRHD",
    "description": "BRHD: pos2 with pos3 on right; pos5 spans above them.",
    "door_bore": "right",
    "positions": ["pos2", "pos3", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos3", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "C",
    "description": "assembly_C: pos1 left of pos2, pos3 right of pos2 (no transoms).",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos3"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" }
    ]
  },
  {
    "template": "CHD",
    "description": "CHD: pos1 left of pos2 and pos3 right of pos2; pos5 spans above all three.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos3", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos1", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos3", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "DL",
    "description": "Template DL: pos1 (left sidelight) next to pos2 (main unit), with pos5 (transom) spanning across both.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos1", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "DLHD",
    "description": "DLHD: pos1 on left of pos2; pos5 spans above them; pos7 spans above pos5.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos5", "pos7"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos1", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 },
      { "op": "snap", "pos": "pos7", "my": "BL", "toPos": "pos5", "their": "TL" },
      { "op": "validateSnap", "pos": "pos7", "my": "BR", "toPos": "pos5", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "DR",
    "description": "Template DR: pos2 with pos3 to the right, and pos5 (transom) spanning across both.",
    "door_bore": "right",
    "positions": ["pos2", "pos3", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos3", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "DRHD",
    "description": "DRHD: pos2 with pos3 on right; pos5 spans above them; pos7 spans above pos5.",
    "door_bore": "right",
    "positions": ["pos2", "pos3", "pos5", "pos7"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos3", "their": "TR", "tolerance": 2.00 },
      { "op": "snap", "pos": "pos7", "my": "BL", "toPos": "pos5", "their": "TL" },
      { "op": "validateSnap", "pos": "pos7", "my": "BR", "toPos": "pos5", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "EL",
    "description": "assembly_EL: pos1 left of pos2; pos4 above pos1; pos5 above pos2.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos4", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos4", "my": "BL", "toPos": "pos1", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "ELHD",
    "description": "ELHD: pos1 on left of pos2; pos6 above pos1; pos5 above pos2; pos7 spans across top.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos5", "pos6", "pos7"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos6", "my": "BL", "toPos": "pos1", "their": "TL" },
      { "op": "snap", "pos": "pos7", "my": "BL", "toPos": "pos6", "their": "TL" },
      { "op": "validateSnap", "pos": "pos7", "my": "BR", "toPos": "pos5", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "ER",
    "description": "assembly_ER: pos3 right of pos2; pos5 above pos2; pos6 above pos3.",
    "door_bore": "right",
    "positions": ["pos2", "pos3", "pos5", "pos6"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos6", "my": "BL", "toPos": "pos3", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "ERHD",
    "description": "ERHD: pos2 with pos3 on right; pos5 above pos2; pos6 above pos3; pos7 spans across top.",
    "door_bore": "right",
    "positions": ["pos2", "pos3", "pos5", "pos6", "pos7"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos6", "my": "BL", "toPos": "pos3", "their": "TL" },
      { "op": "snap", "pos": "pos7", "my": "BL", "toPos": "pos5", "their": "TL" },
      { "op": "validateSnap", "pos": "pos7", "my": "BR", "toPos": "pos6", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "F",
    "description": "assembly_F: pos1 left of pos2, pos3 right of pos2, pos5 transom spanning across pos1+pos2+pos3.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos3", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR", "offset": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos1", "their": "TL", "offset": { "x": 0, "y": 0 } },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos3", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "FHD",
    "description": "FHD: pos1|pos2|pos3 with pos5 spanning above them, and pos7 spanning above pos5.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos3", "pos5", "pos7"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos1", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos3", "their": "TR", "tolerance": 2.00 },
      { "op": "snap", "pos": "pos7", "my": "BL", "toPos": "pos5", "their": "TL" },
      { "op": "validateSnap", "pos": "pos7", "my": "BR", "toPos": "pos5", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "G",
    "description": "assembly_G: pos1 left of pos2, pos3 right of pos2; pos4 above pos1; pos5 above pos2; pos6 above pos3.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos3", "pos4", "pos5", "pos6"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" },
      { "op": "snap", "pos": "pos4", "my": "BL", "toPos": "pos1", "their": "TL" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos6", "my": "BL", "toPos": "pos3", "their": "TL" },
      { "op": "validateSnap", "pos": "pos4", "my": "BR", "toPos": "pos1", "their": "TR", "tolerance": 2.00 },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 },
      { "op": "validateSnap", "pos": "pos6", "my": "BR", "toPos": "pos3", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "GHD",
    "description": "GHD: pos1|pos2|pos3 with pos4/pos5/pos6 above them, and pos7 spanning across the top.",
    "door_bore": "left",
    "positions": ["pos1", "pos2", "pos3", "pos4", "pos5", "pos6", "pos7"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" },
      { "op": "snap", "pos": "pos4", "my": "BL", "toPos": "pos1", "their": "TL" },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "snap", "pos": "pos6", "my": "BL", "toPos": "pos3", "their": "TL" },
      { "op": "snap", "pos": "pos7", "my": "BL", "toPos": "pos4", "their": "TL" },
      { "op": "validateSnap", "pos": "pos7", "my": "BR", "toPos": "pos6", "their": "TR", "tolerance": 2.00 }
    ]
  },
  {
    "template": "ZHD",
    "description": "ZHD: pos5 transom above pos2.",
    "door_bore": "left",
    "positions": ["pos2", "pos5"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos5", "my": "BL", "toPos": "pos2", "their": "TL" },
      { "op": "validateSnap", "pos": "pos5", "my": "BR", "toPos": "pos2", "their": "TR", "tolerance": 2.00 }
    ]
  }
];

// Optional sanity log (safe to remove)
console.log("Assembly templates loaded:", window.ASSEMBLY_TEMPLATES.length);