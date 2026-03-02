# Webflow Integration Contract

Project: Combo Unit Calculation Tool\
Location: `/docs/webflow-contract.md`

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

If additional pages use these scripts: - IDs must match this contract -
OR a variant section must be added here

------------------------------------------------------------------------

# 5) Required Rendering Container

  ID          Type   Purpose
  ----------- ------ ----------------------------
  `explore`   div    Inline SVG assembly target

### Contract Requirements

-   Must exist before `build_assembly_svg(index)` is called.
-   Must have a fixed height (CSS-controlled).
-   JS will fully replace its inner contents.
-   SVG inserted as inline DOM element with:
    -   `width="100%"`
    -   `height="100%"`
    -   `preserveAspectRatio="xMidYMid meet"`

Removing fixed height from `#explore` will break layout scaling.

------------------------------------------------------------------------

# 6) Global Data Contracts

## window.comboSolutions

Array of solution objects.

Required keys:

-   `assembly_template` (string)
-   `building_block_svgs` (populated by build_block_svgs)
-   `assembly_svg` (produced by build_assembly_svg)

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

# 7) Load Order Requirements

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

# 8) Known Fragility Points

High risk breakage areas:

-   Moving IDs from `<input>` to wrapper
-   Removing fixed height from `#explore`
-   Renaming assembly_template values
-   Removing `viewBox` from block SVG output
-   Changing global variable names:
    -   `window.comboSolutions`
    -   `window.ASSEMBLY_TEMPLATES`

------------------------------------------------------------------------

# 9) Failure Behavior Summary

If critical DOM elements missing: - Script disables itself.

If template missing: - Assembler throws.

If block SVG missing or malformed: - Assembler throws.

If snap validation fails: - Assembler throws.

Fail behavior is currently fail-hard (intended for development
visibility).
