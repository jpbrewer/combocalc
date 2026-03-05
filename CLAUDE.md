# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ComboCalc is a browser-only JavaScript application embedded into Webflow pages and loaded via CDN (jsDelivr). Webflow owns HTML structure and CSS. This repo’s JS owns behavior, orchestration, rendering, and Xano API integration.

## Development Workflow

There is no build step, no bundler, no test runner, no linter, and no package.json. The JS files run directly in the browser via sequential `<script>` injection.

**Testing changes:** Switch the `BASE` URL in `src/calc-bootstrap-loader.js` to use raw.githack.com (no caching) pointed at your branch, then hard-refresh the Webflow page:
- Production: `https://cdn.jsdelivr.net/gh/jpbrewer/combocalc@main/`
- Testing: `https://raw.githack.com/jpbrewer/combocalc/<branch>/`

**Verifying changes manually:** Load the Webflow page, submit the form, confirm solutions render, click Explore, confirm SVG renders in modal.

## Architecture at a Glance

All scripts communicate via `window` globals. `calc-bootstrap-loader.js` is the single entry point embedded in Webflow; it injects all other scripts sequentially via its `FILE_ORDER` array.

**Data flow:** Form submit → async POST to Xano → poll until ready → normalize response into `window.comboSolutions` → render solution cards → on Explore click, build parametric SVG blocks from template + assemble composite SVG via layout template ops → mount in modal.

**Key globals:** `window.comboSolutions` (solution store), `window.job_id`, `window.ASSEMBLY_TEMPLATES`, `window.WINDOW_TYPE_A_SVG_TEXT`, `window.build_block_svgs(index)`, `window.build_assembly_svg(index)`.

See `/architecture.md` for full details including module inventory, data model, DOM contract, and load order.

DOCUMENTATION SYSTEM (REQUIRED)
This project uses a “policy + skills” documentation approach:
- This file (CLAUDE.md) states high-level rules and required artifacts.
- Skills files under /skills define how to comply (templates, procedures, update rules).
- Canonical docs live in the repo root and must remain current.

Required docs:
1) /architecture.md
   - Must describe the system at the architecture level and stay current.
   - Update rules and workflow are defined in: /skills/skill-architecture.md

2) /webflow-contract.md
   - Must define the DOM contract with Webflow: expected IDs/selectors, behaviors, and failure modes.
   - Update rules and workflow are defined in: /skills/skill-webflow-contract.md

3) File-level Top Comment Block Standard
   - Every runnable JS file in /src must have a single top-of-file documentation block.
   - The block content and rules are defined in: /skills/skill-docblocks.md

NON-NEGOTIABLE TECH CONSTRAINTS
- No frameworks. No bundlers. No build steps.
- No ES module syntax (no import/export).
- Must remain “drop-in” safe for Webflow embeds and sequential script loading.
- Preserve existing public interfaces/globals; do not rename or remove them.

WEBFLOW DOM CONTRACT RULE
- Do not require Webflow markup changes unless explicitly asked.
- If a required element is missing, code must fail gracefully (warn + skip), not crash.

WHEN MODIFYING THE PROJECT
Whenever code changes affect:
- public interfaces, load order, runtime dependencies, or file responsibilities:
  Update /architecture.md per /skills/skill-architecture.md

Whenever code changes affect:
- DOM IDs, selectors, form behaviors, UI state logic tied to Webflow:
  Update /webflow-contract.md per /skills/skill-webflow-contract.md

Whenever a file is created/modified in /src:
- Ensure the required top-of-file doc block exists and remains accurate per /skills/skill-docblocks.md

Whenever a new file is added to /src or /assets:
- Add it to FILE_ORDER in calc-bootstrap-loader.js at the correct
  position in the dependency chain.
- Update /architecture.md (module inventory, load order).

DOC UPDATE CHECKLIST (RUN AFTER ANY CHANGE)
- If you touched /src code: verify its top-of-file doc block is accurate.
- If you touched DOM IDs / Webflow behavior: update /webflow-contract.md.
- If you changed responsibilities, load order, or APIs: update /architecture.md.

YOUR USE OF DOCUMENTATION SYSTEM
While not required, it is anticipated that in plan mode, you will consult the documentation system just as you consult the code to answer questions and solve problems.

Since the documentation system is a summary and is derivative of the code, documentation should be deemed reliable but not guaranteed, the code itself is the ultimate source of truth. 