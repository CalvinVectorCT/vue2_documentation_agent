import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectIndex } from '../types/projectIndex';
import { callModel } from '../model/modelClient';
import { SYSTEM_PROMPT, ENDPOINT_PROMPT } from '../model/prompts/index';
import { buildEndpointContext } from '../model/promptBuilder';
import { safeWrite } from '../docs/write/safeWrite';

export async function runEndpoint(
  index: ProjectIndex,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  stream.progress(`Generating API endpoint docs (${index.apiEndpoints.length} endpoints found)…`);

  let content: string;
  try {
    content = await callModel({
      systemPrompt: SYSTEM_PROMPT,
      taskPrompt: ENDPOINT_PROMPT,
      dataContext: buildEndpointContext(index),
      token,
    });
  } catch (err) {
    stream.markdown(`❌ Failed: ${String(err)}`);
    return;
  }

  const docPath = path.join(index.workspaceRoot, 'docs/api-endpoints.md');
  await safeWrite(vscode.Uri.file(docPath), content);

  stream.markdown(content);
  stream.markdown(`\n\n---\n✅ Written to \`docs/api-endpoints.md\`\n`);
}
