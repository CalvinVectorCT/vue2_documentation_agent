import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectIndex } from '../types/projectIndex';
import { callModel } from '../model/modelClient';
import { SYSTEM_PROMPT, AUTH_PROMPT } from '../model/prompts/index';
import { buildAuthContext } from '../model/promptBuilder';
import { safeWrite } from '../docs/write/safeWrite';

export async function runAuth(
  index: ProjectIndex,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  stream.progress(`Generating authentication docs (${index.auth.length} auth records found)…`);

  let content: string;
  try {
    content = await callModel({
      systemPrompt: SYSTEM_PROMPT,
      taskPrompt: AUTH_PROMPT,
      dataContext: buildAuthContext(index),
      token,
    });
  } catch (err) {
    stream.markdown(`❌ Failed: ${String(err)}`);
    return;
  }

  const docPath = path.join(index.workspaceRoot, 'docs/authentication.md');
  await safeWrite(vscode.Uri.file(docPath), content);

  stream.markdown(content);
  stream.markdown(`\n\n---\n✅ Written to \`docs/authentication.md\`\n`);
}
