import * as vscode from 'vscode';

export interface ModelRequest {
  systemPrompt: string;
  taskPrompt: string;
  dataContext: string;
  existingContent?: string;
  token: vscode.CancellationToken;
}

/**
 * Send a structured request to the Copilot language model and collect the full response.
 * Uses message streaming internally but returns the accumulated string.
 */
export async function callModel(request: ModelRequest): Promise<string> {
  const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });

  if (!models.length) {
    throw new Error('No Copilot language model available. Ensure GitHub Copilot is active and signed in.');
  }

  const messages: vscode.LanguageModelChatMessage[] = [
    vscode.LanguageModelChatMessage.User(request.systemPrompt),
    vscode.LanguageModelChatMessage.User(
      `${request.taskPrompt}\n\nProject data:\n\`\`\`json\n${request.dataContext}\n\`\`\``
    ),
  ];

  if (request.existingContent) {
    messages.push(
      vscode.LanguageModelChatMessage.User(
        `Existing documentation:\n\`\`\`markdown\n${request.existingContent}\n\`\`\``
      )
    );
  }

  const response = await models[0].sendRequest(messages, {}, request.token);

  let result = '';
  for await (const chunk of response.text) {
    if (request.token.isCancellationRequested) break;
    result += chunk;
  }

  return result.trim();
}

/**
 * Same as callModel but streams chunks directly into a ChatResponseStream
 * while also accumulating the result for file writing.
 */
export async function callModelStreaming(
  request: ModelRequest,
  stream: vscode.ChatResponseStream
): Promise<string> {
  const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });

  if (!models.length) {
    stream.markdown('❌ No Copilot language model available. Ensure GitHub Copilot is active.');
    throw new Error('No model available');
  }

  const messages: vscode.LanguageModelChatMessage[] = [
    vscode.LanguageModelChatMessage.User(request.systemPrompt),
    vscode.LanguageModelChatMessage.User(
      `${request.taskPrompt}\n\nProject data:\n\`\`\`json\n${request.dataContext}\n\`\`\``
    ),
  ];

  if (request.existingContent) {
    messages.push(
      vscode.LanguageModelChatMessage.User(
        `Existing documentation:\n\`\`\`markdown\n${request.existingContent}\n\`\`\``
      )
    );
  }

  const response = await models[0].sendRequest(messages, {}, request.token);

  let result = '';
  for await (const chunk of response.text) {
    if (request.token.isCancellationRequested) break;
    result += chunk;
    stream.markdown(chunk);
  }

  return result.trim();
}
