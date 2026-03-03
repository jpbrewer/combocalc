/**
 * File:
 *  calc-bootstrap-loader.js
 *
 * Role:
 *  ORCHESTRATOR
 *
 * Purpose:
 *  - Dynamically loads all ComboCalc modules in strict sequential order.
 *  - Ensures dependency order without requiring a bundler.
 *  - Acts as the single Webflow entry point for the entire system.
 *
 * Context:
 *  - Delivered via GitHub-backed CDN (jsDelivr for production; raw.githack.com for testing).
 *  - Executed inside Webflow via a single <script> embed.
 *  - Replaces traditional bundling/build tooling in favor of explicit runtime loading.
 *  - Designed for browser-only execution (no Node.js environment).
 *
 * Source of truth:
 *  - Authoritative:
 *      - The FILE_ORDER array below defines the dependency graph.
 *      - Script load order is strictly enforced.
 *  - Derived:
 *      - All downstream globals (window.WINDOW_TYPE_A_SVG_TEXT,
 *        window.build_block_svgs, etc.) are created by the loaded files.
 *
 * Inputs (reads):
 *
 *  DOM Contract:
 *  - Requires document.head to exist.
 *
 *  Data Contract:
 *  - No required globals before execution.
 *
 *  Runtime Assumptions:
 *  - Browser supports ES5+.
 *  - document.createElement + script.onload supported.
 *  - Network access to script host (raw.githack.com for testing; jsDelivr CDN for production).
 *
 * Outputs (produces):
 *
 *  Public API:
 *  - None directly.
 *  - Loads modules that attach globals to window.
 *
 *  DOM Mutations:
 *  - Appends <script> tags to <head>.
 *
 *  Data Produced:
 *  - Indirectly produces all downstream module globals.
 *
 * Load Order / Dependencies:
 *  - Loads files in FILE_ORDER sequence.
 *  - Each script must finish loading before the next begins.
 *  - Downstream modules may assume previous modules exist.
 *
 * Side Effects:
 *  - Network calls: Yes (script loading via CDN).
 *  - localStorage/cookies: No.
 *  - Timers: No.
 *  - Event listeners: script.onload for each injected script.
 *
 * Failure Behavior:
 *  - If a script fails to load:
 *      - Subsequent scripts will not load.
 *      - No retry logic.
 *      - Browser console will show network error.
 *  - Intended production enhancement:
 *      - Add console.error + hard stop if a file fails.
 *
 * Rule Summary / Invariants:
 *  - FILE_ORDER defines dependency graph.
 *  - Do not reorder unless you understand inter-module dependencies.
 *  - window-type-a-svg-raw.js must load before any renderer.
 *
 * Version Notes:
 *  - v0: Sequential dynamic loader for Webflow.
 *  - Explicit dependency ordering without bundler.
 */

(function () {

  const BASE =
    "https://cdn.jsdelivr.net/gh/jpbrewer/combocalc@unit-dims/";

  /**
   * IMPORTANT:
   * Order matters.
   * Treat this as your dependency graph.
   */
  const FILE_ORDER = [
    "src/calc-query.js",
    "src/calc-combo-results.js",
    "assets/combo-assembly-templates-json.js",
    "assets/window-type-a-svg-raw.js",
    "src/calc-svg-block-builder.js",
    "src/calc-svg-block-assembler.js"
  ];

  function loadSequentially(index) {
    if (index >= FILE_ORDER.length) return;

    const script = document.createElement("script");
    script.src = BASE + FILE_ORDER[index];
    script.async = false;

    script.onload = function () {
      loadSequentially(index + 1);
    };

    script.onerror = function () {
      console.error(
        "[ComboCalc Loader] Failed to load:",
        FILE_ORDER[index]
      );
    };

    document.head.appendChild(script);
  }

  loadSequentially(0);

})();