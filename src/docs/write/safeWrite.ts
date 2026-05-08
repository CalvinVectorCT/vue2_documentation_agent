import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Write a file, creating parent directories as needed.
 * Does nothing if content is empty.
 */
export async function safeWrite(uri: vscode.Uri, content: string): Promise<void> {
  if (!content.trim()) return;

  // Ensure parent directory exists
  const parentUri = vscode.Uri.file(path.dirname(uri.fsPath));
  try {
    await vscode.workspace.fs.createDirectory(parentUri);
  } catch {
    // Directory may already exist; ignore
  }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

/**
 * Read an existing file, returning null if it does not exist.
 */
export async function safeRead(uri: vscode.Uri): Promise<string | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}
