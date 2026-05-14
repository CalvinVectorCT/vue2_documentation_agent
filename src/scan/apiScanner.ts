import { ApiEndpointRecord, HttpMethod } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

// Axios and custom wrapper patterns
const AXIOS_CALL_RE = /(?:axios|api|http|client|service|request)\.(get|post|put|patch|delete|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const TEMPLATE_LITERAL_RE = /(?:axios|api|http|client|service|request)\.(get|post|put|patch|delete|head)\s*\(\s*`([^`]+)`/gi;
const FETCH_RE = /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{[^}]*method\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`])?/gi;
const FUNCTION_CONTEXT_RE = /(?:async\s+)?(?:function\s+|(?:const|let|var)\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\bfunction\b))?/;
const BASE_URL_RE = /baseURL\s*:\s*(["'`][^"'`]+["'`]|process\.env\.[A-Z0-9_]+)/i;

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

  const globalBaseUrl = BASE_URL_RE.exec(content)?.[1]?.replace(/["'`]/g, '');

  const addEndpoint = (method: HttpMethod, path: string, line: number) => {
    const key = `${method}:${path}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Try to find the enclosing function name
    const contextWindow = lines.slice(Math.max(0, line - 5), line).join('\n');
    const fnMatch = FUNCTION_CONTEXT_RE.exec(contextWindow);
    const callLine = lines[line] ?? '';
    const nearby = lines.slice(Math.max(0, line - 3), Math.min(lines.length, line + 4)).join('\n');

    const requestHint = inferRequestHint(callLine, nearby, method);
    const responseHint = inferResponseHint(nearby);
    const authHint = inferAuthHint(nearby);

    out.push({
      method,
      path,
      functionName: fnMatch ? fnMatch[1] : undefined,
      filePath,
      line: line + 1,
      group: inferGroup(path),
      requestHint,
      responseHint,
      authHint,
      baseUrlHint: globalBaseUrl,
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

function inferRequestHint(callLine: string, nearby: string, method: HttpMethod): string | undefined {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    if (/params\s*:/.test(nearby)) return 'query params via params option';
    return 'no request body detected';
  }

  if (/\{[^}]*\}/.test(callLine)) return 'inline object body detected';
  if (/payload|body|data|formData|params/i.test(callLine) || /data\s*:/.test(nearby)) {
    return 'request payload variable/object passed';
  }
  return undefined;
}

function inferResponseHint(nearby: string): string | undefined {
  if (/response\.data|res\.data|\.data\b/.test(nearby)) return 'uses response.data';
  if (/await\s+[^\n]*\.(json)\(\)/.test(nearby)) return 'uses response.json()';
  if (/status\b/.test(nearby)) return 'checks response status';
  return undefined;
}

function inferAuthHint(nearby: string): 'Yes' | 'No' | 'Unknown' {
  if (/Authorization|Bearer|token|auth/i.test(nearby)) return 'Yes';
  if (/public|noAuth|anonymous/i.test(nearby)) return 'No';
  return 'Unknown';
}
