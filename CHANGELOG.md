# Changelog

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
