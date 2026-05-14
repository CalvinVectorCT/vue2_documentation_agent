# Bugfix Requirements Document

## Introduction

The vue-docs-agent VS Code extension has scanners in `src/scan/` that are responsible for scanning a Vue 2 project workspace and extracting structured data (routes, Vuex modules, API endpoints, components, auth patterns, plugins, environment variables). The extracted data is then passed to an LLM to generate documentation. However, the scanners frequently produce empty results for many categories, causing the LLM to output "Not detected in scanned project data" throughout the generated documentation. Additionally, when information genuinely cannot be detected, the system should use a "TODO" placeholder rather than "Not detected" language.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the target project uses `Vue.use()` calls in files outside `src/plugins/` (e.g., in `src/main.js` importing from other directories, or in individual module files) THEN the pluginsScanner fails to detect plugins because its glob pattern `{src/plugins/**/*.{js,ts},src/main.{js,ts}}` does not cover all locations where `Vue.use()` may appear

1.2 WHEN the target project has Vuex store modules with actions, mutations, or getters containing nested objects or multi-line function bodies THEN the vuexScanner's `extractObjectKeys` regex `${objectName}\\s*:\\s*\\{([\\s\\S]*?)\\}` stops at the first closing brace, truncating the block and missing keys defined after the first nested object

1.3 WHEN the target project has route definitions that span more than 14 lines (e.g., routes with multiple meta fields, nested children, or extensive guard configurations) THEN the routesScanner's 14-line window truncates the route block and fails to extract all metadata (guards, meta fields, component references)

1.4 WHEN the target project has `.env` files at the workspace root THEN the environmentScanner's glob pattern `{.env,.env.*,src/**/*.env,src/**/*.env.*}` may fail to match root-level dotfiles depending on how `vscode.workspace.findFiles` resolves relative patterns without a leading `**/` or explicit root anchor

1.5 WHEN the target project registers components globally via `Vue.component('name', Component)` rather than in single-file `.vue` components THEN the componentsScanner misses these registrations because it only scans `src/**/*.vue` files

1.6 WHEN the target project has store utility files (e.g., `src/store/utilities/actions.js`, `src/store/utilities/getters.js`) that define shared action/getter/mutation helpers THEN the vuexScanner does not recognize these as Vuex-related because they may not contain the `Vuex` keyword or the `state:` + `mutations:` pattern together

1.7 WHEN the target project has mixins (e.g., `src/mixins/*.js`) that contain API calls, auth patterns, or component registrations THEN none of the scanners examine mixin files because the glob patterns do not explicitly include `src/mixins/**`

1.8 WHEN scanner results are empty and the LLM generates documentation THEN the system prompt instructs the LLM to write "Not detected in scanned project data" instead of a "TODO" placeholder that signals the information needs manual completion

### Expected Behavior (Correct)

2.1 WHEN the target project uses `Vue.use()` calls in any `.js` or `.ts` file under `src/` THEN the pluginsScanner SHALL detect all `Vue.use()` registrations regardless of which directory the file resides in

2.2 WHEN the target project has Vuex store modules with nested objects in actions, mutations, or getters blocks THEN the vuexScanner SHALL correctly parse the full block using brace-depth counting and extract all keys including those after nested objects

2.3 WHEN the target project has route definitions spanning more than 14 lines THEN the routesScanner SHALL use a dynamic window size (brace-depth tracking or expanded window) to capture the complete route object definition

2.4 WHEN the target project has `.env` files at the workspace root THEN the environmentScanner SHALL reliably match root-level `.env` and `.env.*` files by using glob patterns that explicitly cover the workspace root

2.5 WHEN the target project registers components globally via `Vue.component()` THEN the componentsScanner SHALL detect these registrations by also scanning `.js` and `.ts` files for `Vue.component()` calls

2.6 WHEN the target project has store utility files that export shared Vuex helpers (actions, getters, mutations) THEN the vuexScanner SHALL recognize these files and include their exported function names in the relevant module records or as shared utilities

2.7 WHEN the target project has mixin files under `src/mixins/` THEN the apiScanner, authScanner, and componentsScanner SHALL include `src/mixins/**/*.{js,ts}` in their scan patterns to detect API calls, auth patterns, and component usage within mixins

2.8 WHEN scanner results are empty or information cannot be determined for a documentation section THEN the system prompt SHALL instruct the LLM to write a `> ⚠️ TODO:` callout placeholder instead of "Not detected in scanned project data"

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the target project has standard Vue single-file components in `src/components/` and `src/views/` THEN the componentsScanner SHALL CONTINUE TO correctly extract component names, props, emits, and imported components from `.vue` files

3.2 WHEN the target project has a standard `src/router/index.js` with simple route definitions (under 14 lines each) THEN the routesScanner SHALL CONTINUE TO correctly extract path, name, component, meta, guards, and lazy-loading status

3.3 WHEN the target project has Vuex modules with simple (non-nested) actions, mutations, and getters THEN the vuexScanner SHALL CONTINUE TO correctly extract module names, namespaced status, state keys, getters, mutations, and actions

3.4 WHEN the target project has Axios-based API calls in `src/**/*.{js,ts}` and `src/**/*.vue` files THEN the apiScanner SHALL CONTINUE TO correctly detect HTTP method, URL path, function context, and auth hints

3.5 WHEN the target project has auth-related patterns (login/logout functions, token storage, interceptors, guards) THEN the authScanner SHALL CONTINUE TO correctly detect and categorize auth records

3.6 WHEN files cannot be read by the scanner (permission errors, encoding issues) THEN the readFiles utility SHALL CONTINUE TO silently add them to the `unresolved` array without crashing

3.7 WHEN the target project has storybook story files (`.stories.*`) THEN all scanners SHALL CONTINUE TO skip these files to avoid noise in the scan results
