import * as vscode from 'vscode';
import { ProjectIndex } from '../types/projectIndex';
import { callModel } from '../model/modelClient';
import { SYSTEM_PROMPT, buildUpdatePrompt } from '../model/prompts/index';
import {
  buildFullIndexContext,
  buildAuthContext,
  buildEndpointContext,
  buildNavigationContext,
  buildStateContext,
  buildComponentsContext,
  buildArchitectureContext,
  buildUserActionsContext,
} from '../model/promptBuilder';
import { buildDocsIndex } from '../docs/render/docsIndex';
import { readExistingDocs } from '../docs/diff/readExistingDocs';
import { writeAllDocs } from '../docs/write/writeDocs';

const DOC_SPECS = [
  { relativePath: 'docs/navigation.md', label: 'Navigation', contextBuilder: buildNavigationContext },
  { relativePath: 'docs/authentication.md', label: 'Authentication', contextBuilder: buildAuthContext },
  { relativePath: 'docs/api-endpoints.md', label: 'API Endpoints', contextBuilder: buildEndpointContext },
  { relativePath: 'docs/state-management.md', label: 'State Management', contextBuilder: buildStateContext },
  { relativePath: 'docs/components.md', label: 'Components', contextBuilder: buildComponentsContext },
  { relativePath: 'docs/architecture.md', label: 'Architecture', contextBuilder: buildArchitectureContext },
  { relativePath: 'docs/user-actions.md', label: 'User Actions', contextBuilder: buildUserActionsContext },
  { relativePath: 'docs/diagrams/architecture-overview.md', label: 'Architecture Diagram', contextBuilder: buildArchitectureContext },
  { relativePath: 'docs/diagrams/auth-flow.md', label: 'Auth Flow Diagram', contextBuilder: buildAuthContext },
  { relativePath: 'docs/diagrams/navigation-map.md', label: 'Navigation Diagram', contextBuilder: buildNavigationContext },
  { relativePath: 'docs/diagrams/state-flow.md', label: 'State Flow Diagram', contextBuilder: buildStateContext },
  { relativePath: 'README.md', label: 'Root README', contextBuilder: buildFullIndexContext },
];

/**
 * Re-scan and update only the documentation that has changed.
 */
export async function runUpdate(
  index: ProjectIndex,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  stream.progress('Reading existing documentation…');
  const existingDocs = await readExistingDocs(index.workspaceRoot);
  const docs = new Map<string, string>();

  for (const spec of DOC_SPECS) {
    if (token.isCancellationRequested) break;

    const existing = existingDocs.get(spec.relativePath);

    stream.progress(`Updating ${spec.label}…`);

    try {
      const content = await callModel({
        systemPrompt: SYSTEM_PROMPT,
        taskPrompt: buildUpdatePrompt(spec.relativePath),
        dataContext: spec.contextBuilder(index),
        existingContent: existing ?? undefined,
        token,
      });

      docs.set(spec.relativePath, content);
      stream.markdown(`✅ \`${spec.relativePath}\` updated\n\n`);
    } catch (err) {
      stream.markdown(`❌ Failed to update \`${spec.relativePath}\`: ${String(err)}\n\n`);
    }
  }

  // Always refresh the index
  docs.set('docs/README.md', buildDocsIndex(index));

  const results = await writeAllDocs(index.workspaceRoot, docs, 'update');
  const changed = results.filter((r) => r.status !== 'unchanged').length;
  stream.markdown(`\n✅ Update complete. ${changed} file(s) changed.\n`);
}
