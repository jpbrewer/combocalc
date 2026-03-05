# Webflow Integration Contract

Project: Combo Unit Calculation Tool\
Location: `/webflow-contract.md` (repo root)

------------------------------------------------------------------------

# 1) Purpose

This document defines the full integration contract between:

-   Webflow (DOM structure + CSS + Webflow redirected UI)
-   Custom JavaScript behavior (form gating, request/poll lifecycle,
    rendering, modal control)
-   SVG block builder + SVG assembly system

**Primary Goal:**\
Prevent silent breakage when Webflow structure changes by making:

-   Required IDs explicit
-   Element types explicit
-   Behavioral rules explicit
-   Data contracts explicit
-   Failure behavior explicit
-   Load order explicit

This file must be updated whenever Webflow structure or behavior
changes.

------------------------------------------------------------------------

# 2) Scope & Ownership

## Webflow Owns

-   HTML structure
-   CSS styling
-   Layout
-   Webflow "redirected" form controls:
    -   `span.w-radio-input`
    -   `span.w-checkbox-input`
    -   `w--redirected-checked` class
-   Form success/fail panels (`.w-form-done`, `.w-form-fail`)
-   Container sizing for result rendering (`#explore` fixed height)

## JavaScript Owns

-   Form gating logic
-   Blockers / unblocking sections
-   Default selections
-   Request → poll lifecycle
-   Result rendering
-   Modal control
-   Icon mapping
-   Button state transitions
-   Global data store (`window.comboSolutions`)
-   SVG block creation
-   SVG assembly orchestration
-   SVG insertion into DOM

------------------------------------------------------------------------

# 3) Source of Truth Policy

## Form Controls

-   **Source of truth:** `<input>.checked`
-   Webflow redirected spans are derived.
-   JS must never toggle `w--redirected-checked` manually.
-   JS may dispatch `change` events after programmatically setting
    `.checked`.

## Solutions Data

-   **Source of truth:** `window.comboSolutions`
-   Rendered DOM is derived from that array.
-   Assembled SVG string stored in:
    -   `comboSolutions[index].assembly_svg`

## Assembly Templates

-   **Source of truth:** `window.ASSEMBLY_TEMPLATES`
-   Delivered via CDN (jsDelivr)
-   Pure declarative layout instructions
-   No layout math in template file

------------------------------------------------------------------------

# 4) Page Variants

Currently documented variant:

-   Primary Webflow form page running:
    -   `calc-query.js`
    -   request/poll orchestrator
    -   `build_block_svgs(index)`
    -   `build_assembly_svg(index)`
    -   assembly templates asset file

If additional pages use these scripts:
-   IDs must match this contract
-   OR a variant section must be added here

------------------------------------------------------------------------

# 5) Required Rendering Containers

| ID               | Element Type | Purpose                                          |
|------------------|--------------|--------------------------------------------------|
| `explore`        | `div`        | Inline SVG assembly target (modal content area)  |
| `pattern_preload`| `div`        | Hidden container holding pattern `<img>` assets  |

### `#explore` Contract Requirements

-   Must exist before `build_assembly_svg(index)` is called.
-   Must have a fixed height (CSS-controlled).
-   JS will fully replace its inner contents.
-   SVG inserted as inline DOM element with:
    -   `width="100%"`
    -   `height="100%"`
    -   `preserveAspectRatio="xMidYMid meet"`

Removing fixed height from `#explore` will break layout scaling.

### `#pattern_preload` Contract Requirements

-   Present in live DOM as `<div class="pattern-repo" id="pattern_preload">`.
-   Contains 6 pattern `<img>` elements (see Canonical DOM Inventory, pattern images section).
-   JS references child `<img>` elements by their individual IDs.
-   Not referenced by ID directly in JS; only child images are accessed by ID.

------------------------------------------------------------------------

# 6) Canonical DOM Inventory

## Form wrapper

| ID              | Element Type     | Purpose                                    | Controlled By         | Failure Behavior if Missing               |
|-----------------|------------------|--------------------------------------------|-----------------------|-------------------------------------------|
| `wf_form_combo` | `<form>`         | Main query form; submission is intercepted | `calc-combo-results.js` | Script exits `init()` silently (no-op)    |

## Submit / navigation buttons

| ID             | Element Type          | Purpose                                              | Controlled By           | Failure Behavior if Missing                            |
|----------------|-----------------------|------------------------------------------------------|-------------------------|--------------------------------------------------------|
| `submit_query` | `<input type="submit">` | Triggers async request→poll flow; text/style managed | `calc-combo-results.js` | Falls back to `form.querySelector('button[type="submit"], input[type="submit"]')` |
| `search_again` | `<a>`                 | Resets UI back to input state                        | `calc-combo-results.js` | Reset button unavailable; user cannot restart without reload |

## Solutions area & form overlay

| ID               | Element Type | Purpose                                                   | Controlled By           | Failure Behavior if Missing       |
|------------------|--------------|-----------------------------------------------------------|-------------------------|-----------------------------------|
| `solutions_area` | `div`        | Wrapper around solutions UI; hidden until poll success    | `calc-combo-results.js` | Solutions silently not shown      |
| `blocker_form`   | `div`        | Overlay covering the form after results arrive            | `calc-combo-results.js` | Overlay skipped; form stays interactive after results |

## Section blockers

| ID         | Element Type | Purpose                                             | Controlled By   | Failure Behavior if Missing               |
|------------|--------------|-----------------------------------------------------|-----------------|-------------------------------------------|
| `blocker_b`| `div`        | Overlay blocking Section B until Section A complete | `calc-query.js` | Script disables itself on boot (required) |
| `blocker_c`| `div`        | Overlay blocking Section C until Section B complete | `calc-query.js` | Script disables itself on boot (required) |

## Section A — Location radios (INPUT elements)

| ID                  | Element Type          | Radio Group | Purpose                        | Controlled By   | Failure Behavior if Missing               |
|---------------------|-----------------------|-------------|--------------------------------|-----------------|-------------------------------------------|
| `loc_interior_radio`| `<input type="radio">`| `location`  | Selects Interior location      | `calc-query.js` | Script disables itself on boot (required) |
| `loc_exterior_radio`| `<input type="radio">`| `location`  | Selects Exterior location      | `calc-query.js` | Script disables itself on boot (required) |

## Section B — Starting Point radios (INPUT elements)

| ID               | Element Type          | Radio Group      | Purpose                                     | Controlled By   | Failure Behavior if Missing               |
|------------------|-----------------------|------------------|---------------------------------------------|-----------------|-------------------------------------------|
| `sp_rough_radio` | `<input type="radio">`| `starting_point` | Starting point = rough opening              | `calc-query.js` | Script disables itself on boot (required) |
| `sp_drywall_radio`| `<input type="radio">`| `starting_point` | Starting point = drywall opening (Interior only) | `calc-query.js` | Script disables itself on boot (required) |
| `sp_co_radio`    | `<input type="radio">`| `starting_point` | Starting point = clear opening (Interior only)  | `calc-query.js` | Script disables itself on boot (required) |

## Section C — Output type radios (INPUT elements)

| ID              | Element Type          | Radio Group | Purpose                      | Controlled By   | Failure Behavior if Missing               |
|-----------------|-----------------------|-------------|------------------------------|-----------------|-------------------------------------------|
| `out_door_radio`| `<input type="radio">`| `output`    | Output = door unit           | `calc-query.js` | Script disables itself on boot (required) |
| `out_co_radio`  | `<input type="radio">`| `output`    | Output = clear opening (CO)  | `calc-query.js` | Script disables itself on boot (required) |

## Section C — Door height radios (INPUT elements)

| ID                  | Element Type          | Radio Group      | Purpose                         | Controlled By   | Failure Behavior if Missing               |
|---------------------|-----------------------|------------------|---------------------------------|-----------------|-------------------------------------------|
| `dht_standard_radio`| `<input type="radio">`| `door_height_type`| Door height = standard          | `calc-query.js` | Script disables itself on boot (required) |

## Section C — Door width "who decides" radios (INPUT elements)

| ID                       | Element Type          | Radio Group   | Purpose                              | Controlled By   | Failure Behavior if Missing               |
|--------------------------|-----------------------|---------------|--------------------------------------|-----------------|-------------------------------------------|
| `dwho_system_decides_radio`| `<input type="radio">`| `door_who`  | System selects door width            | `calc-query.js` | Script disables itself on boot (required) |
| `dwho_user_decides_radio`  | `<input type="radio">`| `door_who`  | User specifies door width            | `calc-query.js` | Script disables itself on boot (required) |

## Section C — Door width scope radios (INPUT elements)

| ID                 | Element Type          | Radio Group      | Purpose                                    | Controlled By   | Failure Behavior if Missing               |
|--------------------|-----------------------|------------------|--------------------------------------------|-----------------|-------------------------------------------|
| `dws_unit_dim_radio`| `<input type="radio">`| `door_width_scope`| Door width = unit dimension measurement   | `calc-query.js` | Script disables itself on boot (required) |
| `dws_slab_dim_radio`| `<input type="radio">`| `door_width_scope`| Door width = slab dimension measurement   | `calc-query.js` | Script disables itself on boot (required) |

## Section C — CO "who decides" radios (INPUT elements)

| ID                        | Element Type          | Radio Group | Purpose                           | Controlled By   | Failure Behavior if Missing               |
|---------------------------|-----------------------|-------------|-----------------------------------|-----------------|-------------------------------------------|
| `cwho_system_decides_radio`| `<input type="radio">`| `co_who`   | System selects CO width           | `calc-query.js` | Script disables itself on boot (required) |
| `cwho_user_decides_radio`  | `<input type="radio">`| `co_who`   | User specifies CO width           | `calc-query.js` | Script disables itself on boot (required) |

## Section C — Advanced checkboxes (INPUT elements)

| ID                          | Element Type              | Purpose                                           | Controlled By   | Failure Behavior if Missing               |
|-----------------------------|---------------------------|---------------------------------------------------|-----------------|-------------------------------------------|
| `advanced_check_box`        | `<input type="checkbox">` | Master toggle for advanced gap options            | `calc-query.js` | Script disables itself on boot (required) |
| `specify_side_gaps_check_box`| `<input type="checkbox">`| Enables explicit side gap measurement input       | `calc-query.js` | Script disables itself on boot (required) |
| `specify_top_gap_check_box` | `<input type="checkbox">` | Enables explicit top gap measurement input        | `calc-query.js` | Script disables itself on boot (required) |

## Wrapper / visibility DIVs (controlled by JS)

| ID                                | Element Type                   | Purpose                                                      | Controlled By   | Failure Behavior if Missing               |
|-----------------------------------|--------------------------------|--------------------------------------------------------------|-----------------|-------------------------------------------|
| `door_detail_wrapper`             | `div`                          | Contains all door-specific Section C controls                | `calc-query.js` | Script disables itself on boot (required) |
| `door_width_scope_wrapper`        | `div`                          | Contains door width scope radio group (unit vs slab)         | `calc-query.js` | Script disables itself on boot (required) |
| `door_width_msmt_wrapper`         | `div`                          | Contains door width measurement input field                  | `calc-query.js` | Script disables itself on boot (required) |
| `co_detail_wrapper`               | `div`                          | Contains all CO-specific Section C controls                  | `calc-query.js` | Script disables itself on boot (required) |
| `co_width_msmt_wrapper`           | `div`                          | Contains CO width measurement input field                    | `calc-query.js` | Script disables itself on boot (required) |
| `gap_wrapper_div`                 | `div`                          | Parent wrapper for all gap-related controls (specify checkboxes + measurements) | `calc-query.js` | Script disables itself on boot (required) |
| `side_gap_msmt_wrapper`           | `div`                          | Contains side gap measurement input field                    | `calc-query.js` | Script disables itself on boot (required) |
| `top_gap_msmt_wrapper`            | `div`                          | Contains top gap measurement input field                     | `calc-query.js` | Script disables itself on boot (required) |

## Modal elements

| ID              | Element Type | Purpose                                                        | Controlled By           | Failure Behavior if Missing                        |
|-----------------|--------------|----------------------------------------------------------------|-------------------------|----------------------------------------------------|
| `modal-overlay` | `div`        | Full-screen modal backdrop; `display:flex` = open             | `calc-combo-results.js` | Modal cannot open; Explore silently fails to show  |
| `modal-panel`   | `div`        | Modal content panel; clicks here do not close modal           | `calc-combo-results.js` | Click-propagation guard absent; overlay-click closes modal unexpectedly |
| `modal-close`   | `div`        | Close button for modal                                         | `calc-combo-results.js` | No close button; user must use ESC or click overlay |
| `no-muntin`     | `div`        | Muntin toggle "off" button; default active (class `muntin-selection-active`) | `calc-combo-results.js` | Toggle not bound; default no-muntin render still works |
| `yes-muntin`    | `div`        | Muntin toggle "on" button; shows actual rows/cols muntins      | `calc-combo-results.js` | Toggle not bound; user cannot switch to muntin view |
| `choose-door-bore` | `div`     | Door bore chooser wrapper; normally hidden; shown when solution has single door | `calc-combo-results.js` | Bore chooser not shown; bore defaults to "right" |
| `door-bore-left`   | `div`     | Door bore "left" selector (class `door-selection-active` when active) | `calc-combo-results.js` | Toggle not bound; bore stays at default side |
| `door-bore-right`  | `div`     | Door bore "right" selector; default active (class `door-selection-active`) | `calc-combo-results.js` | Toggle not bound; bore stays at default side |
| `hardware_wrapper_div` | `div` | Outer hardware controls wrapper; normally hidden; shown (display:flex) when solution has any door (single or double) | `calc-combo-results.js` | Hardware controls not shown; no functional impact (defaults apply) |
| `hardware-color-wrapper` | `div` | Hardware color selector wrapper; normally hidden; shown (display:flex) when solution has any door | `calc-combo-results.js` | Hardware selector not shown; hinges use Chrome default |
| `hardware-selector` | `div`   | Container into which a `<select>` is dynamically created from `HARDWARE_COLORS` | `calc-combo-results.js` | No select rendered; hinges use Chrome default |
| `selector-format`  | text block | Style placeholder inside `#hardware-selector`; computed styles copied to `<select>`, then element removed at init | `calc-combo-results.js` | Select rendered without Webflow styling |
| `dbl-door-wrapper` | `div`   | Double door info wrapper; normally hidden; shown (display:flex) only when solution has double_door construction; hidden on modal close | `calc-combo-results.js` | Wrapper not shown; no impact on functionality |

## Modal data grid elements (inside `#modal-panel`, after `#explore`)

| Selector                              | Element Type | Purpose                                                     | Controlled By           | Failure Behavior if Missing            |
|---------------------------------------|--------------|-------------------------------------------------------------|-------------------------|----------------------------------------|
| `[data-modal-summary="section"]`      | `div`        | Opening summary block (width, height, jamb depth)           | `calc-combo-results.js` | Summary silently not shown             |
| `[data-modal-grid="section"]`         | `div`        | Solution grid container (icon, rows, notes, configure btn)  | `calc-combo-results.js` | Grid silently not shown                |
| `[data-modal-icon="img"]`             | `div`        | Icon wrapper; must contain `<img data-field="icon">`        | `calc-combo-results.js` | Icon silently not shown                |
| `[data-modal-row="template"]`         | `div`        | Row template; cloned per position key; hidden when template | `calc-combo-results.js` | Grid rows not rendered                 |
| `[data-modal-notes="row"]`            | `div`        | Notes row; contains `[data-field="notes"]`                  | `calc-combo-results.js` | Notes silently not shown               |
| `[data-modal-configure="btn"]`        | `a`/`button` | "Configure and Buy" button; not wired by JS currently       | Webflow (no JS wiring)  | Button absent; no functional impact    |

## Icon registry

| ID              | Element Type | Purpose                                                          | Controlled By           | Failure Behavior if Missing                    |
|-----------------|--------------|------------------------------------------------------------------|-------------------------|------------------------------------------------|
| `icon_registry` | `div`        | Hidden container; holds `<img data-icon-name="...">` mappings   | `calc-combo-results.js` | Icons fall back to origin-relative URLs (may 404) |

## Pattern preload images (children of `#pattern_preload`)

| ID                    | Element Type | Purpose                            | Controlled By               | Failure Behavior if Missing        |
|-----------------------|--------------|------------------------------------|-----------------------------|------------------------------------|
| `img_rail_wood`       | `<img>`      | Rail wood pattern image asset      | `calc-svg-block-builder.js` | SVG block pattern fill broken      |
| `img_stile_wood`      | `<img>`      | Stile wood pattern image asset     | `calc-svg-block-builder.js` | SVG block pattern fill broken      |
| `img_bevel_top_wood`  | `<img>`      | Top bevel wood pattern image asset | `calc-svg-block-builder.js` | SVG block pattern fill broken      |
| `img_bevel_bottom_wood`| `<img>`     | Bottom bevel wood pattern          | `calc-svg-block-builder.js` | SVG block pattern fill broken      |
| `img_bevel_side_wood` | `<img>`      | Side bevel wood pattern            | `calc-svg-block-builder.js` | SVG block pattern fill broken      |
| `img_glass`           | `<img>`      | Glass pattern image asset          | `calc-svg-block-builder.js` | SVG block pattern fill broken      |

------------------------------------------------------------------------

# 7) Form Logic Contract

## Overview: Three-Section Gate System

The form is divided into three sequential sections (A → B → C). Sections
are gated by overlay `div`s (blockers) that prevent interaction until
upstream sections are complete.

```
Section A (Location)     — always visible
       ↓ on selection
Section B (Starting Point) — unblocked when A complete
       ↓ on selection
Section C (Door/CO details + Advanced) — unblocked when B complete
```

## Blocker behavior

| Blocker      | Controls      | Unblocked when                                     |
|--------------|---------------|----------------------------------------------------|
| `blocker_b`  | Section B     | Any Location radio is selected (Interior or Exterior) |
| `blocker_c`  | Section C     | Any Starting Point radio is selected (see exceptions below) |

**Exterior exception:** When Exterior is selected, both `blocker_b` AND
`blocker_c` are removed immediately. `sp_rough_radio` is force-checked.
`sp_drywall_radio` and `sp_co_radio` are hidden (their `.w-radio` row
wrappers set to `display:none`).

## Section A — Location defaults and rules

-   On page load: no radio selected; both blockers engaged.
-   On location change: Section B radios are cleared; Section C is
    master-reset (see below).

## Section B — Starting Point defaults

-   All three starting point options visible and unchecked until
    Location selected.
-   In Exterior mode: only `sp_rough_radio` is shown; it is
    force-checked.
-   In Interior mode: all three options shown.

## Section C — Master Reset

Triggered on: page load, Location change, Starting Point change, CO→Door
transition.

After master reset:

| Control                     | State after reset   |
|-----------------------------|---------------------|
| `out_door_radio`            | checked             |
| `dht_standard_radio`        | checked             |
| `dwho_system_decides_radio` | checked             |
| `cwho_system_decides_radio` | unchecked           |
| `cwho_user_decides_radio`   | unchecked           |
| `dws_unit_dim_radio`        | unchecked           |
| `dws_slab_dim_radio`        | unchecked           |
| `advanced_check_box`        | unchecked           |
| `specify_side_gaps_check_box`| unchecked          |
| `specify_top_gap_check_box` | unchecked           |
| `door_detail_wrapper`       | hidden              |
| `door_width_scope_wrapper`  | hidden              |
| `door_width_msmt_wrapper`   | hidden              |
| `co_detail_wrapper`         | hidden              |
| `co_width_msmt_wrapper`     | hidden              |
| `gap_wrapper_div`           | hidden              |
| `side_gap_msmt_wrapper`     | hidden              |
| `top_gap_msmt_wrapper`      | hidden              |

## Section C — OUT group rules (Door vs CO)

**When `out_door_radio` selected (Door mode):**
-   `door_detail_wrapper` → visible **only if `advanced_check_box` is also checked**
-   `co_detail_wrapper` → hidden
-   `co_width_msmt_wrapper` → hidden
-   Door width rules apply (see below)

**When `out_co_radio` selected (CO mode):**
-   `door_detail_wrapper` → hidden
-   `door_width_scope_wrapper` → hidden
-   `door_width_msmt_wrapper` → hidden
-   `co_detail_wrapper` → visible **only if `advanced_check_box` is also checked**
-   `cwho_system_decides_radio` → force-checked
-   Door controls cleared: `dht_standard_radio`, `dwho_system_decides_radio`,
    `dwho_user_decides_radio`, `dws_unit_dim_radio`, `dws_slab_dim_radio`

**When switching CO → Door:** Full Section C master reset is triggered.

## Section C — Door width rules

| `dwho_*` state      | Result                                                               |
|---------------------|----------------------------------------------------------------------|
| `dwho_system_decides` | `door_width_scope_wrapper` hidden; `door_width_msmt_wrapper` hidden; `dws_*` cleared |
| `dwho_user_decides`   | `door_width_scope_wrapper` shown; `door_width_msmt_wrapper` shown only if a `dws_*` is selected |

## Section C — CO width rules

| `cwho_*` state       | Result                              |
|----------------------|-------------------------------------|
| `cwho_system_decides`| `co_width_msmt_wrapper` hidden       |
| `cwho_user_decides`  | `co_width_msmt_wrapper` shown        |

## Section C — Advanced rules

| State                                      | Result                                                |
|--------------------------------------------|-------------------------------------------------------|
| `advanced_check_box` unchecked (transition) | Full Section C master reset (same as `resetSectionC()`): all controls return to defaults, all wrappers hidden. Only triggers on checked→unchecked transition, not on every render. |
| `advanced_check_box` checked               | `gap_wrapper_div` shown; measurement wrappers shown only if corresponding checkbox is checked; `door_detail_wrapper` or `co_detail_wrapper` shown based on current OUT radio selection |
| `specify_side_gaps_check_box` checked      | `side_gap_msmt_wrapper` shown                         |
| `specify_top_gap_check_box` checked        | `top_gap_msmt_wrapper` shown                          |

------------------------------------------------------------------------

# 8) Rendering Targets

## Solutions list

| Selector          | Type         | Purpose                                                  |
|-------------------|--------------|----------------------------------------------------------|
| `.solutions-list` | CSS class    | Container where cloned solution cards are appended       |

## Template structures (data-attribute selectors)

| Selector                              | Element Type | Purpose                                                                    |
|---------------------------------------|--------------|----------------------------------------------------------------------------|
| `[data-solution-card="template"]`     | `div`        | Master template card; cloned once per solution; never removed; hidden      |
| `[data-solution-row="template"]`      | `div`        | Row template inside each card; cloned per `solution_grid` position key     |
| `[data-solution-summary="row"]`       | `div`        | Summary row inside each card; populated with `solution_grid.notes`         |
| `[data-solution-explore="btn"]`       | `<a>`        | Explore button inside each card; receives `data-solution-index` on clone   |
| `[data-solution-icon="img"]`          | `div`/wrapper| Icon wrapper inside card; must contain `<img data-field="icon">`           |

## Field population targets (`data-field`)

These elements are populated by `setField()` inside cloned cards/rows:

| `data-field` value    | Purpose                                               |
|-----------------------|-------------------------------------------------------|
| `icon`                | `<img>` element; `src` set to resolved icon URL       |
| `row`                 | Row label / position identifier                       |
| `building_block`      | Building block descriptor text                        |
| `order_dims`          | Order dimension string                                |
| `quantity`            | Quantity value                                        |
| `line_notes`          | Line notes value (may contain "XX" marker for door type label) |
| `summary`             | Summary/notes string from `solution_grid.notes`       |

## Icon registry lookup

-   `#icon_registry` must contain `<img data-icon-name="filename.png" src="...">` entries.
-   JS builds `ICON_MAP` (filename → Webflow asset URL) at `DOMContentLoaded`.
-   On Explore click, solution's `icon` path is normalized to filename and looked up in `ICON_MAP`.
-   If not found, falls back to `new URL(raw, window.location.origin)`.

## Webflow form panels

| Selector       | Purpose                                                    |
|----------------|------------------------------------------------------------|
| `.w-form-done` | Webflow "success" panel shown on poll success              |
| `.w-form-fail` | Webflow "failure" panel shown on poll failure/timeout      |

These are found via `form.closest(".w-form") || form.parentElement`.

------------------------------------------------------------------------

# 9) Event Wiring

## `calc-query.js` event listeners

All listeners attached in `wire()`, called from `boot()` on `DOMContentLoaded`.

| Target element(s)                   | Event    | Handler              | Notes                                       |
|-------------------------------------|----------|----------------------|---------------------------------------------|
| `loc_interior_radio`, `loc_exterior_radio` | `change` | `onLocationChange` | Clears B; resets C; calls render()   |
| `sp_rough_radio`, `sp_drywall_radio`, `sp_co_radio` | `change` | `onStartingPointChange` | Resets C; calls render() |
| All Section C inputs (10 IDs)       | `change` | `onSectionCChange`   | Calls render() only                         |

Section C inputs wired: `out_door_radio`, `out_co_radio`, `dht_standard_radio`,
`dwho_system_decides_radio`, `dwho_user_decides_radio`, `dws_unit_dim_radio`,
`dws_slab_dim_radio`, `cwho_system_decides_radio`, `cwho_user_decides_radio`,
`advanced_check_box`, `specify_side_gaps_check_box`, `specify_top_gap_check_box`.

**Boot timing guard:** Two nested `requestAnimationFrame` calls wrap the
initial `resetSectionC()` + `render()` to avoid Webflow initialization
timing races.

## `calc-combo-results.js` event listeners

All listeners attached in `init()`, called on `DOMContentLoaded`.

| Target            | Event         | Phase   | Handler                                                  | Guard condition                            |
|-------------------|---------------|---------|----------------------------------------------------------|--------------------------------------------|
| `form`            | `submit`      | capture | Async request→poll flow; `preventDefault` + `stopImmediatePropagation` | `form.reportValidity()` must pass |
| `document`        | `click`       | capture | Explore button handler                                   | `e.target.closest('[data-solution-explore="btn"]')` must match |
| `modal-overlay`   | `click`       | bubble  | Close modal if click target === overlay                  | `e.target === overlay`                     |
| `modal-panel`     | `click`       | bubble  | `stopPropagation` (prevents overlay-close)               | None                                       |
| `modal-close`     | `click`       | bubble  | Close modal                                              | None                                       |
| `document`        | `keydown`     | bubble  | Close modal on `Escape`                                  | `e.key === "Escape"`                       |
| `search_again`    | `click`       | bubble  | `resetUI()`; bound once via `dataset.bound = "1"` guard  | `dataset.bound !== "1"`                    |

------------------------------------------------------------------------

# 10) Data Attribute Contracts

Full list of `data-*` attributes used by JS as selectors or data carriers:

| Attribute                   | Expected value / type     | Used by                   | Notes                                                           |
|-----------------------------|---------------------------|---------------------------|-----------------------------------------------------------------|
| `data-solution-card`        | `"template"` (template) or `"solution-N"` (clones) | `calc-combo-results.js` | Template hidden; clones visible |
| `data-solution-row`         | `"template"` (template); removed from clones | `calc-combo-results.js` | Clones get `data-pos="posXX"` instead |
| `data-solution-summary`     | `"row"`                   | `calc-combo-results.js`   | Single element per card                                         |
| `data-solution-explore`     | `"btn"`                   | `calc-combo-results.js`   | Receives `data-solution-index` on clone wiring                  |
| `data-solution-icon`        | `"img"`                   | `calc-combo-results.js`   | Wrapper element; must contain `<img data-field="icon">`         |
| `data-solution-index`       | numeric string (0-based)  | `calc-combo-results.js`   | Written by JS; read on Explore click to index `window.comboSolutions` |
| `data-field`                | see Rendering Targets §8  | `calc-combo-results.js`   | `icon`, `row`, `building_block`, `order_dims`, `quantity`, `line_notes`, `summary`; modal also uses `notes`, `opening_width`, `opening_height`, `jamb_depth` |
| `data-icon-name`            | filename string (e.g. `arrangement_14_icon.png`) | `calc-combo-results.js` | On `<img>` inside `#icon_registry`; keyed into `ICON_MAP` |
| `data-modal-summary`        | `"section"`               | `calc-combo-results.js`   | Opening summary block inside modal                          |
| `data-modal-grid`           | `"section"`               | `calc-combo-results.js`   | Solution grid wrapper inside modal                          |
| `data-modal-icon`           | `"img"`                   | `calc-combo-results.js`   | Icon wrapper; must contain `<img data-field="icon">`        |
| `data-modal-row`            | `"template"` (template); removed from clones | `calc-combo-results.js` | Clones get `data-pos="posXX"` instead |
| `data-modal-notes`          | `"row"`                   | `calc-combo-results.js`   | Notes row inside modal grid                                 |
| `data-modal-configure`      | `"btn"`                   | Not wired by JS currently | "Configure and Buy" button                                  |
| `data-w-id`                 | Webflow interaction ID    | `calc-combo-results.js`   | Stripped from cloned cards + explore buttons to prevent Webflow IX errors |
| `data-bound`                | `"1"`                     | `calc-combo-results.js`   | Guard on `#search_again` to prevent double-binding              |

------------------------------------------------------------------------

# 11) Global Data Contracts

## window.comboSolutions

Array of normalized solution objects.

Required keys:

-   `index` (number, 0-based)
-   `job_id` (number)
-   `assembly_template` (string)
-   `assembly_no` (number/string)
-   `icon` (string)
-   `solution_grid` (object: key `notes` plus position keys `pos2`, `pos1`, `pos3`, `pos13`, `pos5`, `pos4`, `pos6`, `pos46` — all optional)
-   `build_object_specs` (object — note: renderer may require array; see ingestion-gaps.md)
-   `building_block_svgs` (populated by `build_block_svgs`)
-   `assembly_svg` (produced by `build_assembly_svg`)

## window.ASSEMBLY_TEMPLATES

Each template contains:

-   `template`
-   `description`
-   `positions`
-   `ops`

Operations supported:

-   `place`
-   `snap`
-   `validateSnap`

Snap anchors supported:

-   `TL`
-   `TR`
-   `BL`
-   `BR`

Tolerance currently: `2.00` SVG coordinate units

------------------------------------------------------------------------

# 12) Load Order Requirements

Enforced by `calc-bootstrap-loader.js` FILE_ORDER:

1.  `src/calc-query.js` — form UI rules engine
2.  `src/calc-combo-results.js` — request/poll/render orchestrator
3.  `assets/combo-assembly-templates-json.js` — assembly layout templates
4.  `assets/window-type-a-svg-raw.js` — SVG template string
5.  `src/calc-svg-block-builder.js` — parametric block renderer
6.  `src/calc-svg-block-assembler.js` — composite SVG assembler

`build_assembly_svg(index)` may only be called after:
-   DOM ready
-   `window.comboSolutions` populated
-   All scripts above have loaded

If any script fails to load, subsequent scripts will not load (sequential chain breaks).

------------------------------------------------------------------------

# 13) Known Fragility Points

High risk breakage areas:

-   Moving IDs from `<input>` to wrapper (breaks `getElementById` lookup; all 18 input IDs are on the `<input>` itself, not the `<label>`)
-   Changing `specify_side_gaps_check_box_wrapper` or `specify_top_gap_check_box_wrapper` from `<label>` to `<div>` (these are `<label class="w-checkbox">` in live DOM; wrapper-finding logic traverses `.w-checkbox`)
-   Changing `submit_query` from `<input type="submit">` to `<button>` (or vice versa) without updating `setButtonText` branch (checks `tagName === "input"`)
-   Changing `search_again` from `<a>` to `<button>` — low risk but note it is an anchor, not a button
-   Changing `modal-close` from `<div>` to anything — low risk, but note it is not a `<button>`
-   Removing fixed height from `#explore` — breaks layout scaling
-   Renaming assembly_template values — breaks assembler template lookup
-   Removing `viewBox` from block SVG output — breaks `preserveAspectRatio` scaling
-   Renaming global variables:
    -   `window.comboSolutions`
    -   `window.ASSEMBLY_TEMPLATES`
    -   `window.job_id`
    -   `window.build_assembly_svg`
    -   `window.build_block_svgs`
-   Renaming `data-solution-card`, `data-solution-row`, `data-solution-summary`, `data-solution-explore`, `data-solution-icon` attributes
-   Renaming `data-modal-summary`, `data-modal-grid`, `data-modal-icon`, `data-modal-row`, `data-modal-notes`, `data-modal-configure` attributes — breaks modal grid population
-   Removing modal grid template elements degrades gracefully (no crash) but modal data will not display
-   Renaming any `data-field` value (`icon`, `row`, `building_block`, `order_dims`, `quantity`, `line_notes`, `summary`, `notes`, `opening_width`, `opening_height`, `jamb_depth`)
-   Removing or renaming `.solutions-list` CSS class — breaks card list container lookup
-   Removing or renaming any of the 6 pattern image IDs (`img_rail_wood` etc.) — breaks SVG block pattern fills
-   Webflow Interactions (`data-w-id`) being re-added to cloned cards — JS strips these; if Webflow re-attaches to originals after publish, clones may inherit them before strip runs
-   Adding a form action attribute to `#wf_form_combo` — JS removes Webflow form attributes at init, but a native action could fire before JS intercepts on slow connections

------------------------------------------------------------------------

# 14) Failure Behavior Summary

If critical DOM elements missing:
-   `calc-query.js`: Logs error with missing IDs, disables itself entirely (no event listeners, no DOM mutations).
-   `calc-combo-results.js`: Many elements are optional; missing elements cause that feature to no-op. Missing `.solutions-list` or template card throws at render time.

If template missing:
-   Assembler throws.

If block SVG missing or malformed:
-   Assembler throws.

If snap validation fails:
-   Assembler throws.

If `build_assembly_svg` missing at Explore click:
-   Modal opens; warning logged; no SVG rendered.

If `#icon_registry` missing:
-   Icons fall back to origin-relative URL resolution (may 404 on Webflow-hosted pages).

If poll times out (> 40 attempts × 2s = 80s):
-   Error thrown; submit button restored; Webflow fail panel shown.

Fail behavior is currently fail-hard for assembler/renderer (intended for development
visibility). `calc-query.js` fails soft by disabling itself rather than throwing.
