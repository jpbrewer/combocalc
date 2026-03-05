## Overview

This repo implements a **browser-only “ComboCalc” application** intended to be embedded into **Webflow pages** as drop-in scripts (no bundler, no Node runtime). A user fills out a Webflow form; submission is intercepted, a request is posted to an API, and the page **polls** until solution data is ready. The returned solution set is normalized into a **global store** (`window.comboSolutions`) and rendered into a Webflow-built “solutions listing” UI by cloning a template card and rows.

When a user clicks an **Explore** button on a solution card, a modal is opened and the system generates SVG output in two stages: it renders individual “building block” SVGs from a canonical SVG template and pattern images, then assembles those blocks into a single composite SVG using a data-driven assembly template (`window.ASSEMBLY_TEMPLATES`). The assembled SVG is mounted inline into `div#explore` and serialized back onto the solution object.

Script delivery is designed for CDN hosting (jsDelivr GitHub-backed) and uses a **sequential loader** so that globals are defined in a known order.

---

## Goals and Non-Goals

**Goals**
- Run entirely in the browser on Webflow pages (no Node.js / filesystem requirements at runtime).
- Provide explicit, deterministic script load order without bundling.
- Intercept Webflow form submission to support async **request → poll → render** flows.
- Maintain a canonical in-memory results store (`window.comboSolutions`) to drive UI and “Explore” actions.
- Render parametric SVG “building blocks” from a canonical template and assemble them into a composite SVG via declarative layout templates.
- Minimize brittleness by documenting DOM contracts (IDs/selectors) and load-order dependencies.

**Non-Goals**
- No server-side rendering.
- No build step / bundler assumed (architecture relies on global scripts).
- No persistent client storage (no localStorage/cookies usage in the provided files).
- No BigCommerce-specific runtime behavior is evidenced in the provided files (**unknown**).
- No guarantee of “fail-soft” behavior across all modules (some modules intentionally fail-fast by throwing).

---

## Runtime Environment

- **Execution environment:** Browser global scope (`window`), DOM available.
- **Webflow embed model:** Scripts run on pages where Webflow has already rendered the needed DOM structure by `DOMContentLoaded`.
- **Webflow redirected inputs:**
  - `calc-query.js` explicitly handles Webflow’s redirected UI mirrors:
    - `span.w-radio-input`
    - `span.w-checkbox-input`
    - class `w--redirected-checked`
  - Source of truth is `input.checked`; the span class is treated as derived UI.
- **Timing assumptions:**
  - `calc-query.js` boots on `DOMContentLoaded`, then uses a double `requestAnimationFrame()` before applying resets/rules to avoid Webflow initialization races.
  - `calc-combo-results.js` boots on `DOMContentLoaded` and assumes templates/modal/form are present by then.
  - SVG rendering/assembly is **invoked on-demand** (Explore flow); those scripts do not auto-run render on load.

---

## System Diagram (Text)

```
                        Webflow Page (browser)
┌────────────────────────────────────────────────────────────────────┐
│ Entry Point                                                       │
│  calc-bootstrap-loader.js (ORCHESTRATOR)                           │
│   └─ sequentially injects <script> tags (FILE_ORDER)               │
└───────────────┬────────────────────────────────────────────────────┘
                │
                v
┌────────────────────────────────────────────────────────────────────┐
│ UI / Query Rules (Webflow form gating)                             │
│  calc-query.js (UI GLUE)                                           │
│   - manages blockers + visibility + defaults                        │
│   - syncs Webflow redirected inputs                                │
└───────────────┬────────────────────────────────────────────────────┘
                │ user submits form (#wf_form_combo)
                v
┌────────────────────────────────────────────────────────────────────┐
│ Request → Poll → Render Solutions List                             │
│  calc-combo-results.js (ORCHESTRATOR)                              │
│   - intercepts submit, POSTs request endpoint                       │
│   - polls retrieval endpoint until ready/timeout                    │
│   - normalizes to window.comboSolutions                             │
│   - clones template cards/rows into .solutions-list                 │
│   - wires Explore buttons + modal open/close                        │
└───────────────┬────────────────────────────────────────────────────┘
                │ Explore click (data-solution-index)
                v
┌────────────────────────────────────────────────────────────────────┐
│ SVG Generation Pipeline                                            │
│  window.build_assembly_svg(index, muntins) (global function)         │
│   ├─ muntins param: false=no muntins (rows/cols=1), true=actual      │
│   │  (default true if omitted; Explore click passes false)           │
│   ├─ checks assembly SVG cache first (instant swap on toggle)        │
│   ├─ calls window.build_block_svgs(index, muntins)                   │
│   │    calc-svg-block-builder.js (RENDERER)                          │
│   │     - uses window.WINDOW_TYPE_A_SVG_TEXT                         │
│   │     - uses pattern <img> URLs (#img_* ids)                       │
│   │     - dual cache: building_block_svgs / building_block_svgs_no_muntins │
│   └─ assembles blocks via template ops                               │
│        calc-svg-block-assembler.js (ORCHESTRATOR)                    │
│         - uses window.ASSEMBLY_TEMPLATES                             │
│         - mounts final inline <svg> into div#explore                 │
│         - dual cache: assembly_svg / assembly_svg_no_muntins         │
└────────────────────────────────────────────────────────────────────┘

Assets / Data:
 - combo-assembly-templates-json.js → window.ASSEMBLY_TEMPLATES
 - window-type-a-svg-raw.js         → window.WINDOW_TYPE_A_SVG_TEXT
```

---

## Module Inventory

| File | Role | Runs | Public API | Inputs (DOM/Data) | Outputs (DOM/Data) | Dependencies / Load order |
|---|---|---|---|---|---|---|
| `calc-bootstrap-loader.js` | ORCHESTRATOR | On load (immediate IIFE) | None directly | DOM: `document.head` | DOM: injects `<script>` tags | Defines `FILE_ORDER` dependency graph; must be the single entry point embed |
| `calc-query.js` | UI GLUE | On `DOMContentLoaded` | None (runs on load) | DOM: many required IDs (inputs + wrapper DIVs + blockers); Webflow redirected spans (via closest label queries) | DOM: show/hide blockers and wrapper DIVs; programmatic check/uncheck + dispatch events | Must run after Webflow has rendered form DOM; uses double `requestAnimationFrame` |
| `calc-combo-results.js` | ORCHESTRATOR | On `DOMContentLoaded` | Globals: `window.job_id`, `window.comboSolutions` | DOM: form + solutions list templates + modal + icon registry; Data: endpoints; requires `window.build_assembly_svg` at Explore time | DOM: clones solution cards/rows; shows/hides areas, panels, modal; Data: fills `window.comboSolutions` | Uses network POST + polling; `build_assembly_svg` may load later but must exist before Explore action completes |
| `combo-assembly-templates-json.js` | ASSET/DATA | On load | `window.ASSEMBLY_TEMPLATES` | None | Global data array | Must load before `calc-svg-block-assembler.js` and before any `build_assembly_svg` call |
| `window-type-a-svg-raw.js` | ASSET/DATA | On load | `window.WINDOW_TYPE_A_SVG_TEXT` | None | Global string | Must load before `calc-svg-block-builder.js` (renderer) |
| `calc-svg-block-builder.js` | RENDERER | On-demand (when called) | `window.build_block_svgs(index)` | DOM: pattern `<img>` IDs; Data: `window.WINDOW_TYPE_A_SVG_TEXT`, `window.comboSolutions[index].build_objects` | Data: creates `solution.building_block_svgs[pos] = svgString` | Requires template + comboSolutions + pattern images; fail-fast on missing prerequisites |
| `calc-svg-block-assembler.js` | ORCHESTRATOR | On-demand (when called) | `build_assembly_svg(index, muntins)` (**inferred** global function) | DOM: `div#explore`; Data: `window.ASSEMBLY_TEMPLATES`, `window.comboSolutions`, `window.build_block_svgs` | DOM: mounts inline `<svg>` into `#explore` (with optional dimension annotations when `unit_width`/`unit_height` present); Data: writes `solution.assembly_svg` + returns assembled artifact bundle | Requires templates + renderer + solution store; fail-fast (throws) on issues |

---

## Data Model

### `window.comboSolutions` (global store)
- **Name in code:** `window.comboSolutions`
- **Shape (known):** Array of normalized solution objects created by `normalizeSolutions(resp)` in `calc-combo-results.js`.
  - Each normalized solution includes:
    - `index` (number)
    - `job_id` (number, from `window.job_id`)
    - `assembly_template` (string or null)
    - `assembly_no` (number/string or null; from `assembly_no` or `arrangement_no`)
    - `icon` (string or null)
    - `solution_grid` (object; contains `notes` and position keys — all optional: `pos2`, `pos1`, `pos3`, `pos13`, `pos5`, `pos4`, `pos6`, `pos46`)
    - `build_objects` (object in normalizer; later expected as array by renderer — see “Conflicts / Drift”)
    - `solution_svg` (string or null)
    - `meta` (object)
    - `opening_width` (number or null; from response root or per-solution)
    - `opening_height` (number or null; from response root or per-solution)
    - `jamb_depth` (number or null; from response root or per-solution)
    - `unit_width` (number or null; decimal inches; from response root or per-solution)
    - `unit_height` (number or null; decimal inches; from response root or per-solution)
    - `door_bore` ("left" | "right" | null; which stile gets the bore hole; defaults per assembly template's `door_bore` value)
    - `hardware_color` (string | null; hardware color name from `HARDWARE_COLORS`, e.g., "Chrome"; defaults to "Chrome" for doors)
  - Rendering cache keys (added lazily by SVG pipeline):
    - `building_block_svgs` (object; block SVGs with actual rows/cols — muntins on)
    - `building_block_svgs_no_muntins` (object; block SVGs with rows=1, cols=1 — muntins off)
    - `assembly_svg` (string; assembled SVG with muntins)
    - `assembly_svg_no_muntins` (string; assembled SVG without muntins)
- **Source of truth:** Populated from retrieval endpoint response; then becomes authoritative for rendering and Explore.
- **Created by:** `calc-combo-results.js` after poll success.
- **Consumed by:**
  - `calc-combo-results.js` for solutions list rendering and Explore button indexing.
  - `calc-svg-block-builder.js` reads `comboSolutions[index].build_objects` and writes `comboSolutions[index].building_block_svgs`.
  - `calc-svg-block-assembler.js` reads `comboSolutions[index].assembly_template`, `building_block_svgs`, `unit_width`, `unit_height`, `door_bore`, and `hardware_color`; writes `assembly_svg`. Exposes `window.updateBoreVisibility(side)`, `window.updateHingeVisibility(construction, boreSide)`, and `window.updateHingeColor(hexColor)` for post-mount hardware toggling.

### `window.job_id`
- **Name in code:** `window.job_id`
- **Shape:** Number
- **Source of truth:** `submitInitialRequest()` response parsing in `calc-combo-results.js`.
- **Used for:** Polling retrieval endpoint.

### `solution.solution_grid`
- **Name in code:** `solution.solution_grid`
- **Shape (known):**
  - top-level `notes` string (used as “summary”)
  - position keys in `POS_ORDER = ["pos2","pos1","pos3","pos13","pos5","pos4","pos6","pos46"]` (all optional):
    - row fields read for display:
      - `row`, `building_block`, `order_dims`, `quantity`, `door_unit_width`, `door_unit_height`
  - `door_unit_height` contains an "XX" marker that is replaced client-side:
    - Listing cards: "Single-Hung" (single_door) or "Double-Hung" (double_door)
    - Modal: "Left-Hand" / "Right-Hand" (single_door, based on door_bore) or "Double-Hung" (double_door)
    - Bore toggle swaps "Left-Hand" ↔ "Right-Hand" in the modal
- **Source of truth:** Retrieval payload.

### `solution.building_block_svgs`
- **Name in code:** `comboSolutions[index].building_block_svgs`
- **Shape (known):** Object map keyed by `block_pos` (e.g., `pos2`) to serialized SVG string.
- **Source of truth:** Produced by renderer (`window.build_block_svgs(index)`).
- **Used by:** Assembler (`build_assembly_svg(index)`).

### `solution.assembly_svg`
- **Name in code:** `comboSolutions[index].assembly_svg`
- **Shape:** Serialized SVG string of the assembled composite.
- **Source of truth:** Produced by assembler.

### `window.HARDWARE_COLORS` (asset data)
- **Name in code:** `window.HARDWARE_COLORS`
- **Shape:** Array of `{ name: string, color: string }` objects (e.g., `{ "name": "Chrome", "color": "#D7D7D7" }`).
- **Used by:** `calc-combo-results.js` (hardware color selector, hex resolution) and `calc-svg-block-builder.js` (hinge fill color).
- **Source of truth:** `combo-assembly-templates-json.js`

### `window.ASSEMBLY_TEMPLATES` (asset data)
- **Name in code:** `window.ASSEMBLY_TEMPLATES`
- **Shape (known):** Array of templates, each having `template`, `description`, `door_bore`, `positions`, `ops`.
  - Ops vocabulary used by assembler:
    - `place`, `snap`, `validateSnap`
    - snap corners limited to `TL`, `TR`, `BL`, `BR`
- **Source of truth:** `combo-assembly-templates-json.js`

### `window.WINDOW_TYPE_A_SVG_TEXT` (asset data)
- **Name in code:** `window.WINDOW_TYPE_A_SVG_TEXT`
- **Shape:** String containing full SVG template markup.
- **Source of truth:** `window-type-a-svg-raw.js`

---

## DOM Contract

### Query Form / UI Gating (`calc-query.js`)

Full contract documentation in webflow-contract.md

**Required IDs (inputs; these are `<input>` element IDs):**
- Location radios: `loc_interior_radio`, `loc_exterior_radio`
- Starting point radios: `sp_rough_radio`, `sp_drywall_radio`, `sp_co_radio`
- Output type radios: `out_door_radio`, `out_co_radio`
- Door controls: `dht_standard_radio`, `dwho_system_decides_radio`, `dwho_user_decides_radio`, `dws_unit_dim_radio`, `dws_slab_dim_radio`
- CO controls: `cwho_system_decides_radio`, `cwho_user_decides_radio`
- Advanced controls: `advanced_check_box`, `specify_side_gaps_check_box`, `specify_top_gap_check_box`

**Required IDs (wrapper DIVs; these are manipulated directly):**
- Blockers: `blocker_b`, `blocker_c`
- Detail/measurement wrappers:
  - `door_detail_wrapper`
  - `door_width_scope_wrapper`, `door_width_msmt_wrapper`
  - `co_detail_wrapper`, `co_width_msmt_wrapper`
  - `specify_side_gaps_check_box_wrapper`, `side_gap_msmt_wrapper`
  - `specify_top_gap_check_box_wrapper`, `top_gap_msmt_wrapper`

**Webflow structure assumptions used:**
- Input rows are hidden by finding the closest wrapper: `.w-radio` / `.w-checkbox` or nearest `label` as fallback.
- Redirected UI spans are located by:
  - finding the closest `<label>` containing the `<input>`
  - then querying `.w-radio-input` or `.w-checkbox-input` inside it

### Solutions Listing / Modal (`calc-combo-results.js`)
**Required element IDs:**
- Form: `#wf_form_combo`
- Submit button (preferred): `#submit_query` (fallback: form `button[type="submit"]` or `input[type="submit"]`)
- Search again button: `#search_again`
- Solutions wrapper: `#solutions_area`
- Form blocker overlay: `#blocker_form`
- Icon registry container: `#icon_registry`
- Modal:
  - `#modal-overlay`
  - `#modal-panel`
  - `#modal-close`
  - `#choose-door-bore` (door bore chooser wrapper; hidden by default; shown for single-door solutions)
  - `#door-bore-left` / `#door-bore-right` (bore side selectors; class `door-selection-active` on active)

**Required selectors/structure:**
- Solutions list container: `.solutions-list`
- Template solution card: `[data-solution-card="template"]`
- Within each card:
  - row template: `[data-solution-row="template"]`
  - summary row: `[data-solution-summary="row"]` containing `[data-field="summary"]`
  - Explore button: `[data-solution-explore="btn"]`
  - icon wrapper: `[data-solution-icon="img"]` containing `<img data-field="icon">`

**Icon registry mapping:**
- `#icon_registry` should contain `img[data-icon-name]` elements mapping logical icon filenames to Webflow-hosted asset URLs.

**Modal data grid (inside `#modal-panel`, after `#explore`):**
- `[data-modal-summary="section"]` — opening summary (opening_width, opening_height, jamb_depth)
- `[data-modal-grid="section"]` — grid container (icon, rows, notes, configure button)
- `[data-modal-icon="img"]` — icon wrapper (contains `<img data-field="icon">`)
- `[data-modal-row="template"]` — row template (cloned per position key)
- `[data-modal-notes="row"]` — notes row
- `[data-modal-configure="btn"]` — "Configure and Buy" button (not wired by JS)

### Explore Output Mount (`calc-svg-block-assembler.js`)
**Required element:**
- `div#explore` (wrapper where assembled inline SVG is mounted)

### Pattern Preload Images (`calc-svg-block-builder.js`)
**Required `<img>` element IDs:**
- `#img_rail_wood`
- `#img_stile_wood`
- `#img_bevel_top_wood`
- `#img_bevel_bottom_wood`
- `#img_bevel_side_wood`
- `#img_glass`

---

## Event and State Flow

1. **Script loading**
   - `calc-bootstrap-loader.js` injects scripts sequentially using `FILE_ORDER`.
   - Data globals are created by the asset files and later consumed by renderer/orchestrators.

2. **UI gating (query form)**
   - `calc-query.js` boots on `DOMContentLoaded` and validates required IDs.
   - It sets blockers on first load and applies a Section C master reset.
   - Uses double `requestAnimationFrame()` before applying resets/render to avoid Webflow timing races.
   - Attaches `change` listeners to:
     - Location radios → resets Section B and Section C, re-renders.
     - Starting point radios → master reset on Section C, re-renders.
     - Section C controls (door/co + advanced) → re-renders.
   - Uses `input.checked` as truth and updates Webflow redirected spans accordingly.

3. **Submit interception + async job**
   - `calc-combo-results.js` attaches a `submit` listener on the form (capture), prevents default submission and runs:
     - POST request to request endpoint → parse job id → set `window.job_id`
     - Poll retrieval endpoint up to `MAX_POLLS` with `sleep(POLL_INTERVAL_MS)` between attempts
   - On success:
     - Normalize response → write `window.comboSolutions`
     - Render solution cards by cloning template card + rows
     - Show solutions area, show Webflow success panel, disable/grey submit, show form blocker
   - On failure:
     - Show Webflow fail panel (if present), restore submit, hide results + blocker

4. **Explore flow**
   - A global document click handler (capture) detects clicks on `[data-solution-explore="btn"]`.
   - It opens the modal (`#modal-overlay` display = `flex`) and reads `dataset.solutionIndex`.
   - If `window.build_assembly_svg` is missing, it warns and stops.
   - Configures the door bore chooser: shows `#choose-door-bore` if solution has a single door (defaults `door_bore` per assembly template), hides it otherwise. Sets the bore toggle active class.
   - Configures the hardware color selector: shows `#hardware-color-wrapper` if solution has any door (single or double), sets the `<select>` to the solution's `hardware_color`. Hides it otherwise.
   - If present, it calls `window.build_assembly_svg(index)` and logs errors if thrown.
   - After SVG mount, calls `window.updateBoreVisibility(solution.door_bore)` and `window.updateHingeVisibility(doorType, boreSide)` to set bore/hinge visibility.
   - After SVG rendering, calls `populateModalGrid(index)` to populate the modal data grid:
     - Sets opening summary fields (opening_width, opening_height, jamb_depth) from the solution object.
     - Sets icon via `[data-modal-icon="img"]` using the same icon registry resolution.
     - Clones `[data-modal-row="template"]` per position key in `POS_ORDER`, populates `data-field` elements.
     - Populates notes in `[data-modal-notes="row"]`.
     - Fails gracefully (warns) if modal grid template elements are absent.
   - On close, cloned modal grid rows (`[data-pos]` elements) are removed to prevent stale data.
   - Modal close paths:
     - click `#modal-close`
     - click overlay background (target === overlay)
     - press Escape
     - clicks inside `#modal-panel` stop propagation to prevent overlay-close

5. **SVG build + assembly**
   - `build_assembly_svg(index)` (global function) performs:
     - Validate globals / index range
     - Call `window.build_block_svgs(index)` to produce `solution.building_block_svgs`
     - Select layout template from `solution.assembly_template` in `window.ASSEMBLY_TEMPLATES`
     - Parse each block SVG (expects `<svg>` + valid viewBox), compute placements via ops (`place`, `snap`, `validateSnap`)
     - If `unit_width`/`unit_height` are present, append dimension annotation lines and fractional-inch labels; expand viewBox to accommodate
     - Mount assembled inline `<svg>` into `div#explore`
     - Serialize final SVG back into `solution.assembly_svg`

---

## Networking and Integration Points

**Present: Yes (in `calc-combo-results.js`)**

- Request endpoint (POST urlencoded):
  - `https://api.transomsdirect.com/api:xyi0dc0X/bc_combo_solution_request`
  - Payload: serialized `FormData(form)` as `application/x-www-form-urlencoded`
  - Response parsing:
    - accepts object with `job_id` or `unix` or `jobId` or “first value” fallback
    - stored as `window.job_id` (Number)

- Retrieval endpoint (POST urlencoded):
  - `https://api.transomsdirect.com/api:xyi0dc0X/combo_unit_solution_retrieval`
  - Payload: `{ job_id }`
  - Not-ready detection:
    - string `"not_ready"` (case-insensitive)
    - or object with `status === "not_ready"` or `state === "not_ready"`
  - Poll cadence:
    - `POLL_INTERVAL_MS = 2000`
    - `MAX_POLLS = 40`
    - throws timeout error after max attempts

---

## Error Handling and Failure Modes

### Current behavior (as implemented)
- **`calc-bootstrap-loader.js`:**
  - Logs an error on script load failure, but does not retry; subsequent loads will not proceed.

- **`calc-query.js`:**
  - If any required DOM IDs are missing at boot: logs a clear error listing missing IDs and **disables itself** (no listeners, no mutations).
  - Optional elements fail-soft (no throw) in helper functions.

- **`calc-combo-results.js`:**
  - Missing form: silently no-ops (init returns).
  - Missing solutions list or template: `populateSolutionsFromStore()` throws.
  - Invalid `job_id`: throws, restores submit, shows fail panel if present.
  - Poll timeout: throws, restores submit, shows fail panel if present.
  - Missing `build_assembly_svg`: Explore opens modal, logs warning, does not render.

- **SVG renderer/assembler:**
  - `window.build_block_svgs(index)` throws if prerequisites are missing (comboSolutions, build_objects array, template string, pattern images, invalid geometry).
  - `build_assembly_svg(index)` throws (and logs `console.error("build_assembly_svg failed:", err)` before rethrowing per its doc block).

### Operational checklist (what to check first when something breaks)
1. Confirm `calc-bootstrap-loader.js` loaded all files (network tab; look for 404/blocked CDN).
2. Confirm required DOM IDs exist on the page:
   - Query form IDs (from `calc-query.js`)
   - Solutions IDs/selectors + templates + modal IDs (from `calc-combo-results.js`)
   - `div#explore` exists for Explore rendering
   - Pattern preload `<img id="img_*">` exist and have resolved URLs
3. Confirm globals exist in console:
   - `window.comboSolutions` becomes populated after successful poll
   - `window.WINDOW_TYPE_A_SVG_TEXT` exists before calling build/render
   - `window.ASSEMBLY_TEMPLATES` exists before assembly
   - `window.build_block_svgs` exists (renderer)
   - `window.build_assembly_svg` exists (assembler) before Explore click
4. Confirm retrieval payload shape contains required fields:
   - `assembly_template`
   - `build_objects` (array expected by renderer; see Conflicts / Drift)

---

## Load Order and Deployment

### Intended load order (enforced by `calc-bootstrap-loader.js`)
`FILE_ORDER`:
1. `src/calc-query.js`
2. `src/calc-combo-results.js`
3. `assets/combo-assembly-templates-json.js`
4. `assets/window-type-a-svg-raw.js`
5. `src/calc-svg-block-builder.js`
6. `src/calc-svg-block-assembler.js`

### Why order matters
- `calc-combo-results.js` sets up the request/poll/render system and calls `build_assembly_svg` on Explore.
- `combo-assembly-templates-json.js` must run before assembler calls can succeed.
- `window-type-a-svg-raw.js` must run before the SVG block renderer can parse the template.
- `calc-svg-block-builder.js` must exist before `build_assembly_svg` is invoked (assembler calls `window.build_block_svgs`).
- `calc-svg-block-assembler.js` must exist before Explore attempts to call `window.build_assembly_svg`.

### Embed strategy
- Use a single Webflow embed that loads `calc-bootstrap-loader.js` (the orchestrator). That file appends all other scripts into `document.head` sequentially.

### Caching/versioning strategy
- Current loader uses jsDelivr with:
  - `BASE = "https://cdn.jsdelivr.net/gh/jpbrewer/combocalc@main/"`
- For testing, switch BASE to raw.githack.com (no caching; immediate updates after push):
  - `BASE = "https://raw.githack.com/jpbrewer/combocalc/<branch>/"`
- Recommended approach for releases (guidance only):
  - Prefer pinned tags/commits (e.g., `@vX.Y.Z` or `@<sha>`) over `@main` to avoid unexpected production drift.

### Release process checklist (single-developer)
1. Update repo files (especially DOM contracts if Webflow IDs changed).
2. Verify `FILE_ORDER` still matches actual repo paths.
3. Publish/merge changes to the branch/tag used by jsDelivr.
4. Hard refresh Webflow page and verify:
   - form gating works
   - request/poll completes
   - solutions list renders
   - Explore opens modal and renders assembled SVG

---

## Invariants / Guardrails

- `calc-bootstrap-loader.js` `FILE_ORDER` is the dependency graph; reordering can break runtime.
- `calc-query.js` requires its `REQUIRED_IDS` to exist; otherwise it disables itself.
- In `calc-query.js`, **source of truth is `input.checked`**; Webflow redirected spans are derived and synced.
- `calc-combo-results.js`:
  - Intercepts form submit and expects to be the only submission path (preventDefault).
  - Solutions are displayed only after successful poll; `#solutions_area` stays hidden otherwise.
  - Explore buttons must carry a valid `data-solution-index` pointing into `window.comboSolutions`.
  - Template elements remain as templates and are not removed; clones are generated per solution.
- `calc-svg-block-builder.js`:
  - Rendering is driven only by `comboSolutions[index].build_objects`.
  - Template SVG IDs in `window.WINDOW_TYPE_A_SVG_TEXT` are treated as a stable API.
  - Pattern images are referenced via resolved URLs from DOM `<img>` elements.
- `calc-svg-block-assembler.js`:
  - Template selection uses only `solution.assembly_template`.
  - Layout uses only template op sequence + block viewBox dimensions.
  - Output mounts translated `<g data-pos="...">` groups (no nested `<svg>` tags).

---

## Known Gaps / TODOs

- **Potential schema mismatch:** `calc-combo-results.js` normalizes `build_objects: sol.build_objects ?? {}` (object default), while `calc-svg-block-builder.js` requires `comboSolutions[index].build_objects` to be an **array** and throws otherwise. This is either:
  - a real mismatch (**likely**), or
  - the retrieval payload always provides `build_objects` as an array in practice and the `{}` default is just defensive.
- **Fail-soft consistency:** Some modules fail-soft (query script disables itself on missing IDs), while SVG generation fails-hard (throws). This may be acceptable, but it’s a maintenance consideration (**inferred**).
- **CDN drift risk:** Loader points at `@main` with no cache-busting; production can change immediately after merges (**inferred**).
- **BigCommerce integration:** Mentioned in project goal, but no BigCommerce-specific constraints appear in these files (**unknown**).

---

## Conflicts / Drift

- **`build_objects` type drift**
  - `calc-svg-block-builder.js` enforces:
    - `comboSolutions[index].build_objects` must be an array (`mustBeArray(...)`).
  - `calc-combo-results.js` normalization currently sets:
    - `build_objects: sol.build_objects ?? {}` (object default, not array).
  - Runtime truth will depend on the retrieval payload. If payload ever omits `build_objects`, renderer will throw.

- **`build_assembly_svg` exposure**
  - `calc-svg-block-assembler.js` defines `function build_assembly_svg(index) { ... }` at top scope.
  - `calc-combo-results.js` calls `window.build_assembly_svg(idx)`.
  - In non-module scripts, a top-level function typically becomes `window.build_assembly_svg` (**inferred**). If this file is ever converted to a module or wrapped, that assumption would break.

---

## Change Log (Architecture)

- **v0 (current)**
  - Browser-only Webflow-embedded system using sequential CDN script loading.
  - Webflow form gating rules engine (`calc-query.js`) with redirected-input syncing.
  - Async request → poll pipeline normalizing results to `window.comboSolutions` and rendering a solutions list from Webflow templates.
  - Modal Explore flow invoking SVG generation:
    - block renderer from canonical SVG template + external pattern images
    - assembler driven by declarative templates stored in `window.ASSEMBLY_TEMPLATES`
  - Repo history/version tags for releases: **(unknown)**
