import { PluginRecord } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

const VUE_USE_RE = /Vue\.use\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
const PLUGIN_CLASS_RE = /class\s+([A-Za-z_$][A-Za-z0-9_$]*Plugin)/g;

export async function scanPlugins(unresolved: string[]): Promise<PluginRecord[]> {
  const files = await readMatchingFiles(
    'src/**/*.{js,ts}',
    unresolved
  );

  const plugins: PluginRecord[] = [];
  const seen = new Set<string>();

  for (const [filePath, content] of files) {
    let match: RegExpExecArray | null;

    const useRe = new RegExp(VUE_USE_RE.source, 'g');
    while ((match = useRe.exec(content)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        plugins.push({ name: match[1], filePath });
      }
    }

    const classRe = new RegExp(PLUGIN_CLASS_RE.source, 'g');
    while ((match = classRe.exec(content)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        plugins.push({ name: match[1], filePath });
      }
    }
  }

  return plugins;
}
