Skill: File-level Documentation Blocks (Top Comment Block)

Purpose
Ensure each runnable JS file is self-describing, safe to maintain under Webflow DOM changes, and portable across assistants/tools.

Where it applies
- All runnable JavaScript files in /src
- Any “asset JS” file that sets globals (e.g., templates JSON as a JS global) should also include a header, but may use Role=ASSET/DATA.

Hard rules
1) Exactly one doc block at the top of the file:
   - Use a single /* ... */ comment block at the very top.
   - Do not scatter large docs throughout the file.

2) Do not change runtime behavior just to satisfy docs.
   - Documentation must reflect reality, not rewrite it.

3) If uncertain, document uncertainty explicitly.
   - Prefer: “Assumption: …” or “Unknown: …”

Required headings (use exactly these labels)
- File:
- Role: (ASSET/DATA | CORE LOGIC | UI GLUE | ORCHESTRATOR | RENDERER)
- Purpose:
- Context:
- Inputs:
- Outputs:
- Public API:
- Failure modes:
- Load order assumptions:
- Notes for future refactor:

Definition guidance (what each field means)
- File:
  Exact filename.

- Role:
  ASSET/DATA: sets globals, constant data, templates, config.
  CORE LOGIC: calculations, transformations, scoring, rules engines.
  UI GLUE: DOM wiring, event listeners, Webflow form logic.
  ORCHESTRATOR: sequencing, polling, async workflows, cross-module coordination.
  RENDERER: SVG generation, visual assembly, UI rendering from solution objects.

- Purpose:
  2–4 lines: what this file does, not how.

- Context:
  Constraints and environment:
  - browser-only
  - Webflow DOM
  - CDN loading
  - Xano integration if relevant

- Inputs:
  Everything this file requires:
  - expected DOM IDs (explicitly state whether IDs refer to <input> elements)
  - expected globals it consumes
  - expected data shapes from Xano

- Outputs:
  Everything it produces:
  - DOM changes (shows/hides/enables)
  - rendered SVG inserted into specific containers
  - globals it sets
  - events it dispatches

- Public API:
  List globals/functions intentionally exposed.
  If none: “None — runs on load only.”

- Failure modes:
  What happens if:
  - element missing
  - data missing/invalid
  - network times out
  Must prefer “warn + safe fallback” over crash.

- Load order assumptions:
  List any required script ordering (what must already be loaded).

- Notes for future refactor:
  Migration notes (e.g., “if bundling later, preserve global X”),
  known technical debt, risky areas.

Template
Copy/paste this into new files and fill in:

/**
 * File: <filename>
 * Role: <...>
 *
 * Purpose:
 *  <2–4 line description>
 *
 * Context:
 *  - Browser-only script loaded via jsDelivr into Webflow pages.
 *  - Webflow owns HTML structure/CSS; this script owns behavior.
 *  - <Xano integration if relevant>
 *
 * Inputs:
 *  - DOM elements expected (IDs refer to <input> elements unless noted):
 *    - <id_1>, <id_2>, ...
 *  - Globals consumed:
 *    - <globalName>, ...
 *  - Data contract:
 *    - <shape summary>
 *
 * Outputs:
 *  - DOM effects:
 *    - <what changes>
 *  - Globals set (if any):
 *    - <globalName>
 *
 * Public API:
 *  - <window.someFn> / <window.SomeGlobal>
 *  - or: None — runs on load only.
 *
 * Failure modes:
 *  - Missing DOM elements: warn + no-op for that feature.
 *  - Invalid data: <fallback behavior>.
 *  - Network issues: <retry/timeout behavior>.
 *
 * Load order assumptions:
 *  - Must load after: <file1.js>, <data asset>, ...
 *
 * Notes for future refactor:
 *  - <things to preserve / pitfalls>
 */
