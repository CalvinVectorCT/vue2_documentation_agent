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

function extractRoutesFromContent(content: string, filePath: string, out: RouteRecord[]): void {
  const lines = content.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const pathMatch = /path\s*:\s*['"`]([^'"`]+)['"`]/.exec(line);

    if (pathMatch) {
      // Collect a small window of lines around this path declaration (plus room for comments)
      const start = Math.max(0, i - 3);
      const end = Math.min(lines.length - 1, i + 14);
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
