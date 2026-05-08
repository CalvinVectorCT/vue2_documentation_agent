import { AuthRecord } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

/**
 * Patterns that indicate authentication-related code.
 */
const PATTERNS: Array<{
  kind: AuthRecord['kind'];
  re: RegExp;
  description: string;
}> = [
  { kind: 'login', re: /(?:login|signIn|authenticate)\s*\(/, description: 'Login function call' },
  { kind: 'logout', re: /(?:logout|signOut)\s*\(/, description: 'Logout function call' },
  {
    kind: 'token-storage',
    re: /(?:localStorage|sessionStorage|Cookies)\.(?:set|getItem|setItem)\s*\(\s*['"`](?:token|access_token|auth_token|jwt)[^'"`,]*/,
    description: 'Token stored in browser storage',
  },
  {
    kind: 'interceptor',
    re: /axios\.interceptors\.(request|response)\.use/,
    description: 'Axios interceptor (likely attaches auth headers or handles 401)',
  },
  {
    kind: 'guard',
    re: /router\.beforeEach|router\.beforeResolve|beforeEnter\s*:/,
    description: 'Navigation guard',
  },
  {
    kind: 'guard',
    re: /meta\.requiresAuth|meta\.roles|meta\.permissions/,
    description: 'Route meta auth check',
  },
  {
    kind: 'role-check',
    re: /hasRole|hasPermission|can\s*\(|isAdmin|checkRole/,
    description: 'Role or permission check',
  },
  {
    kind: 'service',
    re: /class\s+Auth(?:Service|Manager|Provider|Helper)/,
    description: 'Auth service class',
  },
  {
    kind: 'service',
    re: /refreshToken|refresh_token|tokenRefresh/,
    description: 'Token refresh logic',
  },
];

/**
 * Scan router, plugin, service, and store files for authentication-related patterns.
 */
export async function scanAuth(unresolved: string[]): Promise<AuthRecord[]> {
  const files = await readMatchingFiles(
    '{src/router/**/*.{js,ts},src/plugins/**/*.{js,ts},src/services/**/*.{js,ts},src/auth/**/*.{js,ts},src/store/**/*.{js,ts},src/utils/**/*.{js,ts}}',
    unresolved
  );

  const records: AuthRecord[] = [];

  for (const [filePath, content] of files) {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { kind, re, description } of PATTERNS) {
        if (re.test(line)) {
          records.push({ kind, description, filePath, line: i + 1 });
          break; // Only record one pattern per line to avoid noise
        }
      }
    }
  }

  // Deduplicate: same kind + file (keep first occurrence)
  const seen = new Set<string>();
  return records.filter((r) => {
    const key = `${r.kind}:${r.filePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
