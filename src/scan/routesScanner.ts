import { RouteRecord } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

// Matches: name: 'RouteName'
const NAME_RE = /name\s*:\s*['"`]([^'"`]+)['"`]/;
// Matches: component: SomeComponent
const COMPONENT_EAGER_RE = /component\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)/;
// Matches: component: () => import(...)
const COMPONENT_LAZY_RE = /component\s*:\s*\(\s*\)\s*=>/;
// Matches: redirect: '/path'
const REDIRECT_RE = /redirect\s*:\s*['"`]([^'"`]+)['"`]/;
// Matches: redirect: { name: 'SomeRoute' }
const REDIRECT_NAME_RE = /redirect\s*:\s*\{[\s\S]*?name\s*:\s*['"`]([^'"`]+)['"`][\s\S]*?\}/;
// Matches: beforeEnter, meta: { requiresAuth }
const GUARD_RE = /beforeEnter\s*:/g;
const META_REQUIRES_AUTH_RE = /requiresAuth\s*:\s*true/;
const META_ROLES_RE = /roles\s*:\s*\[([^\]]+)\]/;

/**
 * Parse route files (router/index.js, router.js) and extract a flat list of RouteRecords.
 * This is regex-based and optimised for typical Vue 2 / vue-router 3 patterns.
 */
export async function scanRoutes(unresolved: string[]): Promise<RouteRecord[]> {
  const [srcRouterDir, srcRouterFile, rootRouterDir, rootRouterFile] = await Promise.all([
    readMatchingFiles('src/router/**/*.{js,ts}', unresolved),
    readMatchingFiles('src/router.{js,ts}', unresolved),
    readMatchingFiles('router/index.{js,ts}', unresolved),
    readMatchingFiles('router.{js,ts}', unresolved),
  ]);

  const files = new Map<string, string>([
    ...srcRouterDir,
    ...srcRouterFile,
    ...rootRouterDir,
    ...rootRouterFile,
  ]);

  const routes: RouteRecord[] = [];

  for (const [filePath, content] of files) {
    extractRoutesFromContent(content, filePath, routes);
  }

  return routes;
}

/**
 * Look backward from the `path:` line to find the opening `{` of the route object.
 * Returns the line index of the opening brace, or falls back to `pathLineIndex - 3`.
 */
function findRouteObjectStart(lines: string[], pathLineIndex: number): number {
  let depth = 0;
  for (let j = pathLineIndex - 1; j >= 0; j--) {
    const line = lines[j];
    for (let k = line.length - 1; k >= 0; k--) {
      if (line[k] === '}') depth++;
      else if (line[k] === '{') {
        if (depth === 0) {
          return j;
        }
        depth--;
      }
    }
  }
  // Fallback: use a small lookback
  return Math.max(0, pathLineIndex - 3);
}

/**
 * From the route object opening brace line, scan forward counting `{` and `}`
 * until the route object is fully closed (depth returns to 0).
 * Returns the line index of the closing brace.
 */
function findRouteObjectEnd(lines: string[], openBraceLine: number): number {
  let depth = 0;
  for (let j = openBraceLine; j < lines.length; j++) {
    const line = lines[j];
    for (let k = 0; k < line.length; k++) {
      if (line[k] === '{') depth++;
      else if (line[k] === '}') {
        depth--;
        if (depth === 0) {
          return j;
        }
      }
    }
  }
  // Fallback: return last line
  return lines.length - 1;
}

function extractRoutesFromContent(content: string, filePath: string, out: RouteRecord[]): void {
  const lines = content.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const pathMatch = /path\s*:\s*['"`]([^'"`]+)['"`]/.exec(line);

    if (pathMatch) {
      // Look backward from `path:` line to find the opening `{` of the route object
      const objectStart = findRouteObjectStart(lines, i);
      // Scan forward from the opening brace to find the closing `}` using brace-depth tracking
      const objectEnd = findRouteObjectEnd(lines, objectStart);

      // Enforce a minimum window of 14 lines forward from path for backward compatibility
      const minEnd = Math.min(lines.length - 1, i + 14);
      const start = objectStart;
      const end = Math.max(minEnd, objectEnd);

      const block = lines.slice(start, end + 1).join('\n');

      const nameMatch = NAME_RE.exec(block);
      const componentEager = COMPONENT_EAGER_RE.exec(block);
      const redirectMatch = REDIRECT_RE.exec(block);
      const redirectNameMatch = REDIRECT_NAME_RE.exec(block);
      const isLazy = COMPONENT_LAZY_RE.test(block);
      const hasGuard = GUARD_RE.test(block);
      const requiresAuth = META_REQUIRES_AUTH_RE.test(block);
      const rolesMatch = META_ROLES_RE.exec(block);

      const guards: string[] = [];
      if (hasGuard) guards.push('beforeEnter');
      if (requiresAuth) guards.push('meta.requiresAuth');
      if (rolesMatch) guards.push(`meta.roles: [${rolesMatch[1].trim()}]`);

      const meta: Record<string, unknown> = {};
      if (requiresAuth) meta['requiresAuth'] = true;
      if (rolesMatch) meta['roles'] = rolesMatch[1].trim();

      out.push({
        path: pathMatch[1],
        name: nameMatch ? nameMatch[1] : undefined,
        component: componentEager ? componentEager[1] : undefined,
        componentFile: undefined,
        redirect: redirectMatch ? redirectMatch[1] : (redirectNameMatch ? redirectNameMatch[1] : undefined),
        meta: Object.keys(meta).length ? meta : undefined,
        guards: guards.length ? guards : undefined,
        children: undefined,
        lazy: isLazy,
        ...(filePath && { _filePath: filePath } as unknown as Record<string, unknown>),
      });
    }

    i++;
  }
}
