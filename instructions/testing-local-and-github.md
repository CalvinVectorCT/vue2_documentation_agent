# Testing Guide: Local Vue 2 Workspace and GitHub

This guide explains how to test Vue 2 Docs Agent locally in VS Code and through GitHub workflows.

## 1) Local Test in a Vue 2 Workspace

Use this flow to validate the extension behavior before pushing changes.

### Prerequisites

- VS Code with GitHub Copilot enabled and signed in.
- A real Vue 2 project folder (routes, store, services, components).
- Node.js 20+ installed.

### Build and Validate the Extension

From the extension repository root:

```bash
npm install
npm run lint
npm test
npm run compile
```

Expected result:

- Lint completes without errors.
- Tests pass.
- Compile succeeds and writes `out/extension.js`.

### Run in Extension Development Host

1. Open this extension repo in VS Code.
2. Open Run and Debug and select `Run Extension`.
3. Press `F5` (or click Start Debugging) to launch Extension Development Host.
4. In the new window, open your Vue 2 workspace root.
5. Open Copilot Chat and run:

```text
@vue-docs /generate
```

Then validate additional commands:

```text
@vue-docs /update
@vue-docs /audit
@vue-docs /endpoint
@vue-docs /auth
```

### Verify Generated Files

Confirm the Vue 2 project now contains:

- `docs/README.md`
- `docs/navigation.md`
- `docs/authentication.md`
- `docs/api-endpoints.md`
- `docs/state-management.md`
- `docs/components.md`
- `docs/architecture.md`

For `/audit`, confirm `docs/audit-report.md` is written.

## 2) Local Test Using Built VSIX

Use this flow to test as an installed extension (closer to production behavior).

From repo root:

```bash
npm run package
```

Install the generated VSIX:

```bash
code --install-extension vue-docs-agent-<version>.vsix
```

Reload VS Code, open a Vue 2 project, and run the same `@vue-docs` commands.

## 3) Install from GitHub Releases (For Team Members)

Team members can test and use the extension without cloning the repository.

### Prerequisites

- VS Code 1.90.0 or later
- GitHub Copilot extension enabled and signed in

### Installation Steps

1. Go to the [Releases page](https://github.com/CalvinVectorCT/vue2_documentation_agent/releases)
2. Download the latest `vue-docs-agent-*.vsix` file
3. In VS Code, open the Extensions view (**Ctrl+Shift+X**)
4. Click the **...** menu and select **Install from VSIX...**
5. Select the downloaded `.vsix` file
6. VS Code will install and reload

### Using the Extension

1. Open your Vue 2 project in VS Code
2. Open the Copilot Chat sidebar (**Ctrl+Shift+I**)
3. Use the `@vue-docs` chat participant with these commands:

```text
@vue-docs /generate    # Scan and generate full docs/ folder
@vue-docs /update      # Re-scan and update existing documentation
@vue-docs /audit       # Check docs against codebase and report issues
@vue-docs /endpoint    # Extract and document only API endpoints
@vue-docs /auth        # Document authentication flow and route guards
```

## 4) GitHub Test Workflow

Use this flow to validate remote CI and release packaging.

### CI Validation on Push/PR

1. Push a branch or open a PR to `main` or `develop`.
2. Confirm CI workflow in `.github/workflows/ci.yml` passes:
   - Install dependencies
   - Lint
   - Test
   - Compile

If CI fails at setup:

- Ensure `package-lock.json` is committed.

### Automated VSIX Release

When you push a tag matching `v*` pattern, the release workflow automatically:

1. Builds the extension
2. Packages it as a VSIX
3. Creates a GitHub Release with the VSIX attached

**To trigger a release:**

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The VSIX will appear on the [Releases page](https://github.com/CalvinVectorCT/vue2_documentation_agent/releases) within minutes.

- Ensure dependency versions are compatible.

## Troubleshooting

- Error: `No activated agent with id "vue-docs-agent.docs"`
  - Ensure `activationEvents` contains `onChatParticipant:vue-docs-agent.docs`.
  - Rebuild (`npm run compile`) and reload the Extension Development Host.

- Error: `Cannot find module 'esbuild'`
  - Run `npm install` in extension repo root.

- Lint cannot run (no config found)
  - Ensure `.eslintrc.cjs` exists in repo root.

- Jest exits with no tests
  - Ensure at least one `*.test.ts` file exists under `src/`.
