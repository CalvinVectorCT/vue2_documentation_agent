# Vue 2 Documentation Rules

These rules are the canonical source of truth for how the Vue Docs Agent generates documentation.
They are loaded at runtime by the extension and must be kept in sync with `src/model/prompts/index.ts`.

## Documentation Standards

### General
- Document ONLY what appears in the source code. Never invent routes, endpoints, components, or Vuex actions.
- Flag anything that cannot be determined: `> ⚠️ TODO: [description of what is missing]`
- Every section must open with a plain-English paragraph before any tables or code blocks.
- Match exact component names, route paths, and Vuex module names from the source.
- Be specific: cite file paths, method names, and exact values where relevant.

### Diagrams
- Use Mermaid for all diagrams inside fenced code blocks with the `mermaid` language tag.
- Architecture overview: `graph TD`
- Auth flow: `sequenceDiagram`
- Navigation map: `graph TD`
- State flow: `stateDiagram-v2`

### API Endpoints
- Group endpoints by resource (Auth, Users, Orders, Payments, etc.)
- Include: HTTP method, path, function name if known, source file reference.

### Components
- Document: name, props (type, required, default), emits, imported children.

### Authentication
- Cover: login/logout flow, token storage, navigation guards, interceptors, role/permission checks, token refresh.

## Output Files
| File | Contents |
|------|----------|
| `docs/navigation.md` | All routes, guards, redirects, nested routes |
| `docs/authentication.md` | Auth flow, guards, token handling |
| `docs/api-endpoints.md` | All HTTP endpoints grouped by resource |
| `docs/state-management.md` | Vuex modules, state keys, getters, mutations, actions |
| `docs/components.md` | Reusable components and their contracts |
| `docs/architecture.md` | High-level architecture diagram and narrative |
| `docs/README.md` | Index of all docs with project summary stats |

## Scan Targets
```
src/
router/
store/
services/
views/
components/
plugins/
utils/
api/
```

## Update Mode
- Prepend `> **Updated:** YYYY-MM-DD — [summary]` to each modified file.
- Only update sections that are outdated; preserve accurate content.

## Audit Mode
- Write only `docs/audit-report.md`.
- Do not modify any other file.
- Report: missing files, outdated sections, undocumented code.
