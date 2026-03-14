# SVG Pipeline Overview

## 1. Entry point functions

There are **two public entry points**, called in sequence:

| Function | File | Role |
|---|---|---|
| `window.build_block_svgs(index, muntins)` | `src/calc-svg-block-builder.js:1048` | Renders individual SVG blocks per position |
| `window.build_assembly_svg(index, muntins, mountTarget)` | `src/calc-svg-block-assembler.js:328` | Orchestrates the full pipeline — calls `build_block_svgs` internally, then assembles + mounts |

**`build_assembly_svg` is the single top-level entry point.** It calls `build_block_svgs` internally at line 377 of the assembler, so callers only need to invoke `build_assembly_svg`.

## 2. Parameters and expected shapes

**`build_assembly_svg(index, muntins, mountTarget)`:**
- `index` (number) — index into `window.comboSolutions[]`
- `muntins` (boolean, optional) — `true` (default) uses actual rows/cols; `false` forces rows=1/cols=1 (no muntins). The initial Explore click passes `false`.
- `mountTarget` (optional) — string element ID, HTMLElement, or omitted (defaults to `#explore`)

**`build_block_svgs(index, muntins)`:**
- Same `index` and `muntins` semantics. Reads `comboSolutions[index].build_objects` (array of block request objects with fields like `block_pos`, `construction`, `width`, `height`, `sr_top/left/bottom/right`, `rows`, `cols`).

## 3. What triggers the pipeline and where

The pipeline is triggered from **`src/calc-modal.js`** in two places:

1. **Explore button click** (`calc-modal.js:214`): When a user clicks an Explore button on a solution card, the modal opens and calls:
   ```js
   window.build_assembly_svg(idx, false);  // initially no muntins
   ```

2. **Muntin toggle** (`calc-modal.js:288`): When the user toggles muntins on/off inside the modal:
   ```js
   window.build_assembly_svg(currentModalIndex, showMuntins);
   ```

## 4. How and where the pipeline populates comboSolutions

The pipeline writes **four cache fields** onto `comboSolutions[index]`, using a dual-cache strategy keyed on the `muntins` boolean:

### Block builder (`calc-svg-block-builder.js:1064-1090`):
- `muntins=true` → writes `solution.building_block_svgs = { pos2: "<svg...>", pos5: "<svg...>", ... }`
- `muntins=false` → writes `solution.building_block_svgs_no_muntins = { pos2: "<svg...>", ... }`
- These are written at line 1090 (initializes empty object) and line 1114 (populates each `pos` key per build_object). Returns early from cache if the key already exists (lines 1066-1068).

### Block assembler (`calc-svg-block-assembler.js:348-576`):
- `muntins=true` → writes `solution.assembly_svg` (serialized SVG string)
- `muntins=false` → writes `solution.assembly_svg_no_muntins`
- Written at line 576 after XMLSerializer serialization. Returns early from cache at lines 354-373 if the cached string already exists (just re-mounts from cache).

### Timing:
Fields are populated lazily on first Explore click for that solution, not during the initial poll/render cycle. The `comboSolutions` array is populated by `calc-combo-results.js` from the Xano response — but the SVG fields don't exist until the user clicks Explore.

## 5. How the render target is identified and passed

The mount target flows through as the third argument to `build_assembly_svg`:

1. **`calc-modal.js` does NOT pass a mountTarget** — both call sites pass only `(index, muntins)`, omitting the third arg.
2. **`_resolveMountTarget(undefined)`** at line 345 of the assembler falls through to the fallback: `_lastMountContainer || document.getElementById("explore")`.
3. On first call, `_lastMountContainer` is null, so it resolves to `document.getElementById("explore")` — the `div#explore` element in the modal.
4. On subsequent calls, `_lastMountContainer` is set at line 582, so it reuses the same container.

The assembler then clears the container's children and appends the new `<svg>` element as a direct child (lines 589-590).
