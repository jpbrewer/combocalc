/**
 * Global assembly template definitions
 * Available anywhere after this script runs:
 *   window.ASSEMBLY_TEMPLATES
 */
window.ASSEMBLY_TEMPLATES = [
  {
    "template": "A",
    "description": "Template A: pos5 (transom) stacked above pos2 (door or cased opening).",
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
    "positions": ["pos1", "pos2"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos1", "my": "TR", "toPos": "pos2", "their": "TL" }
    ]
  },
  {
    "template": "BLHD",
    "description": "BLHD: pos1 left of pos2; pos5 spans above pos1+pos2.",
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
    "positions": ["pos2", "pos3"],
    "ops": [
      { "op": "place", "pos": "pos2", "at": { "x": 0, "y": 0 } },
      { "op": "snap", "pos": "pos3", "my": "TL", "toPos": "pos2", "their": "TR" }
    ]
  },
  {
    "template": "BRHD",
    "description": "BRHD: pos2 with pos3 on right; pos5 spans above them.",
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