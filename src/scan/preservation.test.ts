/**
 * Preservation Property Tests
 *
 * These tests capture the EXISTING correct behavior of the scanners for standard
 * project layouts. They MUST PASS on the current unfixed code. They serve as
 * regression tests to ensure the fix doesn't break anything.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */
import * as fc from 'fast-check';

// We need to mock readFiles before importing scanners
jest.mock('./readFiles');

import { scanComponents } from './componentsScanner';
import { scanRoutes } from './routesScanner';
import { scanVuex } from './vuexScanner';
import { scanApiEndpoints } from './apiScanner';
import { scanPlugins } from './pluginsScanner';
import { readMatchingFiles } from './readFiles';

const mockedReadMatchingFiles = readMatchingFiles as jest.MockedFunction<typeof readMatchingFiles>;

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid PascalCase component name */
const componentNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 3, maxLength: 10 }
).map(s => s.charAt(0).toUpperCase() + s.slice(1));

/** Generate a valid camelCase identifier (no special chars) */
const identifierArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 3, maxLength: 8 }
);

/** Generate a valid emit event name (simple lowercase) */
const emitNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 3, maxLength: 10 }
);

/** Generate a valid route path */
const routePathArb = fc.array(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 6 }),
  { minLength: 1, maxLength: 3 }
).map(parts => '/' + parts.join('/'));

/** Generate a valid plugin name (PascalCase) */
const pluginNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 3, maxLength: 8 }
).map(s => s.charAt(0).toUpperCase() + s.slice(1));

/** Generate a valid API path */
const apiPathArb = fc.array(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 6 }),
  { minLength: 1, maxLength: 3 }
).map(parts => '/api/' + parts.join('/'));

/** Generate an HTTP method name for axios calls */
const httpMethodArb = fc.constantFrom('get', 'post', 'put', 'patch', 'delete');


// ─── Helper: Build standard .vue file with SINGLE prop (avoids nested brace issue) ──

function buildVueFileSimple(opts: {
  name: string;
  propName?: string;
  propType?: string;
  emits: string[];
  imports: string[];
}): string {
  // Use array-style props to avoid the nested brace regex limitation
  const propsBlock = opts.propName
    ? `props: ['${opts.propName}'],`
    : '';

  const emitsInTemplate = opts.emits.map(e => `    <div @click="$emit('${e}')"></div>`).join('\n');

  const importsBlock = opts.imports.map(i => `import ${i} from './${i}.vue';`).join('\n');
  const componentsBlock = opts.imports.length > 0
    ? `components: { ${opts.imports.join(', ')} },`
    : '';

  return `<template>
  <div>
${emitsInTemplate}
  </div>
</template>

<script>
${importsBlock}

export default {
  name: '${opts.name}',
  ${componentsBlock}
  ${propsBlock}
}
</script>
`;
}

// ─── Helper: Build a single-route file (avoids multi-route window overlap) ───

function buildSingleRouteFile(route: {
  path: string;
  name: string;
  component: string;
  requiresAuth: boolean;
}): string {
  const metaBlock = route.requiresAuth
    ? `\n      meta: { requiresAuth: true },`
    : '';
  return `import Vue from 'vue'
import Router from 'vue-router'

export default new Router({
  routes: [
    {
      path: '${route.path}',
      name: '${route.name}',
      component: ${route.component},${metaBlock}
    }
  ]
})
`;
}

// ─── Helper: Build flat Vuex module with SINGLE action (avoids first-brace truncation) ──

function buildSingleActionVuexModule(opts: {
  name: string;
  namespaced: boolean;
  stateKey: string;
  getter: string;
  mutation: string;
  action: string;
}): string {
  return `export default {
  namespaced: ${opts.namespaced},
  state: {
    ${opts.stateKey}: null
  },
  getters: {
    ${opts.getter}(state) { return state.${opts.stateKey}; }
  },
  mutations: {
    ${opts.mutation}(state) { }
  },
  actions: {
    ${opts.action}(ctx) { }
  }
}
`;
}

// ─── Helper: Build standard plugin file content ──────────────────────────────

function buildPluginFile(plugins: string[]): string {
  const imports = plugins.map(p => `import ${p} from '${p.toLowerCase()}'`).join('\n');
  const uses = plugins.map(p => `Vue.use(${p})`).join('\n');
  return `import Vue from 'vue'\n${imports}\n\n${uses}\n`;
}

// ─── Helper: Build single-endpoint API file (avoids function context overlap) ──

function buildSingleEndpointApiFile(endpoint: { method: string; path: string; fnName: string }): string {
  return `import axios from 'axios'

export async function ${endpoint.fnName}() {
  return axios.${endpoint.method}('${endpoint.path}')
}
`;
}


// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Preservation Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: For all standard .vue component files, componentsScanner extracts
   * identical props/emits/imports.
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 2.1: componentsScanner preserves standard .vue extraction', () => {
    it('extracts name, array-style props, emits, and imported components from standard .vue files', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: componentNameArb,
            propName: fc.option(identifierArb, { nil: undefined }),
            emits: fc.array(emitNameArb, { minLength: 0, maxLength: 2 }),
            imports: fc.array(componentNameArb, { minLength: 0, maxLength: 2 }),
          }),
          async (input) => {
            const uniqueEmits = [...new Set(input.emits)];
            const uniqueImports = [...new Set(input.imports)].filter(i => i !== input.name);

            const vueContent = buildVueFileSimple({
              name: input.name,
              propName: input.propName,
              emits: uniqueEmits,
              imports: uniqueImports,
            });

            const filePath = `src/components/${input.name}.vue`;
            const fileMap = new Map<string, string>([[filePath, vueContent]]);

            mockedReadMatchingFiles.mockResolvedValue(fileMap);

            const unresolved: string[] = [];
            const result = await scanComponents(unresolved);

            const allComponents = [...result.components, ...result.views];
            expect(allComponents.length).toBe(1);

            const comp = allComponents[0];
            expect(comp.name).toBe(input.name);

            // Array-style props: should extract the prop name
            if (input.propName) {
              expect(comp.props.length).toBe(1);
              expect(comp.props[0].name).toBe(input.propName);
            } else {
              expect(comp.props.length).toBe(0);
            }

            // Each emit should be extracted
            for (const expectedEmit of uniqueEmits) {
              expect(comp.emits).toContain(expectedEmit);
            }

            // Each imported component should be extracted
            for (const expectedImport of uniqueImports) {
              expect(comp.importedComponents).toContain(expectedImport);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('correctly classifies views vs components based on path', async () => {
      const componentContent = `<template><div></div></template>
<script>
export default { name: 'MyButton' }
</script>`;
      const viewContent = `<template><div></div></template>
<script>
export default { name: 'HomePage' }
</script>`;

      const fileMap = new Map<string, string>([
        ['src/components/MyButton.vue', componentContent],
        ['src/views/HomePage.vue', viewContent],
      ]);
      mockedReadMatchingFiles.mockResolvedValue(fileMap);

      const unresolved: string[] = [];
      const result = await scanComponents(unresolved);

      expect(result.components.length).toBe(1);
      expect(result.components[0].name).toBe('MyButton');
      expect(result.views.length).toBe(1);
      expect(result.views[0].name).toBe('HomePage');
    });
  });

  /**
   * Property: For all route definitions under 14 lines, routesScanner extracts
   * identical metadata (path, name, component, meta, guards).
   *
   * **Validates: Requirements 3.2**
   */
  describe('Property 2.2: routesScanner preserves short route extraction', () => {
    it('extracts path, name, component, and meta for single routes under 14 lines', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: routePathArb,
            name: identifierArb,
            component: componentNameArb,
            requiresAuth: fc.boolean(),
          }),
          async (route) => {
            const content = buildSingleRouteFile(route);
            const filePath = 'src/router/index.js';
            const fileMap = new Map<string, string>([[filePath, content]]);

            mockedReadMatchingFiles.mockResolvedValue(fileMap);

            const unresolved: string[] = [];
            const result = await scanRoutes(unresolved);

            // Should find our route
            const found = result.find(r => r.path === route.path);
            expect(found).toBeDefined();
            expect(found!.name).toBe(route.name);
            expect(found!.component).toBe(route.component);
            expect(found!.lazy).toBe(false);

            if (route.requiresAuth) {
              expect(found!.meta).toBeDefined();
              expect(found!.meta!['requiresAuth']).toBe(true);
              expect(found!.guards).toContain('meta.requiresAuth');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('extracts lazy-loaded routes correctly', async () => {
      const content = `import Vue from 'vue'
import Router from 'vue-router'

export default new Router({
  routes: [
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('./views/Dashboard.vue'),
    }
  ]
})`;
      const fileMap = new Map<string, string>([['src/router/index.js', content]]);
      mockedReadMatchingFiles.mockResolvedValue(fileMap);

      const unresolved: string[] = [];
      const result = await scanRoutes(unresolved);

      const found = result.find(r => r.path === '/dashboard');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Dashboard');
      expect(found!.lazy).toBe(true);
    });
  });


  /**
   * Property: For all flat Vuex modules (no nested objects), extractObjectKeys
   * returns identical key sets.
   *
   * **Validates: Requirements 3.3**
   */
  describe('Property 2.3: vuexScanner preserves flat module extraction', () => {
    it('extracts single action/mutation/getter from flat modules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: identifierArb,
            namespaced: fc.boolean(),
            stateKey: identifierArb,
            getter: identifierArb,
            mutation: identifierArb,
            action: identifierArb,
          }),
          async (input) => {
            const content = buildSingleActionVuexModule(input);
            const filePath = `src/store/modules/${input.name}.js`;
            const fileMap = new Map<string, string>([[filePath, content]]);

            mockedReadMatchingFiles.mockResolvedValue(fileMap);

            const unresolved: string[] = [];
            const result = await scanVuex(unresolved);

            expect(result.length).toBe(1);
            const mod = result[0];

            expect(mod.name).toBe(input.name);
            expect(mod.namespaced).toBe(input.namespaced);
            expect(mod.stateKeys).toContain(input.stateKey);
            expect(mod.getters).toContain(input.getter);
            expect(mod.mutations).toContain(input.mutation);
            expect(mod.actions).toContain(input.action);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('correctly identifies namespaced modules', async () => {
      const content = `export default {
  namespaced: true,
  state: {
    items: []
  },
  getters: {
    allItems(state) { return state.items; }
  },
  mutations: {
    setItems(state, items) { state.items = items; }
  },
  actions: {
    fetchItems(ctx) { }
  }
}`;
      const fileMap = new Map<string, string>([['src/store/modules/items.js', content]]);
      mockedReadMatchingFiles.mockResolvedValue(fileMap);

      const unresolved: string[] = [];
      const result = await scanVuex(unresolved);

      expect(result.length).toBe(1);
      expect(result[0].namespaced).toBe(true);
      expect(result[0].name).toBe('items');
      expect(result[0].stateKeys).toContain('items');
      expect(result[0].getters).toContain('allItems');
      expect(result[0].mutations).toContain('setItems');
      expect(result[0].actions).toContain('fetchItems');
    });
  });

  /**
   * Property: For all standard plugin locations (src/plugins/, src/main.{js,ts}),
   * pluginsScanner returns identical results.
   *
   * **Validates: Requirements 3.4**
   */
  describe('Property 2.4: pluginsScanner preserves standard location detection', () => {
    it('detects Vue.use() calls in src/plugins/ and src/main.{js,ts}', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            plugins: fc.array(pluginNameArb, { minLength: 1, maxLength: 4 }),
            location: fc.constantFrom('src/plugins/index.js', 'src/main.js', 'src/main.ts'),
          }),
          async (input) => {
            const uniquePlugins = [...new Set(input.plugins)];
            const content = buildPluginFile(uniquePlugins);
            const fileMap = new Map<string, string>([[input.location, content]]);

            mockedReadMatchingFiles.mockResolvedValue(fileMap);

            const unresolved: string[] = [];
            const result = await scanPlugins(unresolved);

            // Should detect all plugins
            for (const expectedPlugin of uniquePlugins) {
              const found = result.find(p => p.name === expectedPlugin);
              expect(found).toBeDefined();
              expect(found!.filePath).toBe(input.location);
            }

            expect(result.length).toBe(uniquePlugins.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: For all axios/fetch calls in standard locations, apiScanner returns
   * identical endpoint records.
   *
   * **Validates: Requirements 3.4, 3.5**
   */
  describe('Property 2.5: apiScanner preserves standard API call detection', () => {
    it('detects single axios endpoint in src/**/*.{js,ts} files', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            method: httpMethodArb,
            path: apiPathArb,
            fnName: identifierArb.map(s => 'fetch' + s.charAt(0).toUpperCase() + s.slice(1)),
            fileLocation: fc.constantFrom(
              'src/services/api.js',
              'src/api/endpoints.ts',
              'src/utils/http.js'
            ),
          }),
          async (input) => {
            const content = buildSingleEndpointApiFile({
              method: input.method,
              path: input.path,
              fnName: input.fnName,
            });
            const fileMap = new Map<string, string>([[input.fileLocation, content]]);
            const emptyMap = new Map<string, string>();

            mockedReadMatchingFiles
              .mockResolvedValueOnce(fileMap)
              .mockResolvedValueOnce(emptyMap);

            const unresolved: string[] = [];
            const result = await scanApiEndpoints(unresolved);

            expect(result.length).toBe(1);
            expect(result[0].method).toBe(input.method.toUpperCase());
            expect(result[0].path).toBe(input.path);
            expect(result[0].filePath).toBe(input.fileLocation);
            expect(result[0].functionName).toBe(input.fnName);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('detects axios calls in src/**/*.vue files', async () => {
      const vueContent = `<template><div></div></template>
<script>
import axios from 'axios'

export default {
  methods: {
    async fetchUsers() {
      return axios.get('/api/users')
    }
  }
}
</script>`;

      const emptyMap = new Map<string, string>();
      const vueMap = new Map<string, string>([['src/components/UserList.vue', vueContent]]);

      mockedReadMatchingFiles
        .mockResolvedValueOnce(emptyMap)
        .mockResolvedValueOnce(vueMap);

      const unresolved: string[] = [];
      const result = await scanApiEndpoints(unresolved);

      expect(result.length).toBe(1);
      expect(result[0].method).toBe('GET');
      expect(result[0].path).toBe('/api/users');
      expect(result[0].filePath).toBe('src/components/UserList.vue');
    });

    it('detects fetch() calls correctly', async () => {
      const content = `export async function loadData() {
  const response = await fetch('/api/data', { method: 'POST' })
  return response.json()
}`;
      const fileMap = new Map<string, string>([['src/services/data.js', content]]);
      const emptyMap = new Map<string, string>();

      mockedReadMatchingFiles
        .mockResolvedValueOnce(fileMap)
        .mockResolvedValueOnce(emptyMap);

      const unresolved: string[] = [];
      const result = await scanApiEndpoints(unresolved);

      expect(result.length).toBe(1);
      expect(result[0].method).toBe('POST');
      expect(result[0].path).toBe('/api/data');
    });

    it('skips storybook story files', async () => {
      const storyContent = `import axios from 'axios'
export async function fetchData() {
  return axios.get('/api/data')
}`;

      const fileMap = new Map<string, string>([['src/components/Button.stories.js', storyContent]]);
      const emptyMap = new Map<string, string>();

      mockedReadMatchingFiles
        .mockResolvedValueOnce(fileMap)
        .mockResolvedValueOnce(emptyMap);

      const unresolved: string[] = [];
      const result = await scanApiEndpoints(unresolved);

      expect(result.length).toBe(0);
    });
  });

  /**
   * Property: readFiles utility silently adds unreadable files to unresolved array.
   *
   * **Validates: Requirements 3.6**
   */
  describe('Property 2.6: readFiles handles unresolved files gracefully', () => {
    it('unresolved array is not modified by scanners when all files are readable', async () => {
      const content = buildSingleActionVuexModule({
        name: 'test',
        namespaced: true,
        stateKey: 'count',
        getter: 'getCount',
        mutation: 'setCount',
        action: 'fetchCount',
      });

      const fileMap = new Map<string, string>([['src/store/modules/test.js', content]]);
      mockedReadMatchingFiles.mockResolvedValue(fileMap);

      const unresolved: string[] = [];
      await scanVuex(unresolved);

      expect(unresolved.length).toBe(0);
    });
  });

  /**
   * Property: All scanners skip storybook .stories.* files.
   *
   * **Validates: Requirements 3.7**
   */
  describe('Property 2.7: scanners skip storybook story files', () => {
    it('componentsScanner skips .stories.vue files', async () => {
      const storyContent = `<template><div></div></template>
<script>
export default {
  name: 'ButtonStory',
  props: ['label']
}
</script>`;

      const fileMap = new Map<string, string>([
        ['src/components/Button.stories.vue', storyContent],
      ]);
      mockedReadMatchingFiles.mockResolvedValue(fileMap);

      const unresolved: string[] = [];
      const result = await scanComponents(unresolved);

      expect(result.components.length).toBe(0);
      expect(result.views.length).toBe(0);
    });

    it('vuexScanner skips .stories.js files', async () => {
      const storyContent = `
export default {
  state: { count: 0 },
  mutations: {
    increment(state) { state.count++ }
  },
  actions: {
    fetchData(ctx) { }
  }
}`;

      const fileMap = new Map<string, string>([
        ['src/store/modules/counter.stories.js', storyContent],
      ]);
      mockedReadMatchingFiles.mockResolvedValue(fileMap);

      const unresolved: string[] = [];
      const result = await scanVuex(unresolved);

      expect(result.length).toBe(0);
    });
  });
});
