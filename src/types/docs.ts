export interface DocTarget {
  /** Relative path under workspace root, e.g. "docs/authentication.md" */
  relativePath: string;
  /** Human-readable label used in progress messages */
  label: string;
}

export const ALL_DOC_TARGETS: DocTarget[] = [
  { relativePath: 'docs/navigation.md', label: 'Navigation' },
  { relativePath: 'docs/authentication.md', label: 'Authentication' },
  { relativePath: 'docs/user-actions.md', label: 'User Actions' },
  { relativePath: 'docs/api-endpoints.md', label: 'API Endpoints' },
  { relativePath: 'docs/state-management.md', label: 'State Management' },
  { relativePath: 'docs/components.md', label: 'Components' },
  { relativePath: 'docs/architecture.md', label: 'Architecture' },
  { relativePath: 'docs/diagrams/architecture-overview.md', label: 'Architecture Diagram' },
  { relativePath: 'docs/diagrams/auth-flow.md', label: 'Auth Flow Diagram' },
  { relativePath: 'docs/diagrams/navigation-map.md', label: 'Navigation Diagram' },
  { relativePath: 'docs/diagrams/state-flow.md', label: 'State Flow Diagram' },
  { relativePath: 'docs/README.md', label: 'Docs Index' },
  { relativePath: 'README.md', label: 'Root README' },
];

export const AUTH_TARGETS: DocTarget[] = [
  { relativePath: 'docs/authentication.md', label: 'Authentication' },
];

export const ENDPOINT_TARGETS: DocTarget[] = [
  { relativePath: 'docs/api-endpoints.md', label: 'API Endpoints' },
];

export interface GeneratedDoc {
  target: DocTarget;
  content: string;
}

export interface AuditReport {
  missingFiles: string[];
  outdatedSections: string[];
  undocumentedCode: string[];
}
