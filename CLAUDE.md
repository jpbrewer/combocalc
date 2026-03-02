ComboCalc — Project Instructions (Claude)

This repository is a browser-only JavaScript application embedded into Webflow and loaded via CDN (jsDelivr). Webflow owns HTML structure and CSS. This repo’s JS owns behavior, orchestration, rendering, and Xano API integration.

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
