Skill: Maintain /docs/webflow-contract.md

Purpose
Define the integration contract between Webflow (DOM + CSS) and our JS behavior.
This prevents “mystery breakage” when Webflow structure changes and keeps the project portable across assistants/tools.

When to update webflow-contract.md
Update /docs/webflow-contract.md whenever:
- You add/rename/remove an element ID used by JS
- You change a radio group, default selection behavior, or unblocking logic
- You add new hidden sections/divs controlled by JS
- You change how modal containers, rendering targets, or result lists are structured
- You add new Webflow pages that run the scripts with different DOM variants

What webflow-contract.md must contain (required sections)
1) Scope & assumptions
   - Webflow controls markup and styling.
   - JS controls behavior only.
   - IDs are canonical; prefer ID-based wiring.

2) Page variants (if any)
   - List pages where scripts run and any differences.

3) Canonical DOM inventory
   - For each required element:
     - ID
     - Element type (input, div, container)
     - Purpose
     - Controlled by (which JS file)
     - Failure behavior if missing

4) Form logic contract
   - The rules for enabling/disabling/hiding/showing sections
   - Default selections and when they are set
   - Any “blockers/unblockers” concept

5) Rendering targets
   - Where SVG and results are inserted:
     - Container IDs
     - Expected layout constraints

6) Event wiring
   - What events are listened to (change/click/submit)
   - Anything that must be debounced or guarded

7) Known fragility points
   - “These are likely to change in Webflow; be careful.”

Update procedure (step-by-step)
Whenever you change Webflow:
1) Record the new/changed IDs and what they represent.
2) Add/modify entries in “Canonical DOM inventory.”
3) Update “Form logic contract” to match real behavior.
4) If a JS file was changed as a result, ensure its top doc block references these IDs consistently.
5) If the change impacts flow, update /docs/architecture.md as well.

Style requirements
- Treat this like an API spec: explicit, enumerated, testable.
- Prefer lists of IDs and behaviors over prose.
