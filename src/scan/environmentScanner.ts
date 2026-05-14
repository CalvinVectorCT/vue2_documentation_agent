import { EnvironmentRecord } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

const ENV_LINE_RE = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/;
const BASE_URL_RE = /baseURL\s*:\s*(["'`][^"'`]+["'`]|process\.env\.[A-Z0-9_]+)/i;
const PROCESS_ENV_RE = /process\.env\.([A-Z][A-Z0-9_]*)/g;

/**
 * Scan .env and config-like files for environment variables and base URL hints.
 */
export async function scanEnvironment(unresolved: string[]): Promise<EnvironmentRecord[]> {
  const records: EnvironmentRecord[] = [];
  const seen = new Set<string>();

  const envFiles = await readMatchingFiles('**/.env*', unresolved);
  for (const [filePath, content] of envFiles) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = ENV_LINE_RE.exec(line);
      if (!match) continue;

      const key = match[1];
      const value = sanitizeValue(match[2]);
      const dedupe = `${filePath}:${key}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      records.push({
        key,
        value,
        filePath,
        line: i + 1,
        source: 'env',
      });
    }
  }

  const configFiles = await readMatchingFiles(
    '{vue.config.{js,ts},src/plugins/**/*.{js,ts},src/services/**/*.{js,ts},src/api/**/*.{js,ts},src/utils/**/*.{js,ts}}',
    unresolved
  );

  for (const [filePath, content] of configFiles) {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const baseUrlMatch = BASE_URL_RE.exec(line);
      if (baseUrlMatch) {
        const key = 'BASE_URL_HINT';
        const value = sanitizeValue(baseUrlMatch[1]);
        const dedupe = `${filePath}:${key}:${value}`;
        if (!seen.has(dedupe)) {
          seen.add(dedupe);
          records.push({
            key,
            value,
            filePath,
            line: i + 1,
            source: 'config',
          });
        }
      }

      let envRef: RegExpExecArray | null;
      const envRe = new RegExp(PROCESS_ENV_RE.source, 'g');
      while ((envRef = envRe.exec(line)) !== null) {
        const key = envRef[1];
        const dedupe = `${filePath}:${key}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        records.push({
          key,
          value: undefined,
          filePath,
          line: i + 1,
          source: 'config',
        });
      }
    }
  }

  return records.sort((a, b) => a.key.localeCompare(b.key));
}

function sanitizeValue(raw: string): string {
  const trimmed = raw.trim().replace(/^['"`]|['"`]$/g, '');
  if (!trimmed || /^(\$\{.*\}|process\.env\.)/i.test(trimmed)) {
    return 'dynamic';
  }
  return trimmed;
}
