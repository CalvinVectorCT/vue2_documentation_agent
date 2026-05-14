import { ProjectIndex } from '../../types/projectIndex';

/**
 * Build a compact, serialized slice of the ProjectIndex relevant to a specific doc target.
 * Passing the full index for every target wastes context window on irrelevant data.
 */

export function buildFullIndexContext(index: ProjectIndex): string {
  return JSON.stringify(sanitizeIndex(index), null, 2);
}

export function buildAuthContext(index: ProjectIndex): string {
  return JSON.stringify(
    {
      scannedAt: index.scannedAt,
      auth: index.auth,
      environment: index.environment,
      routes: index.routes.filter(
        (r) => r.guards?.length || r.meta?.['requiresAuth']
      ),
    },
    null,
    2
  );
}

export function buildEndpointContext(index: ProjectIndex): string {
  return JSON.stringify(
    {
      scannedAt: index.scannedAt,
      apiEndpoints: index.apiEndpoints,
      environment: index.environment.filter((e) => /BASE_URL|API|URL/i.test(e.key)),
    },
    null,
    2
  );
}

export function buildNavigationContext(index: ProjectIndex): string {
  return JSON.stringify(
    {
      scannedAt: index.scannedAt,
      routes: index.routes,
    },
    null,
    2
  );
}

export function buildStateContext(index: ProjectIndex): string {
  return JSON.stringify(
    {
      scannedAt: index.scannedAt,
      vuexModules: index.vuexModules,
    },
    null,
    2
  );
}

export function buildComponentsContext(index: ProjectIndex): string {
  return JSON.stringify(
    {
      scannedAt: index.scannedAt,
      components: index.components,
      views: index.views,
    },
    null,
    2
  );
}

export function buildArchitectureContext(index: ProjectIndex): string {
  return JSON.stringify(sanitizeIndex(index), null, 2);
}

export function buildUserActionsContext(index: ProjectIndex): string {
  return JSON.stringify(
    {
      scannedAt: index.scannedAt,
      routes: index.routes,
      views: index.views,
      components: index.components,
      vuexModules: index.vuexModules,
      apiEndpoints: index.apiEndpoints,
      auth: index.auth,
      environment: index.environment,
    },
    null,
    2
  );
}

// Strip file paths from the index when they add noise for high-level docs
function sanitizeIndex(index: ProjectIndex): object {
  return {
    scannedAt: index.scannedAt,
    routes: index.routes.map(({ path, name, component, redirect, meta, guards, children, lazy }) => ({
      path, name, component, redirect, meta, guards, children, lazy,
    })),
    vuexModules: index.vuexModules.map(({ name, namespaced, stateKeys, getters, mutations, actions }) => ({
      name, namespaced, stateKeys, getters, mutations, actions,
    })),
    apiEndpoints: index.apiEndpoints.map(({ method, path, functionName, group }) => ({
      method, path, functionName, group,
    })),
    components: index.components.map(({ name, props, emits, isView }) => ({ name, props, emits, isView })),
    views: index.views.map(({ name, props, emits }) => ({ name, props, emits })),
    auth: index.auth.map(({ kind, description }) => ({ kind, description })),
    plugins: index.plugins.map(({ name }) => ({ name })),
    environment: index.environment.map(({ key, value, source }) => ({ key, value, source })),
  };
}
