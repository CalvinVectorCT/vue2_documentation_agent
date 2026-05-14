# Changelog

## [1.0.8] — 2026-05-14

### Fixed
- Hardened route scanning for common Vue 2 layouts by replacing single complex router glob with explicit multi-path scanning (`src/router/index.js`, `src/router.js`, `router/index.js`, `router.js`)
- Improved route redirect detection for object-form redirects (for example `redirect: { name: 'Layers' }`)
- Improved Vuex module parsing to detect object-key style actions/getters/mutations (for example `Load: (context) => ...`) common in `src/store/modules/*.js`
- Replaced combined Vuex file glob with explicit multi-path scanning to avoid missing store files in supported layouts

## [1.0.7] — 2026-05-14

### Fixed
- Broadened scanner glob patterns to detect routes, components, API endpoints, auth, and Vuex in non-standard Vue 2 folder layouts (components outside `src/components/`, router as `src/router.js`, API calls in custom sub-folders)
- Added storybook file/directory exclusion (`*.stories.*`, `storybook-static/`, `.storybook/`) across all scanners to prevent story files from polluting scan results
- Added Vuex detection guard so non-store JS files are skipped when scanning broadly

## [1.0.6] — 2026-05-14

### Fixed
- Reduced placeholder output by changing runtime prompt behavior from TODO placeholders to concrete "not detected" statements when data is missing
- Added environment/config scanning (`.env*`, `process.env`, and base URL hints) to improve README and API documentation quality
- Enriched API endpoint extraction with request/response/auth/base URL hints for more concrete endpoint documentation

## [1.0.5] — 2026-05-14

### Fixed
- Updated runtime model prompts to align with the new documentation instruction set
- Added missing generation/update targets: `docs/user-actions.md`, all required Mermaid diagram docs, and root `README.md`
- Expanded expected documentation target list and docs index to match the new specification

## [1.0.4] — 2026-05-14

### Fixed
- Removed duplicate legacy release workflow that could fail with GitHub release 403 errors
- Standardized tag releases on `.github/workflows/publish.yml` so the latest `.vsix` is attached consistently

## [1.0.3] — 2026-05-14

### Changed
- Aligned documentation rules with the canonical Vue 2 Copilot instruction set

## [1.0.2] — 2026-05-11

### Fixed
- GitHub Release notes now clearly instruct users to download and install the `.vsix` asset
- Clarified that source code zip/tarball is not the install package

## [1.0.1] — 2026-05-11

### Added
- Automated VSIX release workflow on git tag push
- Team installation guide for GitHub Releases

### Fixed
- Package configuration for correct VSIX bundling
- Publisher name and repository URL

## [1.0.0] — 2026-05-08

### Added
- Initial release
- `@vue-docs /generate` — full workspace documentation generation
- `@vue-docs /update` — targeted update with changelog headers
- `@vue-docs /audit` — gap analysis without modifying docs
- `@vue-docs /endpoint` — API endpoint documentation
- `@vue-docs /auth` — authentication flow documentation
- Deterministic scan layer: routes, Vuex, API endpoints, components, auth patterns, plugins
- Normalized `ProjectIndex` type — model only receives structured data, not raw source
- Safe file writer with directory creation
- GitHub Actions CI and VSIX release workflow
