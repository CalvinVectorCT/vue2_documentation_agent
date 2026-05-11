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
2. Press `F5` to launch Extension Development Host.
3. In the new window, open your Vue 2 workspace root.
4. Open Copilot Chat and run:

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

## 3) GitHub Test Workflow

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
- Ensure dependency versions are compatible.

### Release Validation on Tag

1. Update `package.json` version and `CHANGELOG.md`.
2. Push a release tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

3. Confirm publish workflow in `.github/workflows/publish.yml` succeeds.
4. Download the VSIX from GitHub Release assets.
5. Install the VSIX and run a smoke test with `@vue-docs /generate` on a Vue 2 project.

## 4) Common Problems and Fixes

- Error: `No activated agent with id "vue-docs-agent.docs"`
  - Ensure `activationEvents` contains `onChatParticipant:vue-docs-agent.docs`.
  - Rebuild (`npm run compile`) and reload the Extension Development Host.

- Error: `Cannot find module 'esbuild'`
  - Run `npm install` in extension repo root.

- Lint cannot run (no config found)
  - Ensure `.eslintrc.cjs` exists in repo root.

- Jest exits with no tests
  - Ensure at least one `*.test.ts` file exists under `src/`.
