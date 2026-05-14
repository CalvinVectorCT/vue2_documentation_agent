import * as vscode from 'vscode';
import { ProjectIndex } from '../types/projectIndex';
import { callModel } from '../model/modelClient';
import { SYSTEM_PROMPT, buildGeneratePrompt } from '../model/prompts/index';
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
import { writeAllDocs } from '../docs/write/writeDocs';
import { WriteResult } from '../docs/write/writeDocs';

interface DocSpec {
  relativePath: string;
  label: string;
  contextBuilder: (index: ProjectIndex) => string;
}

const DOC_SPECS: DocSpec[] = [
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
 * Generate all documentation files from scratch.
 */
export async function runGenerate(
  index: ProjectIndex,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  const docs = new Map<string, string>();

  for (const spec of DOC_SPECS) {
    if (token.isCancellationRequested) break;

    stream.progress(`Generating ${spec.label}…`);
    stream.markdown(`\n### ${spec.label}\n`);

    try {
      const content = await callModel({
        systemPrompt: SYSTEM_PROMPT,
        taskPrompt: buildGeneratePrompt(spec.relativePath),
        dataContext: spec.contextBuilder(index),
        token,
      });
      docs.set(spec.relativePath, content);
      stream.markdown(`✅ \`${spec.relativePath}\` generated\n\n`);
    } catch (err) {
      stream.markdown(`❌ Failed to generate \`${spec.relativePath}\`: ${String(err)}\n\n`);
    }
  }

  // Generate the index deterministically (no model call)
  docs.set('docs/README.md', buildDocsIndex(index));

  stream.progress('Writing files to disk…');
  const results = await writeAllDocs(index.workspaceRoot, docs, 'generate');

  stream.markdown(buildResultSummary(results));
}

function buildResultSummary(results: WriteResult[]): string {
  const created = results.filter((r) => r.status === 'created').length;
  const updated = results.filter((r) => r.status === 'updated').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  const lines = [
    '',
    '---',
    '## Summary',
    '',
    `| Status | Count |`,
    `|--------|-------|`,
    `| Created | ${created} |`,
    `| Updated | ${updated} |`,
    `| Skipped | ${skipped} |`,
    '',
  ];

  for (const r of results) {
    const icon = r.status === 'created' ? '🆕' : r.status === 'updated' ? '✏️' : r.status === 'skipped' ? '⏭️' : '✅';
    lines.push(`${icon} \`${r.relativePath}\` — ${r.status}`);
  }

  return lines.join('\n');
}
