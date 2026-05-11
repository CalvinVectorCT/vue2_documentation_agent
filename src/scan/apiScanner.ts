import { ApiEndpointRecord, HttpMethod } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

// Axios and custom wrapper patterns
const AXIOS_CALL_RE = /(?:axios|api|http|client|service|request)\.(get|post|put|patch|delete|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const TEMPLATE_LITERAL_RE = /(?:axios|api|http|client|service|request)\.(get|post|put|patch|delete|head)\s*\(\s*`([^`]+)`/gi;
const FETCH_RE = /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{[^}]*method\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`])?/gi;
const FUNCTION_CONTEXT_RE = /(?:async\s+)?(?:function\s+|(?:const|let|var)\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\bfunction\b))?/;

const HTTP_METHODS: Record<string, HttpMethod> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH',
  delete: 'DELETE', head: 'HEAD', options: 'OPTIONS',
};

const RESOURCE_GROUPS: [RegExp, string][] = [
  [/\/auth\//i, 'Auth'],
  [/\/user(s)?\//i, 'Users'],
  [/\/order(s)?\//i, 'Orders'],
  [/\/product(s)?\//i, 'Products'],
  [/\/payment(s)?\//i, 'Payments'],
  [/\/role(s)?\//i, 'Roles'],
  [/\/admin\//i, 'Admin'],
  [/\/file(s)?\/|\/upload\//i, 'Files'],
  [/\/report(s)?\//i, 'Reports'],
  [/\/notification(s)?\//i, 'Notifications'],
];

function inferGroup(path: string): string {
  for (const [re, group] of RESOURCE_GROUPS) {
    if (re.test(path)) return group;
  }
  // Derive from first meaningful path segment
  const segments = path.replace(/^\/api\//, '').split('/');
  const seg = segments[0];
  if (seg && seg.length > 1 && !seg.startsWith(':') && !seg.startsWith('{')) {
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  }
  return 'General';
}

/**
 * Scan service, API, and component files for HTTP endpoint calls.
 */
export async function scanApiEndpoints(unresolved: string[]): Promise<ApiEndpointRecord[]> {
  const files = await readMatchingFiles(
    '{src/services/**/*.{js,ts},src/api/**/*.{js,ts},src/utils/**/*.{js,ts},src/plugins/**/*.{js,ts},src/views/**/*.vue,src/components/**/*.vue}',
    unresolved
  );

  const endpoints: ApiEndpointRecord[] = [];
  const seen = new Set<string>();

  for (const [filePath, content] of files) {
    extractEndpoints(content, filePath, endpoints, seen);
  }

  // Deduplicate and sort by group then path
  return endpoints.sort((a, b) => {
    const g = (a.group ?? '').localeCompare(b.group ?? '');
    return g !== 0 ? g : a.path.localeCompare(b.path);
  });
}

function extractEndpoints(
  content: string,
  filePath: string,
  out: ApiEndpointRecord[],
  seen: Set<string>
): void {
  const lines = content.split('\n');

  const addEndpoint = (method: HttpMethod, path: string, line: number) => {
    const key = `${method}:${path}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Try to find the enclosing function name
    const contextWindow = lines.slice(Math.max(0, line - 5), line).join('\n');
    const fnMatch = FUNCTION_CONTEXT_RE.exec(contextWindow);

    out.push({
      method,
      path,
      functionName: fnMatch ? fnMatch[1] : undefined,
      filePath,
      line: line + 1,
      group: inferGroup(path),
    });
  };

  // Axios / wrapper calls
  let match: RegExpExecArray | null;
  const axiosCopy = new RegExp(AXIOS_CALL_RE.source, 'gi');
  while ((match = axiosCopy.exec(content)) !== null) {
    const method = HTTP_METHODS[match[1].toLowerCase()] ?? 'UNKNOWN';
    const lineNum = content.substring(0, match.index).split('\n').length - 1;
    addEndpoint(method, match[2], lineNum);
  }

  // Template literal URLs
  const tlCopy = new RegExp(TEMPLATE_LITERAL_RE.source, 'gi');
  while ((match = tlCopy.exec(content)) !== null) {
    const method = HTTP_METHODS[match[1].toLowerCase()] ?? 'UNKNOWN';
    const lineNum = content.substring(0, match.index).split('\n').length - 1;
    // Normalize template literals to a representative path
    const path = match[2].replace(/\$\{[^}]+\}/g, ':param');
    addEndpoint(method, path, lineNum);
  }

  // fetch() calls
  const fetchCopy = new RegExp(FETCH_RE.source, 'gi');
  while ((match = fetchCopy.exec(content)) !== null) {
    const method: HttpMethod = match[2]
      ? ((match[2].toUpperCase() as HttpMethod))
      : 'GET';
    const lineNum = content.substring(0, match.index).split('\n').length - 1;
    addEndpoint(method, match[1], lineNum);
  }
}
