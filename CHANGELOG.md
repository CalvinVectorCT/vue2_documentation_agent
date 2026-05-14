# Changelog

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
