/**
 * Bug Condition Exploration Tests
 *
 * These tests encode the EXPECTED (correct) behavior for each of the 8 defect conditions.
 * They are expected to FAIL on unfixed code, confirming the bugs exist.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { scanPlugins } from './pluginsScanner';
import { scanVuex } from './vuexScanner';
import { scanRoutes } from './routesScanner';
import { scanEnvironment } from './environmentScanner';
import { scanComponents } from './componentsScanner';
import { scanApiEndpoints } from './apiScanner';
import { SYSTEM_PROMPT } from '../model/prompts/index';

// Access the mocked vscode module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vscode = require('vscode');

// Helper to set up mock file system for findFiles and readFile
function setupMockFileSystem(files: Record<string, string>) {
  const fileEntries = Object.entries(files);

  // Mock findFiles to return URIs matching the glob pattern
  vscode.workspace.findFiles.mockImplementation((pattern: string) => {
    const matched = fileEntries
      .filter(([path]) => matchesGlob(path, pattern))
      .map(([path]) => ({ fsPath: path, scheme: 'file', path }));
    return Promise.resolve(matched);
  });

  // Mock readFile to return content for known files
  vscode.workspace.fs.readFile.mockImplementation((uri: { fsPath: string }) => {
    const content = files[uri.fsPath];
    if (content !== undefined) {
      return Promise.resolve(Buffer.from(content, 'utf8'));
    }
    return Promise.reject(new Error(`File not found: ${uri.fsPath}`));
  });
}

/**
 * Simple glob matcher for test purposes.
 * Supports patterns like:
 *   - 'src/**\/*.{js,ts}' → matches src/anything.js or src/sub/anything.ts
 *   - '{src/plugins/**\/*.{js,ts},src/main.{js,ts}}' → matches either alternative
 *   - 'src/**\/*.vue' → matches .vue files under src/
 *   - '{.env,.env.*,src/**\/*.env,src/**\/*.env.*}' → matches .env patterns
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Handle brace alternatives at the top level: {pattern1,pattern2,...}
  if (pattern.startsWith('{') && pattern.endsWith('}')) {
    const inner = pattern.slice(1, -1);
    const alternatives = splitTopLevelCommas(inner);
    return alternatives.some((alt) => matchesSingleGlob(normalizedPath, alt.trim()));
  }

  return matchesSingleGlob(normalizedPath, pattern);
}

function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function matchesSingleGlob(filePath: string, pattern: string): boolean {
  // Handle {ext1,ext2} within the pattern first
  let regexStr = pattern.replace(/\{([^}]+)\}/g, (_, alts: string) => {
    return `(${alts.split(',').join('|')})`;
  });

  // Escape dots
  regexStr = regexStr.replace(/\./g, '\\.');

  // Replace **/ with a placeholder, then ** with a placeholder, then *
  // Use placeholders to avoid double-replacement
  const GLOBSTAR_SLASH = '<<GLOBSTARSLASH>>';
  const GLOBSTAR = '<<GLOBSTAR>>';
  regexStr = regexStr.replace(/\*\*\//g, GLOBSTAR_SLASH);
  regexStr = regexStr.replace(/\*\*/g, GLOBSTAR);
  regexStr = regexStr.replace(/\*/g, '[^/]*');
  regexStr = regexStr.replace(new RegExp(GLOBSTAR_SLASH.replace(/[<>]/g, '\\$&'), 'g'), '(.*/)?');
  regexStr = regexStr.replace(new RegExp(GLOBSTAR.replace(/[<>]/g, '\\$&'), 'g'), '.*');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(filePath);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Bug Condition Exploration - Defect 1: pluginsScanner misses Vue.use() outside src/plugins/', () => {
  /**
   * Validates: Requirement 1.1
   * Vue.use(VueI18n) in src/i18n/index.js should be detected by pluginsScanner.
   * Currently fails because glob only covers src/plugins/** and src/main.{js,ts}
   */
  it('should detect Vue.use(VueI18n) in src/i18n/index.js', async () => {
    setupMockFileSystem({
      'src/i18n/index.js': `
import Vue from 'vue';
import VueI18n from 'vue-i18n';

Vue.use(VueI18n);

export default new VueI18n({
  locale: 'en',
  messages: {}
});
`,
    });

    const unresolved: string[] = [];
    const plugins = await scanPlugins(unresolved);

    // Expected: should find VueI18n plugin
    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins.some((p) => p.name === 'VueI18n')).toBe(true);
  });
});

describe('Bug Condition Exploration - Defect 2: vuexScanner truncates nested objects', () => {
  /**
   * Validates: Requirement 1.2
   * actions: { fetch() { return { nested: true } }, update() {} }
   * Should find both keys. Currently finds only first due to non-greedy regex.
   */
  it('should find both action keys when actions contain nested objects', async () => {
    setupMockFileSystem({
      'src/store/modules/user.js': `
import api from '@/api';

export default {
  namespaced: true,
  state: {
    users: [],
    loading: false
  },
  mutations: {
    SET_USERS(state, users) {
      state.users = users;
    }
  },
  actions: {
    fetch(context) {
      return { nested: true };
    },
    update(context, payload) {
      return api.put('/users', payload);
    }
  }
};
`,
    });

    const unresolved: string[] = [];
    const modules = await scanVuex(unresolved);

    // Find the user module
    const userModule = modules.find((m) => m.name === 'user');
    expect(userModule).toBeDefined();

    // Expected: should find both 'fetch' and 'update' actions
    expect(userModule!.actions).toContain('fetch');
    expect(userModule!.actions).toContain('update');
    expect(userModule!.actions.length).toBe(2);
  });
});

describe('Bug Condition Exploration - Defect 3: routesScanner truncates at line 14', () => {
  /**
   * Validates: Requirement 1.3
   * Route definition spanning 20+ lines with meta/guards should extract all metadata.
   * Currently truncates at line 14.
   */
  it('should extract all metadata from a route spanning 20+ lines', async () => {
    // The route has path on line 9, and beforeEnter starts on line 20 (>14 lines away)
    // The 14-line window from path (line 9) would cover lines 6-23, but the guard
    // content extends beyond that. We place beforeEnter far enough from path to be missed.
    const routeContent = [
      "import Vue from 'vue';",
      "import Router from 'vue-router';",
      "",
      "Vue.use(Router);",
      "",
      "const routes = [",
      "  {",
      "    path: '/admin/dashboard',",
      "    name: 'AdminDashboard',",
      "    component: AdminDashboard,",
      "    meta: {",
      "      requiresAuth: true,",
      "      roles: ['admin', 'superadmin'],",
      "      title: 'Admin Dashboard',",
      "      breadcrumb: 'Dashboard',",
      "      layout: 'admin',",
      "      icon: 'dashboard',",
      "      order: 1,",
      "      group: 'admin',",
      "      permissions: ['read', 'write'],",
      "      cache: true,",
      "      transition: 'fade'",
      "    },",
      "    beforeEnter: (to, from, next) => {",
      "      if (store.getters.isAdmin) {",
      "        next();",
      "      } else {",
      "        next('/unauthorized');",
      "      }",
      "    }",
      "  }",
      "];",
      "",
      "export default new Router({ routes });",
    ].join('\n');

    setupMockFileSystem({
      'src/router/index.js': routeContent,
    });

    const unresolved: string[] = [];
    const routes = await scanRoutes(unresolved);

    // Find the admin dashboard route
    const adminRoute = routes.find((r) => r.path === '/admin/dashboard');
    expect(adminRoute).toBeDefined();

    // Expected: should detect meta.requiresAuth (within 14-line window from path)
    expect(adminRoute!.meta).toBeDefined();
    expect(adminRoute!.meta!['requiresAuth']).toBe(true);

    // Expected: should detect roles in meta (within 14-line window from path)
    expect(adminRoute!.meta!['roles']).toBeDefined();

    // Expected: should detect beforeEnter guard (line 24, which is 17 lines after path on line 7)
    // This is BEYOND the 14-line window, so it should fail on unfixed code
    expect(adminRoute!.guards).toBeDefined();
    expect(adminRoute!.guards).toContain('beforeEnter');
  });
});

describe('Bug Condition Exploration - Defect 4: environmentScanner misses root .env files', () => {
  /**
   * Validates: Requirement 1.4
   * .env.production at workspace root should be found.
   * Currently may miss root dotfiles depending on glob resolution.
   */
  it('should find .env.production at workspace root', async () => {
    setupMockFileSystem({
      '.env.production': `
VUE_APP_API_URL=https://api.production.example.com
VUE_APP_TITLE=My App Production
NODE_ENV=production
`,
    });

    const unresolved: string[] = [];
    const records = await scanEnvironment(unresolved);

    // Expected: should find environment variables from .env.production
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((r) => r.key === 'VUE_APP_API_URL')).toBe(true);
    expect(records.some((r) => r.key === 'VUE_APP_TITLE')).toBe(true);
  });
});

describe('Bug Condition Exploration - Defect 5: componentsScanner misses Vue.component() in JS files', () => {
  /**
   * Validates: Requirement 1.5
   * Vue.component('BaseBtn', BaseBtn) in src/main.js should be detected.
   * Currently misses JS files because only .vue files are scanned.
   */
  it('should detect Vue.component() global registration in src/main.js', async () => {
    setupMockFileSystem({
      'src/main.js': `
import Vue from 'vue';
import App from './App.vue';
import BaseBtn from './components/BaseBtn.vue';
import BaseCard from './components/BaseCard.vue';

Vue.component('BaseBtn', BaseBtn);
Vue.component('BaseCard', BaseCard);

new Vue({
  render: h => h(App)
}).$mount('#app');
`,
    });

    const unresolved: string[] = [];
    const result = await scanComponents(unresolved);

    // Expected: should detect globally registered components
    const allComponents = [...result.components, ...result.views];
    const hasBaseBtn = allComponents.some((c) => c.name === 'BaseBtn');
    const hasBaseCard = allComponents.some((c) => c.name === 'BaseCard');

    expect(hasBaseBtn).toBe(true);
    expect(hasBaseCard).toBe(true);
  });
});

describe('Bug Condition Exploration - Defect 6: vuexScanner skips store utility files', () => {
  /**
   * Validates: Requirement 1.6
   * src/store/utilities/actions.js with exported helpers should be recognized as Vuex-related.
   * Currently skips files without state: + mutations: pattern.
   */
  it('should recognize store utility files with exported action helpers', async () => {
    setupMockFileSystem({
      'src/store/utilities/actions.js': `
import api from '@/api';

export function fetchUsers(context) {
  return api.get('/users').then(res => {
    context.commit('SET_USERS', res.data);
  });
}

export function updateUser(context, payload) {
  return api.put('/users/' + payload.id, payload);
}

export function deleteUser(context, id) {
  return api.delete('/users/' + id);
}
`,
    });

    const unresolved: string[] = [];
    const modules = await scanVuex(unresolved);

    // Expected: should recognize this as a Vuex-related file and extract exported helpers
    expect(modules.length).toBeGreaterThan(0);

    // The module should contain the exported function names as actions
    const utilModule = modules[0];
    expect(utilModule.actions.length).toBeGreaterThan(0);
    // Should find at least some of the exported functions
    const allActions = utilModule.actions;
    expect(
      allActions.includes('fetchUsers') ||
      allActions.includes('updateUser') ||
      allActions.includes('deleteUser')
    ).toBe(true);
  });
});

describe('Bug Condition Exploration - Defect 7: scanners miss mixin files', () => {
  /**
   * Validates: Requirement 1.7
   * src/mixins/apiMixin.js with API calls should be detected by apiScanner.
   * Note: apiScanner already uses src/**\/*.{js,ts} which covers src/mixins/,
   * so this test may actually pass. If it does, it confirms the design doc's note
   * that apiScanner already covers mixins.
   */
  it('should detect API endpoints in src/mixins/apiMixin.js', async () => {
    setupMockFileSystem({
      'src/mixins/apiMixin.js': `
import axios from 'axios';

export default {
  methods: {
    async fetchData() {
      const response = await axios.get('/api/data');
      return response.data;
    },
    async submitForm(payload) {
      const response = await axios.post('/api/forms', payload);
      return response.data;
    }
  }
};
`,
    });

    const unresolved: string[] = [];
    const endpoints = await scanApiEndpoints(unresolved);

    // Expected: should detect API endpoints in mixin files
    expect(endpoints.length).toBeGreaterThan(0);
    expect(endpoints.some((e) => e.path === '/api/data' && e.method === 'GET')).toBe(true);
    expect(endpoints.some((e) => e.path === '/api/forms' && e.method === 'POST')).toBe(true);
  });
});

describe('Bug Condition Exploration - Defect 8: SYSTEM_PROMPT uses "Not detected" instead of TODO', () => {
  /**
   * Validates: Requirement 1.8
   * SYSTEM_PROMPT should contain TODO callout instruction instead of "Not detected" language.
   */
  it('should contain TODO callout instruction', () => {
    // Expected: SYSTEM_PROMPT should instruct to use TODO callout
    expect(SYSTEM_PROMPT).toContain('TODO');
    expect(SYSTEM_PROMPT).toContain('⚠️');
  });

  it('should NOT contain "Not detected in scanned project data" instruction', () => {
    // Expected: should not instruct to write "Not detected"
    expect(SYSTEM_PROMPT).not.toContain('Not detected in scanned project data');
  });
});
