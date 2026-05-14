import { ComponentRecord, PropRecord } from '../types/projectIndex';
import { readMatchingFiles } from './readFiles';

const COMPONENT_NAME_RE = /name\s*:\s*['"`]([^'"`]+)['"`]/;
const PROPS_OBJECT_RE = /props\s*:\s*\{([^}]+)\}/s;
const PROPS_ARRAY_RE = /props\s*:\s*\[([^\]]+)\]/;
const EMIT_RE = /\$emit\s*\(\s*['"`]([^'"`]+)['"`]/g;
const IMPORT_COMPONENT_RE = /import\s+([A-Z][a-zA-Z0-9]*)\s+from\s+['"`][^'"`]+['"`]/g;
const COMPONENTS_BLOCK_RE = /components\s*:\s*\{([^}]+)\}/s;
const VUE_COMPONENT_RE = /Vue\.component\s*\(\s*['"`]([^'"`]+)['"`]/g;

/**
 * Scan .vue files and extract component metadata.
 * Uses a broad glob to handle non-standard folder structures where components
 * may live outside the canonical src/components/ and src/views/ directories.
 */
export async function scanComponents(unresolved: string[]): Promise<{
  components: ComponentRecord[];
  views: ComponentRecord[];
}> {
  const allFiles = await readMatchingFiles('src/**/*.vue', unresolved);

  // Classify by path: anything under a "views" folder or a top-level page component is a view
  const componentFiles = new Map<string, string>();
  const viewFiles = new Map<string, string>();

  for (const [filePath, content] of allFiles) {
    const normalised = filePath.replace(/\\/g, '/');
    // Skip storybook story files
    if (/\.stories\./i.test(normalised)) continue;

    if (/\/views?\//i.test(normalised)) {
      viewFiles.set(filePath, content);
    } else {
      componentFiles.set(filePath, content);
    }
  }

  const components = parseComponentFiles(componentFiles, false);
  const views = parseComponentFiles(viewFiles, true);

  // Second pass: scan JS/TS files for global Vue.component() registrations
  const jsFiles = await readMatchingFiles('src/**/*.{js,ts}', unresolved);
  for (const [filePath, content] of jsFiles) {
    const normalised = filePath.replace(/\\/g, '/');
    // Skip storybook story files
    if (/\.stories\./i.test(normalised)) continue;

    const re = new RegExp(VUE_COMPONENT_RE.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const name = match[1];
      // Avoid duplicates with already-detected components
      const alreadyExists = components.some((c) => c.name === name) || views.some((v) => v.name === name);
      if (!alreadyExists) {
        components.push({
          name,
          filePath,
          props: [],
          emits: [],
          importedComponents: [],
          isView: false,
        });
      }
    }
  }

  // Re-sort after adding global registrations
  components.sort((a, b) => a.name.localeCompare(b.name));

  return { components, views };
}

function parseComponentFiles(
  files: Map<string, string>,
  isView: boolean
): ComponentRecord[] {
  const records: ComponentRecord[] = [];

  for (const [filePath, content] of files) {
    const scriptMatch = /<script[^>]*>([\s\S]*?)<\/script>/i.exec(content);
    const templateMatch = /<template[^>]*>([\s\S]*?)<\/template>/i.exec(content);

    const script = scriptMatch ? scriptMatch[1] : '';
    const template = templateMatch ? templateMatch[1] : '';

    const nameMatch = COMPONENT_NAME_RE.exec(script);
    const name = nameMatch ? nameMatch[1] : deriveNameFromPath(filePath);

    records.push({
      name,
      filePath,
      props: extractProps(script),
      emits: extractEmits(template + script),
      importedComponents: extractImportedComponents(script),
      isView,
    });
  }

  return records.sort((a, b) => a.name.localeCompare(b.name));
}

function deriveNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1].replace('.vue', '');
}

function extractProps(script: string): PropRecord[] {
  const props: PropRecord[] = [];

  // Object-style props: { propName: { type: ..., required: ..., default: ... } }
  const objMatch = PROPS_OBJECT_RE.exec(script);
  if (objMatch) {
    const body = objMatch[1];
    const propRe = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(body)) !== null) {
      const propBody = m[2];
      const typeMatch = /type\s*:\s*([A-Za-z]+)/.exec(propBody);
      const required = /required\s*:\s*true/.test(propBody);
      const hasDefault = /default\s*:/.test(propBody);
      props.push({ name: m[1], type: typeMatch ? typeMatch[1] : undefined, required, hasDefault });
    }
    return props;
  }

  // Array-style props: ['propName', ...]
  const arrMatch = PROPS_ARRAY_RE.exec(script);
  if (arrMatch) {
    const items = arrMatch[1].split(',').map((s) => s.trim().replace(/['"`]/g, ''));
    for (const name of items) {
      if (name) props.push({ name, type: undefined, required: false, hasDefault: false });
    }
  }

  return props;
}

function extractEmits(content: string): string[] {
  const emits = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(EMIT_RE.source, 'g');
  while ((match = re.exec(content)) !== null) {
    emits.add(match[1]);
  }
  return [...emits];
}

function extractImportedComponents(script: string): string[] {
  const imported: string[] = [];
  let match: RegExpExecArray | null;

  // Grab all import statements that look like components (PascalCase)
  const importRe = new RegExp(IMPORT_COMPONENT_RE.source, 'g');
  while ((match = importRe.exec(script)) !== null) {
    imported.push(match[1]);
  }

  // Also look at the components: {} block for locally registered names
  const blockMatch = COMPONENTS_BLOCK_RE.exec(script);
  if (blockMatch) {
    const nameRe = /([A-Z][a-zA-Z0-9]*)/g;
    while ((match = nameRe.exec(blockMatch[1])) !== null) {
      if (!imported.includes(match[1])) imported.push(match[1]);
    }
  }

  return [...new Set(imported)];
}
