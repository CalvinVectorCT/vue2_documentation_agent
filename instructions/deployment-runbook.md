# Vue 2 Docs Agent Deployment Runbook

This runbook covers release, rollout, and operating model for using Vue 2 Docs Agent across multiple teams.

## 1) Pre-Deployment Readiness Gate

Complete this gate before the first org rollout.

- Set real package metadata in package.json:
  - publisher
  - repository URL
- Install dependencies and verify build/test locally:
  - npm install
  - npm run lint
  - npm test
  - npm run compile
- Verify command behavior in Extension Development Host against a real Vue 2 project:
  - @vue-docs /generate
  - @vue-docs /update
  - @vue-docs /audit
  - @vue-docs /endpoint
  - @vue-docs /auth
- Confirm release workflow permissions in GitHub:
  - Actions enabled
  - Ability to create releases from tags
- Decide internal support ownership:
  - Product owner (documentation standards)
  - Maintainer(s) (scanner/prompt fixes)

## 2) Release Runbook (VSIX)

Use this on every release.

1. Update version in package.json and CHANGELOG.md.
2. Create and merge a release PR to main.
3. Tag and push:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

4. Wait for publish workflow (.github/workflows/publish.yml) to finish.
5. Confirm release assets include:
   - vue-docs-agent-X.Y.Z.vsix
6. Smoke-test install from the release VSIX:

```bash
code --install-extension vue-docs-agent-X.Y.Z.vsix
```

7. Announce release with:
   - version
   - notable scanner/prompt changes
   - known limitations

## 3) Org Rollout Plan

Use a phased rollout to reduce risk.

### Phase A: Pilot (2-3 teams)

- Choose teams with active Vue 2 codebases and different architectures.
- Define pilot duration (typically 2 weeks).
- Success criteria:
  - docs folder generated and committed
  - /update used at least once per team
  - no blocking false documentation defects
- Collect issues in one tracked backlog (scanner false positives, missing extraction, prompt quality gaps).

### Phase B: Wave Rollout

- Expand by business unit or repository category.
- Keep one release train (for example bi-weekly) to avoid fragmented versions.
- Require each app team to nominate one docs champion.

### Phase C: Standardization

- Add team standard:
  - /generate for initial baseline
  - /update after feature merges affecting routes/APIs/auth/components
  - /audit before release hardening
- Add PR checklist item:
  - Documentation updated or audit result attached

## 4) Team Usage Playbook

Share this with engineers.

1. Install the approved VSIX version.
2. Open Vue 2 workspace root in VS Code.
3. Run @vue-docs /generate once to create baseline docs.
4. Commit docs/ as code.
5. On code changes, run @vue-docs /update and review diff before commit.
6. Before release, run @vue-docs /audit and resolve critical gaps.

## 5) Governance and Quality Controls

- Treat generated docs as reviewable code, not auto-trusted output.
- Require PR review from module owners for:
  - navigation.md changes
  - authentication.md changes
  - api-endpoints.md changes
- Track quality metrics per release:
  - number of scanner misses found by teams
  - number of doc regressions discovered post-merge
  - median time to fix scanner defects

## 6) Known Current Constraints

At the time of writing, validate these constraints in your implementation before broad rollout:

- Contributed VS Code settings exist (vueDocs.scanRoots, vueDocs.docsDir, vueDocs.includeDiagrams), but runtime code may not yet honor all of them.
- Prompt/rules source should be kept aligned between instructions/documentation-rules.md and src/model/prompts/index.ts.
- This extension is interactive in VS Code Copilot Chat; it is not a CI-native doc generator service.

## 7) Incident Response

If a release introduces incorrect docs generation:

1. Pause rollout and communicate affected versions.
2. Revert to previous stable VSIX release.
3. Capture failing sample files/repositories.
4. Patch scanner/prompt logic.
5. Ship patch release (vX.Y.Z+1) and publish migration note.

## 8) Operational Cadence

- Weekly triage for reported extraction issues.
- Bi-weekly or monthly release cadence.
- Quarterly review of documentation rules and command behavior.

## 9) Internal Communication Template

Use this in release notes or Slack/email.

Subject: Vue 2 Docs Agent vX.Y.Z available

- Install: code --install-extension vue-docs-agent-X.Y.Z.vsix
- Commands: @vue-docs /generate, /update, /audit, /endpoint, /auth
- What changed: [summary]
- Required action: [if any]
- Support channel: [team/contact]
