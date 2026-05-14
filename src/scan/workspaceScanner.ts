import * as vscode from 'vscode';
import { ProjectIndex } from '../types/projectIndex';
import { scanRoutes } from './routesScanner';
import { scanVuex } from './vuexScanner';
import { scanApiEndpoints } from './apiScanner';
import { scanComponents } from './componentsScanner';
import { scanAuth } from './authScanner';
import { scanPlugins } from './pluginsScanner';
import { scanEnvironment } from './environmentScanner';

/**
 * Run all scanners against the active workspace and return a normalized ProjectIndex.
 * Streams progress updates into the Copilot Chat response.
 */
export async function scanWorkspace(
  workspaceRoot: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ProjectIndex> {
  const unresolved: string[] = [];

  stream.progress('Scanning routes…');
  const routes = token.isCancellationRequested ? [] : await scanRoutes(unresolved);

  stream.progress('Scanning Vuex modules…');
  const vuexModules = token.isCancellationRequested ? [] : await scanVuex(unresolved);

  stream.progress('Scanning API endpoints…');
  const apiEndpoints = token.isCancellationRequested ? [] : await scanApiEndpoints(unresolved);

  stream.progress('Scanning components and views…');
  const { components, views } = token.isCancellationRequested
    ? { components: [], views: [] }
    : await scanComponents(unresolved);

  stream.progress('Scanning auth patterns…');
  const auth = token.isCancellationRequested ? [] : await scanAuth(unresolved);

  stream.progress('Scanning plugins…');
  const plugins = token.isCancellationRequested ? [] : await scanPlugins(unresolved);

  stream.progress('Scanning environment and config…');
  const environment = token.isCancellationRequested ? [] : await scanEnvironment(unresolved);

  const index: ProjectIndex = {
    workspaceRoot,
    scannedAt: new Date().toISOString(),
    routes,
    vuexModules,
    apiEndpoints,
    components,
    views,
    auth,
    plugins,
    environment,
    unresolved,
  };

  stream.progress(
    `Scan complete — ${routes.length} routes, ${apiEndpoints.length} endpoints, ` +
    `${components.length + views.length} components, ${vuexModules.length} Vuex modules, ` +
    `${environment.length} env/config records`
  );

  return index;
}
