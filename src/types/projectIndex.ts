// ─── Route types ────────────────────────────────────────────────────────────

export interface RouteRecord {
  path: string;
  name?: string;
  component?: string;
  componentFile?: string;
  redirect?: string;
  meta?: Record<string, unknown>;
  guards?: string[];
  children?: RouteRecord[];
  lazy: boolean;
}

// ─── Vuex types ──────────────────────────────────────────────────────────────

export interface VuexModuleRecord {
  name: string;
  namespaced: boolean;
  stateKeys: string[];
  getters: string[];
  mutations: string[];
  actions: string[];
  filePath: string;
}

// ─── API / endpoint types ────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'UNKNOWN';

export interface ApiEndpointRecord {
  method: HttpMethod;
  path: string;
  functionName?: string;
  filePath: string;
  line: number;
  group?: string;
  requestHint?: string;
  responseHint?: string;
  authHint?: 'Yes' | 'No' | 'Unknown';
  baseUrlHint?: string;
}

// ─── Component types ─────────────────────────────────────────────────────────

export interface ComponentRecord {
  name: string;
  filePath: string;
  props: PropRecord[];
  emits: string[];
  importedComponents: string[];
  isView: boolean;
}

export interface PropRecord {
  name: string;
  type?: string;
  required: boolean;
  hasDefault: boolean;
}

// ─── Auth types ───────────────────────────────────────────────────────────────

export interface AuthRecord {
  kind: 'guard' | 'interceptor' | 'service' | 'token-storage' | 'role-check' | 'login' | 'logout';
  description: string;
  filePath: string;
  line: number;
}

// ─── Plugin types ─────────────────────────────────────────────────────────────

export interface PluginRecord {
  name: string;
  filePath: string;
}

// ─── Environment / config types ──────────────────────────────────────────────

export interface EnvironmentRecord {
  key: string;
  value?: string;
  filePath: string;
  line: number;
  source: 'env' | 'config';
}

// ─── Project Index ────────────────────────────────────────────────────────────

export interface ProjectIndex {
  workspaceRoot: string;
  scannedAt: string;
  routes: RouteRecord[];
  vuexModules: VuexModuleRecord[];
  apiEndpoints: ApiEndpointRecord[];
  components: ComponentRecord[];
  views: ComponentRecord[];
  auth: AuthRecord[];
  plugins: PluginRecord[];
  environment: EnvironmentRecord[];
  /** Files the scanners could not parse fully */
  unresolved: string[];
}
