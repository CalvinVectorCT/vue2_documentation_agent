# Scanner Not Detected Bugfix Design

## Overview

The vue-docs-agent VS Code extension scanners produce excessive "Not detected" results because their glob patterns, regex strategies, and file coverage are too narrow for real-world Vue 2 projects. This design addresses 8 distinct defects across 7 scanner files and 1 prompt file. The fix strategy is to widen detection coverage while preserving all existing correct behavior for standard project layouts.

## Glossary

- **Bug_Condition (C)**: The set of project configurations where a scanner fails to detect information that is present in the source code — due to narrow globs, truncating regex, or missing file coverage
- **Property (P)**: The desired behavior — scanners correctly extract all relevant data from any standard or non-standard Vue 2 project layout
- **Preservation**: Existing correct scanner behavior for standard project layouts (simple routes, flat Vuex modules, `.vue` components, standard `.env` placement) must remain unchanged
- **readMatchingFiles**: Utility in `src/scan/readFiles.ts` that wraps `vscode.workspace.findFiles` and reads matched files
- **extractObjectKeys**: Function in `vuexScanner.ts` that extracts action/getter/mutation names from object blocks using regex
- **SYSTEM_PROMPT**: The LLM system prompt in `src/model/prompts/index.ts` that instructs the model how to handle missing data

## Bug Details

### Bug Condition

The bug manifests when a target Vue 2 project uses any non-trivial structure: plugins registered outside `src/plugins/`, nested Vuex store objects, long route definitions, root-level `.env` files, globally registered components, store utility files, mixin files, or when scanner results are empty. In each case, the scanner either fails to find the relevant files or truncates the extracted data.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { projectStructure, scannerName }
  OUTPUT: boolean

  RETURN (scannerName == "pluginsScanner" AND hasVueUseOutsideSrcPlugins(projectStructure))
         OR (scannerName == "vuexScanner" AND hasNestedObjectsInStoreBlocks(projectStructure))
         OR (scannerName == "routesScanner" AND hasRouteDefinitionsOver14Lines(projectStructure))
         OR (scannerName == "environmentScanner" AND hasRootLevelEnvFiles(projectStructure))
         OR (scannerName == "componentsScanner" AND hasGlobalVueComponentCalls(projectStructure))
         OR (scannerName == "vuexScanner" AND hasStoreUtilityFiles(projectStructure))
         OR (scannerName == "anyScanner" AND hasMixinFiles(projectStructure))
         OR (scannerName == "promptBuilder" AND scanResultIsEmpty(projectStructure))
END FUNCTION
```

### Examples

- **Defect 1**: Project has `Vue.use(VueI18n)` in `src/i18n/index.js` → pluginsScanner returns empty because it only checks `src/plugins/**` and `src/main.{js,ts}`
- **Defect 2**: Vuex module has `actions: { fetchUser(ctx) { return api.get('/users') }, updateUser(ctx, payload) { ... nested object ... } }` → `extractObjectKeys` stops at first `}` and only finds `fetchUser`
- **Defect 3**: Route with 20 lines of meta/guards/children → routesScanner's `i + 14` window truncates the block, missing guards and meta fields
- **Defect 4**: `.env.production` at workspace root → environmentScanner glob `{.env,.env.*,...}` may not resolve root-level dotfiles on all platforms
- **Defect 5**: `Vue.component('BaseButton', BaseButton)` in `src/main.js` → componentsScanner only scans `.vue` files, misses global registrations
- **Defect 6**: `src/store/utilities/actions.js` exports shared action helpers → vuexScanner skips it because it lacks both `state:` and `mutations:` together
- **Defect 7**: `src/mixins/authMixin.js` contains `axios.get('/api/user')` → apiScanner never reads mixin files
- **Defect 8**: When plugins array is empty, LLM writes "Not detected in scanned project data" instead of a `> ⚠️ TODO:` callout

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Standard `.vue` component scanning (name, props, emits, imported components) must continue to work identically
- Simple route definitions (under 14 lines) must continue to be extracted correctly with path, name, component, meta, guards, and lazy status
- Non-nested Vuex modules with flat actions/mutations/getters must continue to extract all keys correctly
- Axios/fetch API call detection in `src/**/*.{js,ts}` and `src/**/*.vue` must continue to work
- Auth pattern detection (login, logout, token storage, interceptors, guards) must continue to work
- The `readFiles` utility must continue to silently add unreadable files to the `unresolved` array
- Storybook `.stories.*` files must continue to be excluded from all scanners

**Scope:**
All inputs that do NOT involve the 8 defect conditions should be completely unaffected by this fix. This includes:
- Projects with plugins only in `src/plugins/` and `src/main.{js,ts}`
- Vuex modules with simple (non-nested) object blocks
- Route definitions under 14 lines
- Projects without mixin files
- Projects without global `Vue.component()` registrations
- Projects without store utility files

## Hypothesized Root Cause

Based on the bug description and source code analysis, the root causes are:

1. **Narrow Glob Patterns (Defects 1, 4, 5, 7)**: Scanners use overly specific glob patterns that miss files in non-standard locations. The `pluginsScanner` only checks `{src/plugins/**/*.{js,ts},src/main.{js,ts}}`, the `componentsScanner` only checks `src/**/*.vue`, and no scanner includes `src/mixins/**`.

2. **Non-Greedy Regex Truncation (Defect 2)**: The `extractObjectKeys` function uses `[\s\S]*?` (non-greedy) to match the block body, which stops at the first `}` character. Nested objects (e.g., inside action bodies) contain `}` characters that prematurely terminate the match.

3. **Fixed Window Size (Defect 3)**: The `routesScanner` uses a hardcoded `i + 14` line window to capture route blocks. Routes with extensive meta fields, nested children, or guard configurations exceed this window.

4. **Glob Resolution Ambiguity (Defect 4)**: The pattern `{.env,.env.*,...}` relies on `vscode.workspace.findFiles` resolving bare filenames (without `**/` prefix) as workspace-root-relative. This behavior may be inconsistent across platforms or VS Code versions.

5. **Missing Heuristic for Utility Files (Defect 6)**: The vuexScanner's `looksLikeVuex` check requires either the `Vuex` keyword or both `state:` and `mutations:`/`actions:`/`getters:` together. Store utility files that export individual helpers (e.g., `export function fetchUsers(ctx) {...}`) don't match either pattern.

6. **Hardcoded "Not detected" Language (Defect 8)**: The `SYSTEM_PROMPT` in `src/model/prompts/index.ts` explicitly instructs the LLM to write "Not detected in scanned project data" rather than a TODO callout.

## Correctness Properties

Property 1: Bug Condition - Scanner Detection Coverage

_For any_ Vue 2 project where the bug condition holds (plugins outside `src/plugins/`, nested Vuex objects, routes over 14 lines, root `.env` files, global `Vue.component()` calls, store utility files, or mixin files), the fixed scanners SHALL detect and extract the relevant data that was previously missed.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - Standard Project Layout Behavior

_For any_ Vue 2 project where the bug condition does NOT hold (standard plugin locations, flat Vuex modules, short routes, standard `.env` placement, only `.vue` components, no mixins), the fixed scanners SHALL produce exactly the same results as the original scanners, preserving all existing correct extraction behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

Property 3: Bug Condition - TODO Placeholder Language

_For any_ documentation generation where scanner results are empty for a section, the fixed system prompt SHALL cause the LLM to produce a `> ⚠️ TODO:` callout placeholder instead of "Not detected in scanned project data".

**Validates: Requirements 2.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/scan/pluginsScanner.ts`

**Function**: `scanPlugins`

**Specific Changes**:
1. **Widen glob pattern**: Change from `'{src/plugins/**/*.{js,ts},src/main.{js,ts}}'` to `'src/**/*.{js,ts}'` to scan all JS/TS files under `src/` for `Vue.use()` calls
2. **Deduplicate**: The existing `seen` set already handles deduplication, so no additional logic needed

---

**File**: `src/scan/vuexScanner.ts`

**Function**: `extractObjectKeys`

**Specific Changes**:
1. **Replace non-greedy regex with brace-depth counting**: Instead of `[\s\S]*?\}`, implement a `findMatchingBrace` helper that counts opening and closing braces to find the correct end of the block
2. **New helper function**: Add `findBlockBody(content, objectName)` that locates `objectName: {` and then counts brace depth to extract the full body including nested objects

---

**File**: `src/scan/vuexScanner.ts`

**Function**: `extractModule`

**Specific Changes**:
1. **Broaden Vuex detection heuristic**: Add recognition of store utility files by checking if the file path contains `store` and the file exports functions (e.g., `export function` or `export const`) that match common Vuex helper patterns
2. **New pattern**: `isStoreUtilityFile(filePath, content)` — returns true if path contains `/store/` and content has `export` + function definitions without requiring `state:` + `mutations:`

---

**File**: `src/scan/routesScanner.ts`

**Function**: `extractRoutesFromContent`

**Specific Changes**:
1. **Replace fixed window with brace-depth tracking**: After finding a `path:` line, scan forward counting `{` and `}` until the route object is fully closed (brace depth returns to 0)
2. **Fallback minimum**: Keep a minimum window of 14 lines for backward compatibility, but allow expansion up to the end of the enclosing object
3. **Start detection**: Look backward from the `path:` line to find the opening `{` of the route object

---

**File**: `src/scan/environmentScanner.ts`

**Function**: `scanEnvironment`

**Specific Changes**:
1. **Anchor root-level glob**: Change `'{.env,.env.*,src/**/*.env,src/**/*.env.*}'` to `'{**/.env,**/.env.*,src/**/*.env,src/**/*.env.*}'` or use separate calls — one with `'.env'` and one with `'.env.*'` using explicit workspace-root-relative patterns
2. **Alternative**: Use `'**/.env*'` as a broader pattern that reliably matches root-level dotfiles across platforms, then filter results to exclude `node_modules` (already excluded by `findFiles`)

---

**File**: `src/scan/componentsScanner.ts`

**Function**: `scanComponents`

**Specific Changes**:
1. **Add JS/TS scanning for global registrations**: After scanning `.vue` files, also scan `src/**/*.{js,ts}` for `Vue.component()` calls
2. **New regex**: `VUE_COMPONENT_RE = /Vue\.component\s*\(\s*['"`]([^'"`]+)['"`]/g` to extract globally registered component names
3. **Merge results**: Add globally registered components to the `components` array with a flag or note indicating they are globally registered

---

**File**: `src/scan/apiScanner.ts`, `src/scan/authScanner.ts`, `src/scan/componentsScanner.ts`

**Function**: `scanApiEndpoints`, `scanAuth`, `scanComponents`

**Specific Changes**:
1. **Add mixin glob to apiScanner**: The apiScanner already scans `src/**/*.{js,ts}` which includes `src/mixins/`, so no change needed for API scanning
2. **Add mixin glob to authScanner**: The authScanner already scans `src/**/*.{js,ts}` which includes `src/mixins/`, so no change needed for auth scanning
3. **Add mixin glob to componentsScanner**: Add `src/mixins/**/*.{js,ts}` to the componentsScanner's scan to detect component usage in mixins (for `Vue.component()` calls and imported components)

> **Note**: Upon code review, `apiScanner` and `authScanner` already use `src/**/*.{js,ts}` which covers `src/mixins/`. The actual gap is in `componentsScanner` which only scans `*.vue` files. The fix for Defect 5 (adding JS/TS scanning for `Vue.component()`) will also cover mixin files.

---

**File**: `src/model/prompts/index.ts`

**Constant**: `SYSTEM_PROMPT`

**Specific Changes**:
1. **Replace "Not detected" instruction**: Change `"Not detected in scanned project data"` to instruct the LLM to write `> ⚠️ TODO: [description of what needs manual completion]`
2. **Update wording**: Change the rule from "write a concrete statement such as 'Not detected in scanned project data'" to "write a `> ⚠️ TODO:` callout explaining what information needs to be filled in manually"

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that provide mock file systems with non-standard project layouts and assert that scanners detect the expected data. Run these tests on the UNFIXED code to observe failures and confirm root causes.

**Test Cases**:
1. **Plugins Outside src/plugins/ Test**: Mock a project with `Vue.use(VueI18n)` in `src/i18n/index.js` — pluginsScanner should find it (will fail on unfixed code)
2. **Nested Vuex Object Test**: Mock a Vuex module with `actions: { fetch() { return { nested: true } }, update() {} }` — vuexScanner should find both keys (will fail on unfixed code)
3. **Long Route Definition Test**: Mock a route definition spanning 20+ lines with meta fields and guards — routesScanner should extract all metadata (will fail on unfixed code)
4. **Root .env File Test**: Mock a workspace with `.env.production` at root — environmentScanner should find it (will fail on unfixed code)
5. **Global Vue.component Test**: Mock `Vue.component('BaseBtn', BaseBtn)` in `src/main.js` — componentsScanner should detect it (will fail on unfixed code)
6. **Store Utility File Test**: Mock `src/store/utilities/actions.js` with exported helper functions — vuexScanner should recognize it (will fail on unfixed code)
7. **Mixin File Test**: Mock `src/mixins/apiMixin.js` with `axios.get('/api/data')` — apiScanner should detect the endpoint (will fail on unfixed code — actually this should pass since apiScanner already covers `src/**/*.{js,ts}`)
8. **TODO Placeholder Test**: Verify SYSTEM_PROMPT contains TODO instruction instead of "Not detected" (will fail on unfixed code)

**Expected Counterexamples**:
- pluginsScanner returns empty array when `Vue.use()` is in `src/i18n/index.js`
- vuexScanner's `extractObjectKeys` returns only the first key when nested objects are present
- routesScanner misses `meta.requiresAuth` when it appears on line 16+ of a route block
- Possible causes confirmed: narrow globs, non-greedy regex, fixed window size

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedScanner(input)
  ASSERT result.length > 0
  ASSERT allExpectedDataExtracted(result, input.expectedData)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalScanner(input) = fixedScanner(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (random route lengths under 14, random flat Vuex modules, random standard component structures)
- It catches edge cases that manual unit tests might miss (e.g., brace characters in string literals)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for standard project layouts, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Simple Route Preservation**: Generate random route definitions under 14 lines and verify the fixed routesScanner extracts identical results to the original
2. **Flat Vuex Module Preservation**: Generate random Vuex modules without nested objects and verify extractObjectKeys returns identical results
3. **Standard .vue Component Preservation**: Generate random `.vue` file content and verify componentsScanner extracts identical props, emits, and imports
4. **Standard Plugin Location Preservation**: Generate `Vue.use()` calls in `src/plugins/` and `src/main.js` and verify pluginsScanner returns identical results
5. **API Scanner Preservation**: Generate random axios/fetch calls in `src/**/*.{js,ts}` and verify apiScanner returns identical results

### Unit Tests

- Test `extractObjectKeys` with nested objects (2-3 levels deep) and verify all keys are found
- Test `extractRoutesFromContent` with route blocks of 14, 20, 30, and 50 lines
- Test `scanPlugins` with `Vue.use()` in `src/i18n/`, `src/config/`, and `src/bootstrap/`
- Test `scanEnvironment` with `.env`, `.env.local`, `.env.production` at workspace root
- Test `scanComponents` with `Vue.component('Name', Comp)` in JS files
- Test vuexScanner with store utility files that export functions
- Test SYSTEM_PROMPT contains TODO callout instruction

### Property-Based Tests

- Generate random Vuex module content with varying nesting depths and verify `extractObjectKeys` finds all top-level keys in the actions/mutations/getters block
- Generate random route definitions with varying line counts and verify all metadata is extracted when present
- Generate random project file trees and verify scanners produce superset results compared to original (no data lost)
- Generate random `.vue` file content with valid props/emits and verify componentsScanner extracts them identically to the original

### Integration Tests

- Test full `scanWorkspace` flow with a mock project containing all 8 defect conditions and verify non-empty results for all categories
- Test that the generated LLM prompt uses TODO callouts when scanner results are empty
- Test end-to-end: scan → prompt build → verify prompt contains project data (not "Not detected" placeholders)
