# Alpha-SVG Prompt

## Role of This Codebase

This repo contains a shared SVG rendering pipeline that is consumed by two separate codebases — referred to as **Alpha** and **Beta**. The pipeline is served via jsDelivr from a pinned git tag and loaded as a browser script in both environments.

The pipeline's job is to:
1. Accept a solution object containing an array of `build_objects`, each describing an individual building block (window, door, cased opening, sidelite, transom, flanker, etc.)
2. Render each building block as an individual SVG and cache it
3. Composite those individual SVGs into a single assembled SVG using a positional template
4. Mount that composited SVG into a target DOM element

---

## Entry Points

There are two public functions exposed on `window`:

**`window.build_assembly_svg(index, muntins, mountTarget)`** — the single top-level entry point. Callers should only invoke this. It internally calls `build_block_svgs`.

**`window.build_block_svgs(index, muntins)`** — renders individual SVG blocks per position. Called internally by `build_assembly_svg`; do not call directly.

Parameters:
- `index` — In Alpha mode: a numeric index into `window.comboSolutions[]`. In Beta mode: ignored.
- `muntins` (boolean, optional) — controls which row/col values are used for rendering (see Rendering Logic below). Default is `true`.
- `mountTarget` (optional) — string element ID, HTMLElement reference, or omitted. Defaults to `document.getElementById("explore")`. Both Alpha and Beta use a `div#explore` as the mount target, so this argument is typically omitted.

---

## Alpha Mode

### Data Shape

In Alpha mode, the pipeline reads from and writes to `window.comboSolutions`, which is an **array of solution objects**. Each solution object contains a `build_objects` array describing the individual building blocks to render.

Each build object has `rows` and `cols` fields. The pipeline uses these as-is unless `muntins=true` and `suggested_rows`/`suggested_cols` are present (see Rendering Logic below).

The following construction types will include `suggested_rows` and `suggested_cols` alongside `rows` and `cols`:
- `single_door`
- `double_door`
- `sidelite`
- `flanker`
- `transom`

The following construction types will never include `suggested_rows` or `suggested_cols`:
- `cased_opening`
- `head_detail`

**Alpha `comboSolutions` array element shape:**
```json
{
  "index": 1,
  "job_id": 1773340176786,
  "assembly_template": "G",
  "assembly_no": 30,
  "muntins": false,
  "build_objects": [
    {
      "cols": 1, "rows": 1,
      "suggested_cols": 2, "suggested_rows": 5,
      "width": 60, "height": 80,
      "sr_top": 4.5, "sr_left": 4.5, "sr_right": 4.5, "sr_bottom": 9.25,
      "block_pos": "pos2",
      "construction": "single_door"
    },
    {
      "cols": 1, "rows": 1,
      "width": 21.75, "height": 80,
      "sr_top": 1.75, "sr_left": 1.75, "sr_right": 1.75, "sr_bottom": 1.75,
      "block_pos": "pos1",
      "construction": "cased_opening"
    }
  ],
  "opening_width": 108.25,
  "opening_height": 95.875,
  "unit_width": 108,
  "unit_height": 95.75,
  "location": "interior",
  "building_block_svgs_no_muntins": { "pos1": "<svg...>", "pos2": "<svg...>" },
  "assembly_svg_no_muntins": "<svg...>",
  "building_block_svgs": { "pos1": "<svg...>", "pos2": "<svg...>" },
  "assembly_svg": "<svg...>"
}
```

### Rendering Logic

The `muntins` boolean controls which row/col values the block builder uses at render time. This is a read-time substitution only — the build objects must never be mutated by the rendering pipeline.

- `muntins=false` → use `rows` and `cols` as provided on the build object
- `muntins=true` → use `suggested_rows` and `suggested_cols` if present on the build object; fall back to `rows` and `cols` for build objects that do not have those fields

### Saving the Muntins Selection

After each render, save the current `muntins` boolean onto the solution object at the solution level:

```js
comboSolutions[index].muntins = muntins;
```

This is a solution-level flag — one per solution object, not per build object.

### Caching (Dual-Cache Strategy)

The pipeline uses a lazy-population strategy keyed on the `muntins` boolean. SVG fields are not populated until the pipeline is first invoked for a given solution. On subsequent calls for the same solution with the same `muntins` value, the pipeline returns early and re-mounts from the cached SVG string without re-rendering.

- `muntins=true` → writes and caches `building_block_svgs` and `assembly_svg`
- `muntins=false` → writes and caches `building_block_svgs_no_muntins` and `assembly_svg_no_muntins`

Do not break this caching behavior.

### Invocation (Alpha)

The pipeline is triggered from `calc-modal.js` in two places:

1. **Explore button click** — when a user clicks Explore on a solution card, the modal opens and calls:
   ```js
   window.build_assembly_svg(idx, false);
   ```

2. **Muntin toggle** — when the user toggles muntins on/off inside the modal:
   ```js
   window.build_assembly_svg(currentModalIndex, showMuntins);
   ```

---

## Beta Mode

### Detection

Beta mode is activated when `window.comboSolution` (singular) is present on the window object. At the start of `build_assembly_svg` and `build_block_svgs`, check for its existence. If found, activate Beta mode.

### Data Shape

In Beta mode, the pipeline reads from and writes to `window.comboSolution` — a **single solution object**, not an array. Its shape is identical to one element of the Alpha array, with the following differences:

- `rows` and `cols` on every build object are already fully resolved to their final values
- `suggested_rows` and `suggested_cols` are not present on any build object
- The `muntins` flag is not present on the solution object

**Beta `window.comboSolution` shape:**
```json
{
  "index": 1,
  "job_id": 1773340176786,
  "assembly_template": "G",
  "assembly_no": 30,
  "build_objects": [
    {
      "cols": 2, "rows": 5,
      "width": 60, "height": 80,
      "sr_top": 4.5, "sr_left": 4.5, "sr_right": 4.5, "sr_bottom": 9.25,
      "block_pos": "pos2",
      "construction": "single_door"
    },
    {
      "cols": 1, "rows": 1,
      "width": 21.75, "height": 80,
      "sr_top": 1.75, "sr_left": 1.75, "sr_right": 1.75, "sr_bottom": 1.75,
      "block_pos": "pos1",
      "construction": "cased_opening"
    }
  ],
  "opening_width": 108.25,
  "opening_height": 95.875,
  "unit_width": 108,
  "unit_height": 95.75,
  "location": "interior"
}
```

### Rendering Logic (Beta)

Use `rows` and `cols` directly from each build object. No substitution logic applies. There is no muntin toggle in Beta — it is a one-shot render.

### Writing Output (Beta)

The pipeline writes its output directly onto `window.comboSolution` using only the non-muntin SVG fields:
- `window.comboSolution.building_block_svgs` — individual SVGs keyed by `block_pos`
- `window.comboSolution.assembly_svg` — the full composited SVG string

The `_no_muntins` variants are not used in Beta mode.

Caching is not required in Beta mode. The pipeline renders once per button click and mounts directly to the page.

### Invocation (Beta)

The pipeline is invoked on a button click in the Next.js configurator page. It is always called as:

```js
window.build_assembly_svg(0, false);
```

The `index` parameter is ignored in Beta mode. `muntins=false` is passed by convention but has no effect on which SVG output fields are written. The `mountTarget` is omitted and defaults to `document.getElementById("explore")`.

---

## Mount Target (Both Modes)

Both Alpha and Beta mount the composited SVG into `div#explore`. The `mountTarget` argument is typically omitted — the pipeline resolves to `document.getElementById("explore")` as its default fallback. Do not change this default behavior.

---

## Architectural Boundaries

All modal-related behavior lives in `calc-modal.js`. The SVG rendering pipeline files (`calc-svg-block-builder.js`, `calc-svg-block-assembler.js`) must remain free of any modal logic. The pipeline is handed data and a target — it has no awareness of the UI context that invoked it.

---

## What Not to Touch

- All Alpha invocation paths in `calc-modal.js`
- The block builder and assembler rendering logic
- The `_resolveMountTarget` fallback behavior
- The dual-cache strategy in Alpha mode
