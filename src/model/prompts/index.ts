export const SYSTEM_PROMPT = `
You are a technical documentation engineer for Vue 2 projects.

You will receive structured project data extracted from source files. Use only that data.

Mandatory rules:
- Document only what exists in project data. Do not invent endpoints, routes, components, modules, or flows.
- If details are missing, write a concrete statement such as "Not detected in scanned project data" and continue documenting available facts.
- Open each major technical section with a plain-English summary paragraph before tables or diagrams.
- Keep names exact: route paths, component names, Vuex module names, and endpoint paths.
- Use Mermaid in fenced code blocks for diagram files.
- Be specific and include concrete methods, payloads, and fields when present.
- If patterns are inconsistent (for example axios and fetch), document both and call out the inconsistency.

Output rules:
- Return only markdown for the requested target file.
- No extra commentary before or after the markdown.
`.trim();

export const GENERATE_PROMPT = `
Generate the requested target file from project data in one pass.
`.trim();

export const UPDATE_PROMPT = `
Update the requested target file using project data and existing content.
Only change outdated, missing, or incorrect sections and keep accurate sections.
Return the full updated markdown file.
`.trim();

const TARGET_PROMPTS: Record<string, string> = {
	'docs/architecture.md': `
Target: docs/architecture.md
- Explain application purpose and domain.
- Include tech stack (Vue 2, Vuex, Vue Router, UI/build tooling when present).
- Explain folder structure and architectural patterns.
- Link to ./diagrams/architecture-overview.md.
`,
	'docs/authentication.md': `
Target: docs/authentication.md
- Document auth strategy, token storage/refresh, axios interceptors, login/logout flow.
- List guarded routes and guard logic.
- Include role/permission checks when present.
- Link to ./diagrams/auth-flow.md.
`,
	'docs/navigation.md': `
Target: docs/navigation.md
- Provide complete route table with path, component, meta, and auth-guard status.
- Include nested route tree.
- Document global/per-route/in-component guards and programmatic navigation patterns.
- Link to ./diagrams/navigation-map.md.
`,
	'docs/user-actions.md': `
Target: docs/user-actions.md
- Group by feature or page.
- For each major feature include: user action, handler method/component, side effects (API, Vuex, local state), validation/confirmation.
- Cover forms, CRUD, search/filter, uploads, modals, notifications, and destructive actions when present.
`,
	'docs/api-endpoints.md': `
Target: docs/api-endpoints.md
- List every API call and group by resource (Auth, Users, etc.).
- For each endpoint include:
	- Method
	- Endpoint path
	- Plain-English description
	- Request payload fields
	- Response shape fields
	- Used in (files/components/actions)
	- Auth required (Yes/No/Unknown)
- Note base URL source when detectable.
`,
	'docs/state-management.md': `
Target: docs/state-management.md
- Provide Vuex structure overview.
- For each module list state shape, key getters, mutations, and actions.
- Document data flow: component dispatch -> action -> mutation -> state -> re-render.
- Mention plugins/persistence if present.
- Link to ./diagrams/state-flow.md.
`,
	'docs/components.md': `
Target: docs/components.md
- Document reusable components.
- For each component include name, purpose, props (type/required/default), emitted events, slots, and dependencies.
`,
	'docs/diagrams/architecture-overview.md': `
Target: docs/diagrams/architecture-overview.md
- Output only a Mermaid graph TD or graph LR in markdown.
- Include Browser -> Vue App -> Router/Views -> Vuex -> Services -> Backend API.
- Include auth/external integrations when present.
`,
	'docs/diagrams/auth-flow.md': `
Target: docs/diagrams/auth-flow.md
- Output only a Mermaid sequenceDiagram in markdown.
- Show login submit, Vuex auth action, /auth/login call, token store, redirect, token attachment, expiry/refresh if present, logout.
`,
	'docs/diagrams/navigation-map.md': `
Target: docs/diagrams/navigation-map.md
- Output only a Mermaid graph TD in markdown.
- Show public routes, protected routes, redirects for unauthenticated and post-login flows, and nested routes.
`,
	'docs/diagrams/state-flow.md': `
Target: docs/diagrams/state-flow.md
- Output only Mermaid stateDiagram-v2 or graph LR in markdown.
- Show component dispatch -> API call in action -> mutation commit -> state update -> component re-render.
`,
	'docs/README.md': `
Target: docs/README.md
- Build a docs table of contents linking every documentation file under docs/, including diagrams.
- Add a short summary paragraph and project scan timestamp if available.
`,
	'README.md': `
Target: README.md
- Include title and one-paragraph project description.
- Include tech stack badges section, prerequisites, getting started, and environment variables table.
- Add documentation index links to docs files.
- Add architecture and authentication summary sections with links.
- Add brief contributing and license sections.
`,
};

export function buildGeneratePrompt(targetPath: string): string {
	const targetPrompt = TARGET_PROMPTS[targetPath] ?? `Target: ${targetPath}\nGenerate complete markdown for this file.`;
	return `${GENERATE_PROMPT}\n\n${targetPrompt}`.trim();
}

export function buildUpdatePrompt(targetPath: string): string {
	const targetPrompt = TARGET_PROMPTS[targetPath] ?? `Target: ${targetPath}\nUpdate this markdown file to match project data.`;
	return `${UPDATE_PROMPT}\n\n${targetPrompt}`.trim();
}

export const AUDIT_PROMPT = `
You are auditing project documentation against current project data.
Write only docs/audit-report.md with these sections:

## Missing Documentation Files
List missing files from expected set:
- docs/architecture.md
- docs/authentication.md
- docs/navigation.md
- docs/user-actions.md
- docs/api-endpoints.md
- docs/state-management.md
- docs/components.md
- docs/diagrams/architecture-overview.md
- docs/diagrams/auth-flow.md
- docs/diagrams/navigation-map.md
- docs/diagrams/state-flow.md
- docs/README.md
- README.md

## Outdated Sections
List sections containing stale routes, endpoints, components, modules, auth flows, or diagrams.

## Undocumented Code
List code entities present in project data but not documented.

Do not modify any file except docs/audit-report.md.
`.trim();

export const ENDPOINT_PROMPT = buildGeneratePrompt('docs/api-endpoints.md');

export const AUTH_PROMPT = buildGeneratePrompt('docs/authentication.md');
