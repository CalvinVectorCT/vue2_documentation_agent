# Implementation Plan

## Overview

This task list implements the bugfix for scanner detection coverage in the vue-docs-agent extension. It follows the exploratory bugfix workflow: write tests to confirm the bug exists, write preservation tests to capture baseline behavior, implement the fix, then verify all tests pass.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Scanner Detection Coverage for Non-Standard Vue 2 Projects
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the scanners fail to detect data in non-standard project layouts
  - **Scoped PBT Approach**: Scope the property to concrete failing cases for each defect:
    - pluginsScanner: `Vue.use(VueI18n)` in `src/i18n/index.js` → should detect plugin (currently returns empty)
    - vuexScanner: `actions: { fetch() { return { nested: true } }, update() {} }` → should find both keys (currently finds only first)
    - routesScanner: route definition spanning 20+ lines with meta/guards → should extract all metadata (currently truncates at line 14)
    - environmentScanner: `.env.production` at workspace root → should find it (currently may miss root dotfiles)
    - componentsScanner: `Vue.component('BaseBtn', BaseBtn)` in `src/main.js` → should detect global registration (currently misses JS files)
    - vuexScanner: `src/store/utilities/actions.js` with exported helpers → should recognize as Vuex-related (currently skips)
    - componentsScanner/apiScanner: `src/mixins/apiMixin.js` with API calls → should detect endpoints in mixins
    - SYSTEM_PROMPT: should contain TODO callout instruction instead of "Not detected" language
  - Write unit tests for each defect case using mock file systems
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to confirm root causes:
    - pluginsScanner returns empty when `Vue.use()` is outside `src/plugins/`
    - `extractObjectKeys` returns only first key when nested objects present
    - routesScanner misses metadata beyond line 14
    - environmentScanner misses root-level `.env` files
    - componentsScanner misses `Vue.component()` in JS/TS files
    - vuexScanner skips store utility files without `state:` + `mutations:`
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Standard Project Layout Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (standard project layouts):
    - Observe: componentsScanner correctly extracts name, props, emits from standard `.vue` files
    - Observe: routesScanner correctly extracts path, name, component, meta, guards for routes under 14 lines
    - Observe: vuexScanner correctly extracts all keys from flat (non-nested) action/mutation/getter blocks
    - Observe: apiScanner correctly detects axios/fetch calls in `src/**/*.{js,ts}` and `src/**/*.vue`
    - Observe: pluginsScanner correctly detects `Vue.use()` in `src/plugins/` and `src/main.{js,ts}`
  - Write property-based tests capturing observed behavior patterns:
    - For all standard `.vue` component files, componentsScanner extracts identical props/emits/imports
    - For all route definitions under 14 lines, routesScanner extracts identical metadata
    - For all flat Vuex modules (no nested objects), `extractObjectKeys` returns identical key sets
    - For all standard plugin locations (`src/plugins/`, `src/main.{js,ts}`), pluginsScanner returns identical results
    - For all axios/fetch calls in standard locations, apiScanner returns identical endpoint records
  - Property-based testing generates many test cases for stronger preservation guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Fix for scanner detection coverage defects
  - [ ] 3.1 Widen pluginsScanner glob pattern
    - Change glob from `'{src/plugins/**/*.{js,ts},src/main.{js,ts}}'` to `'src/**/*.{js,ts}'` to scan all JS/TS files under `src/` for `Vue.use()` calls
    - Existing `seen` set handles deduplication
    - _Bug_Condition: isBugCondition(input) where scannerName == "pluginsScanner" AND hasVueUseOutsideSrcPlugins(projectStructure)_
    - _Expected_Behavior: pluginsScanner detects all Vue.use() registrations regardless of directory_
    - _Preservation: Standard plugin detection in src/plugins/ and src/main.{js,ts} unchanged_
    - _Requirements: 2.1, 3.1_
  - [ ] 3.2 Replace non-greedy regex with brace-depth counting in vuexScanner
    - Implement `findMatchingBrace` helper that counts opening/closing braces to find correct block end
    - Replace `extractObjectKeys` regex `${objectName}\\s*:\\s*\\{([\\s\\S]*?)\\}` with brace-depth logic
    - Handle nested objects (2-3 levels deep) correctly
    - _Bug_Condition: isBugCondition(input) where scannerName == "vuexScanner" AND hasNestedObjectsInStoreBlocks(projectStructure)_
    - _Expected_Behavior: extractObjectKeys finds all top-level keys in actions/mutations/getters blocks regardless of nesting_
    - _Preservation: Flat Vuex modules without nested objects produce identical results_
    - _Requirements: 2.2, 3.3_
  - [ ] 3.3 Replace fixed 14-line window with brace-depth tracking in routesScanner
    - After finding a `path:` line, scan forward counting `{` and `}` until route object is fully closed
    - Keep minimum window of 14 lines for backward compatibility
    - Look backward from `path:` line to find opening `{` of route object
    - _Bug_Condition: isBugCondition(input) where scannerName == "routesScanner" AND hasRouteDefinitionsOver14Lines(projectStructure)_
    - _Expected_Behavior: routesScanner extracts complete route objects regardless of line count_
    - _Preservation: Routes under 14 lines produce identical extraction results_
    - _Requirements: 2.3, 3.2_
  - [ ] 3.4 Fix environmentScanner glob for root-level .env files
    - Change glob to use `'**/.env*'` or explicit workspace-root-relative patterns
    - Ensure `.env`, `.env.local`, `.env.production` at workspace root are reliably matched
    - Filter results to exclude `node_modules` (already excluded by `findFiles`)
    - _Bug_Condition: isBugCondition(input) where scannerName == "environmentScanner" AND hasRootLevelEnvFiles(projectStructure)_
    - _Expected_Behavior: environmentScanner reliably matches root-level .env and .env.* files_
    - _Preservation: Existing .env detection in src/ subdirectories unchanged_
    - _Requirements: 2.4_
  - [ ] 3.5 Add JS/TS scanning for global Vue.component() registrations in componentsScanner
    - After scanning `.vue` files, also scan `src/**/*.{js,ts}` for `Vue.component()` calls
    - Add regex: `VUE_COMPONENT_RE = /Vue\.component\s*\(\s*['"\`]([^'"\`]+)['"\`]/g`
    - Merge globally registered components into results array
    - This also covers mixin files under `src/mixins/` since glob includes all of `src/`
    - _Bug_Condition: isBugCondition(input) where scannerName == "componentsScanner" AND hasGlobalVueComponentCalls(projectStructure)_
    - _Expected_Behavior: componentsScanner detects Vue.component() registrations in JS/TS files_
    - _Preservation: Standard .vue component scanning unchanged_
    - _Requirements: 2.5, 2.7, 3.1_
  - [ ] 3.6 Broaden vuexScanner detection for store utility files
    - Add `isStoreUtilityFile(filePath, content)` check: returns true if path contains `/store/` and content has `export` + function definitions
    - Include exported function names from utility files in relevant module records or as shared utilities
    - _Bug_Condition: isBugCondition(input) where scannerName == "vuexScanner" AND hasStoreUtilityFiles(projectStructure)_
    - _Expected_Behavior: vuexScanner recognizes store utility files and includes their exported helpers_
    - _Preservation: Standard Vuex module detection unchanged_
    - _Requirements: 2.6, 3.3_
  - [ ] 3.7 Update SYSTEM_PROMPT to use TODO callout instead of "Not detected"
    - In `src/model/prompts/index.ts`, replace instruction to write "Not detected in scanned project data" with instruction to write `> ⚠️ TODO:` callout
    - Update wording to: "write a `> ⚠️ TODO:` callout explaining what information needs to be filled in manually"
    - _Bug_Condition: isBugCondition(input) where scannerName == "promptBuilder" AND scanResultIsEmpty(projectStructure)_
    - _Expected_Behavior: LLM produces TODO callout placeholder instead of "Not detected" language_
    - _Preservation: Non-empty scanner results continue to be used normally in prompt_
    - _Requirements: 2.8_
  - [ ] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Scanner Detection Coverage for Non-Standard Vue 2 Projects
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for all 8 defect conditions
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [ ] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Standard Project Layout Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions introduced)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm all exploration and preservation tests pass
  - Verify no other existing tests have been broken by the changes
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    ["1", "2"],
    ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"],
    ["3.8", "3.9"],
    ["4"]
  ]
}
```

## Notes

- Tasks 1 and 2 are independent and can be done in parallel
- All implementation sub-tasks (3.1-3.7) depend on tasks 1 and 2 being complete
- Verification sub-tasks (3.8, 3.9) must run after all implementation sub-tasks
- The exploration test (task 1) is expected to FAIL on unfixed code — this confirms the bug exists
- The preservation tests (task 2) are expected to PASS on unfixed code — this captures baseline behavior
- After implementation, the exploration test should PASS and preservation tests should still PASS
- The apiScanner and authScanner already use `src/**/*.{js,ts}` which covers `src/mixins/`, so Defect 7 is partially addressed by existing globs; the componentsScanner fix (3.5) covers the remaining gap
