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

function extractModule(filePath: string, content: string): VuexModuleRecord | null {
  // Skip storybook story files
  if (/\.stories\./i.test(filePath.replace(/\\/g, '/'))) return null;

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

function extractObjectKeys(content: string, objectName: 'actions' | 'getters' | 'mutations'): string[] {
  const blockRe = new RegExp(`${objectName}\\s*:\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const blockMatch = blockRe.exec(content);
  if (!blockMatch) return [];

  const body = blockMatch[1];
  const methodStyle = extractIdentifiers(body, /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 1);
  const keyValueStyle = extractIdentifiers(body, /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*/gm, 1);

  return [...new Set([...methodStyle, ...keyValueStyle])];
}
