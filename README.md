# Vue 2 Docs Agent

A VS Code extension that generates and maintains structured documentation for Vue 2 projects using GitHub Copilot.

## How It Works

1. The extension scans your Vue 2 workspace — extracting routes, Vuex modules, API endpoints, components, and authentication patterns using deterministic regex-based scanners.
2. It builds a normalized `ProjectIndex` from the scan results.
3. It sends that index to Copilot (GPT-4o) with focused, target-specific prompts.
4. It writes the generated markdown directly into your `docs/` folder.

The model only writes prose — it never makes up routes, endpoints, or components. All structural facts come from the scan layer.

## Installation

Download the latest `.vsix` from [GitHub Releases](https://github.com/your-org/vue-docs-agent/releases), then:

```bash
code --install-extension vue-docs-agent-<version>.vsix
```

Or via VS Code UI: **Extensions panel → ⋯ → Install from VSIX...**

## Usage

Open a Vue 2 project in VS Code, then use Copilot Chat:

| Command | What it does |
|---------|-------------|
| `@vue-docs /generate` | Full docs run — creates the entire `docs/` folder |
| `@vue-docs /update` | Re-scans and updates changed sections only |
| `@vue-docs /audit` | Reports gaps without modifying files |
| `@vue-docs /endpoint` | Documents only API endpoints |
| `@vue-docs /auth` | Documents only the authentication flow |

You can append free-text instructions:

```
@vue-docs /generate focus on the payments module
```

## Generated Output

```
docs/
  README.md              ← index with project stats
  navigation.md          ← routes, guards, redirects
  authentication.md      ← auth flow, tokens, guards
  api-endpoints.md       ← HTTP endpoints grouped by resource
  state-management.md    ← Vuex modules, state, actions
  components.md          ← component props and emits
  architecture.md        ← architecture overview + Mermaid diagram
  audit-report.md        ← written by /audit only
```

## Configuration

VS Code settings (`.vscode/settings.json` or user settings):

```json
{
  "vueDocs.scanRoots": ["src", "router", "store", "services"],
  "vueDocs.docsDir": "docs",
  "vueDocs.includeDiagrams": true
}
```

## Org Deployment

For release, rollout, and operating guidance across teams, see [instructions/deployment-runbook.md](instructions/deployment-runbook.md).

## Development

```bash
npm install
npm run compile

# Press F5 in VS Code to open the Extension Development Host
# Open any Vue 2 project in the new window
# Use @vue-docs /generate in Copilot Chat
```

### Project Structure

```
src/
  extension.ts               ← entry point
  participant/
    registerParticipant.ts   ← chat participant registration and routing
  scan/
    workspaceScanner.ts      ← orchestrates all scanners
    routesScanner.ts         ← vue-router 3 route extraction
    vuexScanner.ts           ← Vuex module extraction
    apiScanner.ts            ← HTTP endpoint extraction
    componentsScanner.ts     ← .vue component extraction
    authScanner.ts           ← auth pattern extraction
    pluginsScanner.ts        ← Vue.use() plugin extraction
    readFiles.ts             ← workspace file utilities
  model/
    modelClient.ts           ← Copilot API wrapper
    promptBuilder.ts         ← builds data context slices per doc target
    prompts/index.ts         ← system and task prompts
  commands/
    generate.ts              ← /generate
    update.ts                ← /update
    audit.ts                 ← /audit
    endpoint.ts              ← /endpoint
    auth.ts                  ← /auth
  docs/
    render/docsIndex.ts      ← deterministic docs/README.md builder
    diff/readExistingDocs.ts ← reads current docs from disk
    diff/changelogHeader.ts  ← prepends update changelog entries
    write/writeDocs.ts       ← writes generated content to disk
    write/safeWrite.ts       ← safe file write/read with directory creation
  types/
    projectIndex.ts          ← ProjectIndex and related types
    commands.ts              ← DocCommand type
    docs.ts                  ← DocTarget, GeneratedDoc, AuditReport
instructions/
  documentation-rules.md     ← canonical doc rules (source of truth)
```

### Releasing

```bash
# Bump version in package.json, then:
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow builds the VSIX and attaches it to the release automatically.

## Contributing

Prompt and instruction changes require review from `@your-org/doc-team`.
Scanner changes require review from `@your-org/dev-team`.
See [CODEOWNERS](.github/CODEOWNERS).

Branch strategy:
- `main` — stable, always installable
- `develop` — integration
- `feature/*` — new commands or prompts
- `fix/*` — corrections
