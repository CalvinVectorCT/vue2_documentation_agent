import * as vscode from 'vscode';
import { scanWorkspace } from '../scan/workspaceScanner';
import { runGenerate } from '../commands/generate';
import { runUpdate } from '../commands/update';
import { runAudit } from '../commands/audit';
import { runEndpoint } from '../commands/endpoint';
import { runAuth } from '../commands/auth';

/**
 * Register the Vue Docs chat participant and wire up all command handlers.
 */
export function registerParticipant(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant(
    'vue-docs-agent.docs',
    handleRequest
  );

  participant.iconPath = new vscode.ThemeIcon('book');
  context.subscriptions.push(participant);
}

async function handleRequest(
  request: vscode.ChatRequest,
  _chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    stream.markdown('❌ No workspace folder is open. Open a Vue 2 project folder first, then try again.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const command = request.command ?? 'generate';

  try {
    const index = await scanWorkspace(workspaceRoot, stream, token);

    if (token.isCancellationRequested) {
      stream.markdown('⚠️ Operation cancelled.');
      return;
    }

    switch (command) {
      case 'generate':
        await runGenerate(index, stream, token);
        break;

      case 'update':
        await runUpdate(index, stream, token);
        break;

      case 'audit':
        await runAudit(index, stream, token);
        break;

      case 'endpoint':
        await runEndpoint(index, stream, token);
        break;

      case 'auth':
        await runAuth(index, stream, token);
        break;

      default:
        stream.markdown(
          `⚠️ Unknown command \`/${command}\`. Available commands: \`/generate\`, \`/update\`, \`/audit\`, \`/endpoint\`, \`/auth\`.`
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stream.markdown(`❌ Vue Docs Agent error: ${message}`);
    vscode.window.showErrorMessage(`Vue Docs Agent: ${message}`);
  }
}
