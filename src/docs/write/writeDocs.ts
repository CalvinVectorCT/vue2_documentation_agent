import * as vscode from 'vscode';
import * as path from 'path';
import { safeWrite, safeRead } from './safeWrite';

export interface WriteResult {
  relativePath: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped';
}

/**
 * Write a generated doc to disk.
 * In update mode, only write if content differs from what is already there.
 */
export async function writeDoc(
  workspaceRoot: string,
  relativePath: string,
  content: string,
  mode: 'generate' | 'update'
): Promise<WriteResult> {
  const uri = vscode.Uri.file(path.join(workspaceRoot, relativePath));
  const existing = await safeRead(uri);

  if (!content.trim()) {
    return { relativePath, status: 'skipped' };
  }

  if (mode === 'update' && existing !== null && existing.trim() === content.trim()) {
    return { relativePath, status: 'unchanged' };
  }

  await safeWrite(uri, content);

  return {
    relativePath,
    status: existing === null ? 'created' : 'updated',
  };
}

/**
 * Write all docs from a map of relativePath → content.
 * Returns a summary of what changed.
 */
export async function writeAllDocs(
  workspaceRoot: string,
  docs: Map<string, string>,
  mode: 'generate' | 'update'
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];

  for (const [relativePath, content] of docs) {
    const result = await writeDoc(workspaceRoot, relativePath, content, mode);
    results.push(result);
  }

  return results;
}
