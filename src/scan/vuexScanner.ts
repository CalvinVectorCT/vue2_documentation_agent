import { VuexModuleRecord } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

const NAMESPACED_RE = /namespaced\s*:\s*true/;
const MODULE_NAME_FROM_PATH_RE = /(?:store[\\/]modules[\\/]|modules[\\/])([a-zA-Z0-9_-]+)\./;

/**
 * Extract Vuex module records from store files.
 * Supports both Vuex.Store({}) and modular namespace patterns.
 * Uses broad globs to handle non-standard folder layouts.
 */
export async function scanVuex(unresolved: string[]): Promise<VuexModuleRecord[]> {
  const [srcFiles, rootStoreFiles] = await Promise.all([
    readMatchingFiles('src/**/*.{js,ts}', unresolved),
    readMatchingFiles('store/**/*.{js,ts}', unresolved),
  ]);

  const files = new Map<string, string>([
    ...srcFiles,
    ...rootStoreFiles,
  ]);

  const modules: VuexModuleRecord[] = [];

  for (const [filePath, content] of files) {
    const module = extractModule(filePath, content);
    if (module) modules.push(module);
  }

  return modules;
}

/**
 * Check if a file is a store utility file that exports shared Vuex helpers.
 * Returns true if the file path contains `/store/` (or `\store\`) and the
 * content has `export` + function definitions.
 */
function isStoreUtilityFile(filePath: string, content: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath.includes('/store/')) return false;
  return /export\s+(function|const)\s+/.test(content);
}

/**
 * Extract exported function names from a store utility file.
 * Matches patterns like `export function fetchUsers(...)` and `export const fetchUsers = ...`
 */
function extractExportedFunctionNames(content: string): string[] {
  const names: string[] = [];
  const re = /export\s+(?:function|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

function extractModule(filePath: string, content: string): VuexModuleRecord | null {
  // Skip storybook story files
  if (/\.stories\./i.test(filePath.replace(/\\/g, '/'))) return null;

  // Check if this is a store utility file with exported helpers
  if (isStoreUtilityFile(filePath, content)) {
    const exportedNames = extractExportedFunctionNames(content);
    if (exportedNames.length > 0) {
      const name = deriveNameFromPath(filePath);
      return {
        name,
        namespaced: false,
        stateKeys: [],
        getters: [],
        mutations: [],
        actions: exportedNames,
        filePath,
      };
    }
  }

  // Only process files that look like Vuex modules or stores
  const looksLikeVuex =
    /\bVuex\b/.test(content) ||
    (/\bstate\s*[:(]/.test(content) && /\b(mutations|actions|getters)\s*:/.test(content));
  if (!looksLikeVuex) return null;

  // Skip index files that only import/register modules
  const isIndexFile = /index\.(js|ts)$/.test(filePath);
  const hasModules = /modules\s*:\s*\{/.test(content);
  if (isIndexFile && hasModules && !content.includes('state:') && !content.includes('mutations:')) {
    return null;
  }

  const nameMatch = MODULE_NAME_FROM_PATH_RE.exec(filePath);
  const name = nameMatch ? nameMatch[1] : deriveNameFromPath(filePath);
  const namespaced = NAMESPACED_RE.test(content);

  const stateKeys = extractStateKeys(content);
  const getters = extractObjectKeys(content, 'getters');
  const mutations = extractObjectKeys(content, 'mutations');
  const actions = extractObjectKeys(content, 'actions');

  return { name, namespaced, stateKeys, getters, mutations, actions, filePath };
}

function deriveNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const file = parts[parts.length - 1];
  return file.replace(/\.(js|ts)$/, '');
}

function extractStateKeys(content: string): string[] {
  // Find the state object/function body
  const stateMatch = /state\s*(?::|=)\s*(?:\(\s*\)\s*=>?\s*)?\{([^}]+)\}/s.exec(content);
  if (!stateMatch) return [];

  const stateBody = stateMatch[1];
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  const re = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
  while ((match = re.exec(stateBody)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

function extractIdentifiers(content: string, re: RegExp, group: number): string[] {
  const names: string[] = [];
  const cloned = new RegExp(re.source, re.flags);
  let match: RegExpExecArray | null;
  while ((match = cloned.exec(content)) !== null) {
    if (match[group]) names.push(match[group]);
  }
  return [...new Set(names)];
}

/**
 * Find the index of the matching closing brace for an opening brace at `startIndex`.
 * Uses brace-depth counting to correctly handle nested objects.
 * Returns -1 if no matching brace is found.
 */
function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 0;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function extractObjectKeys(content: string, objectName: 'actions' | 'getters' | 'mutations'): string[] {
  // Find the start of the object block: `objectName: {`
  const startRe = new RegExp(`${objectName}\\s*:\\s*\\{`);
  const startMatch = startRe.exec(content);
  if (!startMatch) return [];

  // Find the opening brace position
  const openBraceIndex = startMatch.index + startMatch[0].length - 1;

  // Use brace-depth counting to find the matching closing brace
  const closeBraceIndex = findMatchingBrace(content, openBraceIndex);
  if (closeBraceIndex === -1) return [];

  // Extract the body between the braces (excluding the braces themselves)
  const body = content.slice(openBraceIndex + 1, closeBraceIndex);

  const methodStyle = extractIdentifiers(body, /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 1);
  const keyValueStyle = extractIdentifiers(body, /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*/gm, 1);

  return [...new Set([...methodStyle, ...keyValueStyle])];
}
