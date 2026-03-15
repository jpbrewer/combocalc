# Alpha-Muntins Prompt

## Context

The SVG pipeline currently accepts a `muntins` boolean parameter that controls how building blocks are rendered. When `muntins=false`, each build object is rendered as a single pane (1 row, 1 col). When `muntins=true`, it uses the `rows` and `cols` values already present on each build object.

The backend data contract is changing. Going forward, `rows` and `cols` on every build object will always equal `1`. The backend will also provide `suggested_rows` and `suggested_cols` representing the recommended multi-pane configuration.

## What Needs to Change

### 1. SVG Pipeline Rendering Logic

Update the block builder so that when `muntins=true`, it reads `suggested_rows` and `suggested_cols` from the build object instead of `rows` and `cols`. When `muntins=false`, it continues to use `rows` and `cols` as before (which will always be 1).

Do not mutate the build object. This is a read-time substitution only — `rows` and `cols` on the build object must remain untouched by the rendering pipeline.

Note that while all build objects will have `suggested_rows` and `suggested_cols`, some construction types  (i.e. construction types other than windows and doors), won't use `rows` and `cols` or `suggested_rows` and `suggested_cols` in any way because they simply don't apply to that type of construction. For these build objects, the pipeline can simply ignore `suggested_rows` and `suggested_cols` or simply fall back gracefully to `rows` and `cols` regardless of the `muntins` flag.

### 2. Save the Muntins Selection onto the Solution Object

When the customer toggles muntins on or off and the pipeline renders, save the current state of the `muntins` boolean onto the solution object as `muntins: true` or `muntins: false`. But the customer's choice must be recorded into this flag, even if the SVG that will then be presented is already cached. So any runtime behavior that cuts short because of caching should capture customer behavior into the flag before terminating  

`munstins` is a solution-level flag — one parameter per solution object in `comboSolutions`, not per build object in the `build_objects` array.

## What Must Not Change

- All existing caching behavior (dual-cache keyed on the muntins boolean)
- All existing invocation paths from `calc-modal.js`
- The `muntins` parameter interface on `build_assembly_svg` and `build_block_svgs`
- Any behavior unrelated to row/col reading and the new solution-level flag
