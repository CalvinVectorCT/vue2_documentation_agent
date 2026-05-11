import * as vscode from 'vscode';
import { ProjectIndex } from '../types/projectIndex';
import { callModel } from '../model/modelClient';
import { SYSTEM_PROMPT, UPDATE_PROMPT } from '../model/prompts/index';
import {
  buildAuthContext,
  buildEndpointContext,
  buildNavigationContext,
  buildStateContext,
  buildComponentsContext,
  buildArchitectureContext,
} from '../model/promptBuilder';
import { buildDocsIndex } from '../docs/render/docsIndex';
import { readExistingDocs } from '../docs/diff/readExistingDocs';
import { addChangelogHeader } from '../docs/diff/changelogHeader';
import { writeAllDocs } from '../docs/write/writeDocs';

const DOC_SPECS = [
  { relativePath: 'docs/navigation.md', label: 'Navigation', contextBuilder: buildNavigationContext },
  { relativePath: 'docs/authentication.md', label: 'Authentication', contextBuilder: buildAuthContext },
  { relativePath: 'docs/api-endpoints.md', label: 'API Endpoints', contextBuilder: buildEndpointContext },
  { relativePath: 'docs/state-management.md', label: 'State Management', contextBuilder: buildStateContext },
  { relativePath: 'docs/components.md', label: 'Components', contextBuilder: buildComponentsContext },
  { relativePath: 'docs/architecture.md', label: 'Architecture', contextBuilder: buildArchitectureContext },
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
        taskPrompt: UPDATE_PROMPT,
        dataContext: spec.contextBuilder(index),
        existingContent: existing ?? undefined,
        token,
      });

      const withChangelog = addChangelogHeader(content, `Updated ${spec.label} documentation`);
      docs.set(spec.relativePath, withChangelog);
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
