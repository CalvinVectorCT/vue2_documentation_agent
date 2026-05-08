import * as vscode from 'vscode';
import * as path from 'path';
import { safeRead } from '../write/safeWrite';
import { ALL_DOC_TARGETS } from '../../types/docs';

/**
 * Read all existing docs files and return a map of relativePath → content.
 * Files that do not exist yet will be absent from the map.
 */
export async function readExistingDocs(workspaceRoot: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  await Promise.all(
    ALL_DOC_TARGETS.map(async (target) => {
      const uri = vscode.Uri.file(path.join(workspaceRoot, target.relativePath));
      const content = await safeRead(uri);
      if (content !== null) {
        result.set(target.relativePath, content);
      }
    })
  );

  return result;
}

/**
 * Check which expected doc files are missing from disk.
 */
export async function findMissingDocs(workspaceRoot: string): Promise<string[]> {
  const missing: string[] = [];

  await Promise.all(
    ALL_DOC_TARGETS.map(async (target) => {
      const uri = vscode.Uri.file(path.join(workspaceRoot, target.relativePath));
      const content = await safeRead(uri);
      if (content === null) missing.push(target.relativePath);
    })
  );

  return missing;
}
