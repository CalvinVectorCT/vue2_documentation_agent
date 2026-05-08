export interface DocTarget {
  /** Relative path under workspace root, e.g. "docs/authentication.md" */
  relativePath: string;
  /** Human-readable label used in progress messages */
  label: string;
}

export const ALL_DOC_TARGETS: DocTarget[] = [
  { relativePath: 'docs/navigation.md', label: 'Navigation' },
  { relativePath: 'docs/authentication.md', label: 'Authentication' },
  { relativePath: 'docs/api-endpoints.md', label: 'API Endpoints' },
  { relativePath: 'docs/state-management.md', label: 'State Management' },
  { relativePath: 'docs/components.md', label: 'Components' },
  { relativePath: 'docs/architecture.md', label: 'Architecture' },
  { relativePath: 'docs/README.md', label: 'Docs Index' },
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
