import * as vscode from 'vscode';

/**
 * Read a workspace file as UTF-8 text.
 * Returns null when the file does not exist rather than throwing.
 */
export async function readWorkspaceFile(uri: vscode.Uri): Promise<string | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Find files matching a glob pattern relative to the workspace root.
 * Excludes node_modules, dist, coverage, storybook outputs, and story files automatically.
 */
export async function findFiles(pattern: string): Promise<vscode.Uri[]> {
  return vscode.workspace.findFiles(
    pattern,
    '{node_modules,dist,coverage,out,.git,storybook-static,.storybook}/**'
  );
}

/**
 * Read every file matched by a glob and return a map of fsPath → content.
 * Files that cannot be read are silently skipped (they go into unresolved).
 */
export async function readMatchingFiles(
  pattern: string,
  unresolved: string[]
): Promise<Map<string, string>> {
  const uris = await findFiles(pattern);
  const result = new Map<string, string>();

  await Promise.all(
    uris.map(async (uri) => {
      const content = await readWorkspaceFile(uri);
      if (content !== null) {
        result.set(uri.fsPath, content);
      } else {
        unresolved.push(uri.fsPath);
      }
    })
  );

  return result;
}
