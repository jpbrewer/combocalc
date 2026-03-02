Skill: Maintain /docs/architecture.md

Purpose
Keep a portable, assistant-agnostic architecture document that remains accurate as the system evolves.
Goal: another engineer (or another AI tool like ChatGPT Codex) can onboard and modify safely.

When to update architecture.md
Update /docs/architecture.md whenever changes affect:
- File responsibilities (new file added, old file split/merged)
- Public globals/API surface
- Script load order
- Xano integration endpoints, polling model, request/response shapes
- Rendering pipeline (SVG block builder/assembler or templates)
- Webflow integration approach (major logic changes)

What architecture.md must contain (required sections)
1) Overview
   - What the tool does and where it runs (Webflow browser environment).

2) Execution Environment
   - Browser-only, CDN-loaded scripts, no build step, no modules.

3) High-level Data Flow
   - User input -> query state -> request to Xano -> polling -> solutions -> render -> user interaction.

4) Components & Responsibilities
   - Describe major JS files and their roles (UI glue, orchestrator, renderer, assets/data).

5) Public Interfaces
   - List canonical globals and what owns them.
   - List any intentionally callable init functions.

6) Script Load Order
   - The exact intended load order and why.

7) Error Handling & Failure Philosophy
   - “Fail gracefully, warn + skip” as baseline.

8) How to extend
   - Safe patterns for adding new features without breaking Webflow/CDN constraints.

Update procedure (step-by-step)
When you make code changes:
1) Identify which of the “When to update” triggers apply.
2) Update the “Components & Responsibilities” section:
   - Add/modify the entry for any changed file.
3) Update “Public Interfaces” if any global surface changed.
4) Update “Script Load Order” if dependencies or ordering changed.
5) Update “High-level Data Flow” if orchestration changed.
6) Add a short “Recent changes” note at the top (optional but recommended):
   - Date + summary of what changed and why.

Style requirements
- Keep it factual and implementation-aware.
- Avoid tool-specific language (“Claude said…”).
- Prefer stable nouns (files, globals, contracts) over conversational instructions.
