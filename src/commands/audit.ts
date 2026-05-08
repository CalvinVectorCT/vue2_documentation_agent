import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectIndex } from '../types/projectIndex';
import { callModel } from '../model/modelClient';
import { SYSTEM_PROMPT, AUDIT_PROMPT } from '../model/prompts/index';
import { buildFullIndexContext } from '../model/promptBuilder';
import { findMissingDocs } from '../docs/diff/readExistingDocs';
import { safeWrite } from '../docs/write/safeWrite';

/**
 * Audit the workspace docs against the current project index.
 * Writes docs/audit-report.md only.
 */
export async function runAudit(
  index: ProjectIndex,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  stream.progress('Auditing documentation…');

  const missingFiles = await findMissingDocs(index.workspaceRoot);

  const missingSection =
    missingFiles.length > 0
      ? `Missing files:\n${missingFiles.map((f) => `- ${f}`).join('\n')}`
      : 'All expected documentation files are present.';

  const augmentedPrompt = `${AUDIT_PROMPT}\n\n${missingSection}`;

  let report: string;
  try {
    report = await callModel({
      systemPrompt: SYSTEM_PROMPT,
      taskPrompt: augmentedPrompt,
      dataContext: buildFullIndexContext(index),
      token,
    });
  } catch (err) {
    stream.markdown(`❌ Audit failed: ${String(err)}`);
    return;
  }

  const reportPath = path.join(index.workspaceRoot, 'docs/audit-report.md');
  await safeWrite(vscode.Uri.file(reportPath), report);

  stream.markdown(report);
  stream.markdown(`\n\n---\n✅ Audit report written to \`docs/audit-report.md\`\n`);
}
